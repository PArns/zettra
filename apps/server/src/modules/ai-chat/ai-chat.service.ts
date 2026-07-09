import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AiChatMessage,
  AiPrivacyScope,
  AiStakes,
  AiTaskType,
  DocBlock,
  extractPlainText,
} from '@zettra/shared';
import { Block, Space } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { AiRouterService } from '../ai/ai-router.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { SimilarityService } from '../embedding/similarity.service';

export interface ChatSource {
  blockId: string;
  title: string;
}
export interface ChatAnswer {
  answer: string;
  sources: ChatSource[];
}

/**
 * AI chat over the index (§1, §14): retrieve the most relevant blocks for a question
 * (permission-scoped similarity, invariant 11), then compose an answer through the AiRouter —
 * privacy gate first (invariant 9): a cross-space chat defaults to `local_only`, a single-space
 * chat uses that space's `aiPolicy`. Answers cite the note titles they used.
 */
@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(Space) private readonly spaces: Repository<Space>,
    private readonly embeddings: EmbeddingService,
    private readonly similarity: SimilarityService,
    private readonly ai: AiRouterService,
  ) {}

  async answer(ctx: RequestContext, question: string, spaceId?: string): Promise<ChatAnswer> {
    const q = question.trim();
    if (!q) return { answer: '', sources: [] };

    const vector = await this.embeddings.embedText(q);
    if (!vector) {
      return { answer: 'The search index is not available right now.', sources: [] };
    }

    const hits = await this.similarity.search(ctx, vector, 8, spaceId);
    if (hits.length === 0) {
      return { answer: "I couldn't find anything relevant in your notes.", sources: [] };
    }

    const blocks = await this.blocks.find({
      where: { id: In(hits.map((h) => h.blockId)), tenantId: ctx.tenantId },
    });
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const ordered = hits.map((h) => byId.get(h.blockId)).filter((b): b is Block => Boolean(b));
    const sources: ChatSource[] = ordered.map((b) => ({ blockId: b.id, title: title(b) }));

    const context = ordered.map((b, i) => `[${i + 1}] ${title(b)}\n${snippet(b)}`).join('\n\n');

    const messages: AiChatMessage[] = [
      {
        role: 'system',
        content:
          'You are Zettra, a helpful assistant answering questions about the user’s own notes. ' +
          'Answer using ONLY the numbered notes below. Cite the notes you use by their title. ' +
          'If the notes do not contain the answer, say so plainly. Be concise.',
      },
      { role: 'user', content: `Notes:\n${context}\n\nQuestion: ${q}` },
    ];

    const privacyScope = await this.scopeFor(ctx, spaceId);
    try {
      const answer = await this.ai.chat(
        {
          type: AiTaskType.Summarization,
          privacyScope,
          estimatedTokens: Math.ceil((context.length + q.length) / 4) + 256,
          stakes: AiStakes.Low,
        },
        messages,
      );
      return { answer: answer.trim(), sources };
    } catch (err) {
      this.logger.warn(`AI chat failed, returning sources only: ${(err as Error).message}`);
      return {
        answer: 'The assistant is unavailable, but here are the most relevant notes.',
        sources,
      };
    }
  }

  /** Cross-space chat stays local-only (privacy beats quality); a single space uses its policy. */
  private async scopeFor(ctx: RequestContext, spaceId?: string): Promise<AiPrivacyScope> {
    if (!spaceId) return AiPrivacyScope.LocalOnly;
    const space = await this.spaces.findOne({ where: { id: spaceId, tenantId: ctx.tenantId } });
    return space?.aiPolicy === AiPrivacyScope.Default
      ? AiPrivacyScope.Default
      : AiPrivacyScope.LocalOnly;
  }
}

function toDoc(content: unknown): DocBlock[] {
  return Array.isArray(content) ? (content as DocBlock[]) : [];
}
function title(block: Block): string {
  const text = extractPlainText(toDoc(block.content)).trim();
  return text ? text.split('\n')[0].slice(0, 80) : 'Untitled';
}
function snippet(block: Block): string {
  return extractPlainText(toDoc(block.content)).slice(0, 500);
}
