import { Injectable, Logger } from '@nestjs/common';
import {
  AiPrivacyScope,
  AiStakes,
  AiTaskType,
  DocBlock,
  extractPlainText,
  type TodoItemDto,
} from '@zettra/shared';
import { RequestContext } from '../../common/request-context';
import { AiRouterService } from '../ai/ai-router.service';
import { ViewService } from '../view/view.service';
import { ReminderService } from '../reminder/reminder.service';
import { Block } from '../../entities/index';

export interface DailyBriefing {
  briefing: string;
  dueTodos: TodoItemDto[];
  reminderCount: number;
  updatedCount: number;
}

/**
 * The proactive daily briefing (§4/§6): a short, LLM-written "here's your day" summary over what's
 * actually on the user's plate — overdue/today to-dos, today's reminders, and notes touched today.
 * Everything it reads is already permission-scoped by the underlying services; the LLM only sees
 * the acting user's own items, and the call stays local-only (privacy beats quality, invariant 9).
 */
@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    private readonly views: ViewService,
    private readonly reminders: ReminderService,
    private readonly ai: AiRouterService,
  ) {}

  async daily(ctx: RequestContext): Promise<DailyBriefing> {
    const today = new Date().toISOString().slice(0, 10);
    const [todos, updated, reminders] = await Promise.all([
      this.views.todos(ctx).catch(() => [] as TodoItemDto[]),
      this.views.todayItems(ctx).catch(() => [] as Block[]),
      this.reminders.listUpcoming(ctx).catch(() => []),
    ]);

    const dueTodos = todos.filter((t) => !t.done && t.due && t.due <= today);
    const todayReminders = reminders.filter((r) => r.remindAt.slice(0, 10) <= today);
    const result: DailyBriefing = {
      briefing: '',
      dueTodos,
      reminderCount: todayReminders.length,
      updatedCount: updated.length,
    };

    const parts = [
      dueTodos.length
        ? `Fällige To-dos:\n${dueTodos
            .map((t) => `- ${t.title}${t.due ? ` (fällig ${t.due})` : ''}`)
            .join('\n')}`
        : '',
      todayReminders.length
        ? `Erinnerungen:\n${todayReminders.map((r) => `- ${r.title}`).join('\n')}`
        : '',
      updated.length
        ? `Heute bearbeitet:\n${updated
            .slice(0, 8)
            .map((b) => `- ${title(b)}`)
            .join('\n')}`
        : '',
    ].filter(Boolean);

    if (parts.length === 0) {
      result.briefing = 'Für heute steht nichts Dringendes an — ein guter Moment, um vorauszuplanen.';
      return result;
    }

    try {
      const answer = await this.ai.chat(
        {
          type: AiTaskType.Summarization,
          privacyScope: AiPrivacyScope.LocalOnly,
          estimatedTokens: Math.ceil(parts.join('\n').length / 4) + 200,
          stakes: AiStakes.Low,
        },
        [
          {
            role: 'system',
            content:
              'Du bist Zettras Assistent. Schreibe ein kurzes, freundliches Morgen-Briefing auf ' +
              'Deutsch (2–4 Sätze, fließender Text, keine Aufzählung). Sag klar, worauf man sich ' +
              'heute konzentrieren sollte. Nutze AUSSCHLIESSLICH die untenstehenden Informationen.',
          },
          { role: 'user', content: `${parts.join('\n\n')}\n\nSchreibe das Briefing.` },
        ],
      );
      result.briefing = answer.trim();
    } catch (err) {
      this.logger.warn(`Daily briefing LLM unavailable: ${(err as Error).message}`);
      // Deterministic fallback so the card is never empty when the model is cold/absent.
      result.briefing = dueTodos.length
        ? `Heute fällig: ${dueTodos.length} To-do${dueTodos.length > 1 ? 's' : ''}. Fang mit „${dueTodos[0].title}“ an.`
        : 'Ein paar Erinnerungen und frische Notizen warten auf dich.';
    }
    return result;
  }
}

function title(block: Block): string {
  const doc: DocBlock[] = Array.isArray(block.content) ? (block.content as DocBlock[]) : [];
  const text = extractPlainText(doc).trim();
  return text ? text.split('\n')[0].slice(0, 80) : 'Notiz';
}
