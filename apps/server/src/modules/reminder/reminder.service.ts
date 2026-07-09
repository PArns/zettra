import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import {
  asRecurrenceRule,
  BlockVisibility,
  DocBlock,
  extractPlainText,
  nextOccurrence,
} from '@zettra/shared';
import { Block, Reminder } from '../../entities/index';
import { RequestContext } from '../../common/request-context';

export interface ReminderView {
  id: string;
  blockId: string;
  title: string;
  remindAt: string;
  note: string | null;
  status: string;
  recurrence: string | null;
}

/**
 * Reminders / Wiedervorlage (§3–§4). Every read/write is permission-scoped: a reminder is only
 * visible/creatable on a block the acting user can actually see (invariant 11).
 */
@Injectable()
export class ReminderService {
  constructor(
    @InjectRepository(Reminder) private readonly reminders: Repository<Reminder>,
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
  ) {}

  async create(
    ctx: RequestContext,
    blockId: string,
    remindAt: string,
    note?: string,
    recurrence?: string,
  ): Promise<ReminderView> {
    const block = await this.visibleBlock(ctx, blockId);
    const row = await this.reminders.save(
      this.reminders.create({
        tenantId: ctx.tenantId,
        blockId,
        userId: ctx.userId,
        remindAt: parseWhen(remindAt),
        note: note ?? null,
        status: 'pending',
        recurrence: asRecurrenceRule(recurrence),
      }),
    );
    return this.toView(row, entityTitle(block));
  }

  async listForBlock(ctx: RequestContext, blockId: string): Promise<ReminderView[]> {
    const block = await this.visibleBlock(ctx, blockId);
    const rows = await this.reminders.find({
      where: { tenantId: ctx.tenantId, blockId },
      order: { remindAt: 'ASC' },
    });
    const title = entityTitle(block);
    return rows.map((r) => this.toView(r, title));
  }

  /** Pending reminders for the acting user, soonest first, with block titles. */
  async listUpcoming(ctx: RequestContext): Promise<ReminderView[]> {
    if (!ctx.userId) return [];
    const rows = await this.reminders.find({
      where: { tenantId: ctx.tenantId, userId: ctx.userId, status: 'pending' },
      order: { remindAt: 'ASC' },
      take: 100,
    });
    const titles = await this.titlesFor(
      ctx,
      rows.map((r) => r.blockId),
    );
    return rows
      .filter((r) => titles.has(r.blockId)) // drop reminders on blocks no longer visible
      .map((r) => this.toView(r, titles.get(r.blockId)!));
  }

  async setStatus(ctx: RequestContext, id: string, status: 'done' | 'dismissed'): Promise<void> {
    const row = await this.reminders.findOne({ where: { id, tenantId: ctx.tenantId } });
    if (!row) throw new NotFoundException('Reminder not found');
    // Wiedervorlage: completing a recurring reminder reschedules it to the next occurrence instead
    // of closing it, so it resurfaces on its cycle. Dismiss always closes it.
    const rule = status === 'done' ? asRecurrenceRule(row.recurrence) : null;
    if (rule) {
      const currentIso = row.remindAt.toISOString().slice(0, 10);
      await this.reminders.update(
        { id, tenantId: ctx.tenantId },
        { remindAt: new Date(`${nextOccurrence(currentIso, rule)}T09:00:00Z`), notifiedAt: null },
      );
      return;
    }
    await this.reminders.update({ id, tenantId: ctx.tenantId }, { status });
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    await this.reminders.delete({ id, tenantId: ctx.tenantId });
  }

  /** Due, not-yet-notified pending reminders across a tenant — for the due-scan job. */
  dueForTenant(tenantId: string, now: Date): Promise<Reminder[]> {
    return this.reminders.find({
      where: { tenantId, status: 'pending', remindAt: LessThanOrEqual(now) },
      take: 500,
    });
  }

  markNotified(ids: string[], at: Date): Promise<unknown> {
    if (ids.length === 0) return Promise.resolve(undefined);
    return this.reminders.update({ id: In(ids) }, { notifiedAt: at });
  }

  private async visibleBlock(ctx: RequestContext, blockId: string): Promise<Block> {
    const block = await this.blocks.findOne({ where: { id: blockId, tenantId: ctx.tenantId } });
    if (!block || !ctx.visibleSpaceIds.includes(block.spaceId)) {
      throw new NotFoundException('Block not found');
    }
    if (block.visibility === BlockVisibility.Private && block.ownerUserId !== ctx.userId) {
      throw new ForbiddenException('No access to this block');
    }
    return block;
  }

  private async titlesFor(ctx: RequestContext, blockIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(blockIds)];
    if (ids.length === 0) return new Map();
    const blocks = await this.blocks.find({
      where: { id: In(ids), tenantId: ctx.tenantId, spaceId: In(ctx.visibleSpaceIds) },
    });
    return new Map(
      blocks
        .filter((b) => b.visibility !== BlockVisibility.Private || b.ownerUserId === ctx.userId)
        .map((b) => [b.id, entityTitle(b)]),
    );
  }

  private toView(r: Reminder, title: string): ReminderView {
    return {
      id: r.id,
      blockId: r.blockId,
      title,
      remindAt: r.remindAt.toISOString(),
      note: r.note,
      status: r.status,
      recurrence: r.recurrence,
    };
  }
}

/** A date (`YYYY-MM-DD`) becomes 09:00 UTC that day; a full ISO timestamp is used verbatim. */
function parseWhen(input: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T09:00:00Z`);
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new NotFoundException('Invalid reminder date');
  return d;
}

function entityTitle(block: Block): string {
  const doc: DocBlock[] = Array.isArray(block.content) ? (block.content as DocBlock[]) : [];
  const text = extractPlainText(doc).trim();
  return text ? text.split('\n')[0].slice(0, 80) : 'Untitled';
}
