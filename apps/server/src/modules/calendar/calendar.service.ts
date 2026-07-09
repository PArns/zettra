import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import {
  type AgendaItem,
  BlockVisibility,
  type DayBucket,
  DocBlock,
  extractPlainText,
  FieldType,
  findConflicts,
  groupByDay,
} from '@zettra/shared';
import { Block, FieldValue, Reminder, TagField } from '../../entities/index';
import { RequestContext } from '../../common/request-context';

export interface Agenda {
  days: DayBucket[];
  /** ISO days (`YYYY-MM-DD`) carrying more than one item — candidate scheduling conflicts. */
  conflicts: string[];
}

/**
 * Calendar surface (§3, §6): a permission-scoped union of every dated thing the acting user can
 * see — pending reminders and date-typed field values — into a single agenda over a date range.
 * Every read is scoped to `visibleSpaceIds` and block-level visibility (invariant 11); nothing is
 * materialized. Conflict detection (a day already carrying appointments) is pure logic in shared.
 */
@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Reminder) private readonly reminders: Repository<Reminder>,
    @InjectRepository(FieldValue) private readonly fieldValues: Repository<FieldValue>,
    @InjectRepository(TagField) private readonly tagFields: Repository<TagField>,
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
  ) {}

  /** Agenda over `[fromIso, toIso]` inclusive (both `YYYY-MM-DD`). */
  async agenda(ctx: RequestContext, fromIso: string, toIso: string): Promise<Agenda> {
    if (ctx.visibleSpaceIds.length === 0) return { days: [], conflicts: [] };
    const from = new Date(`${fromIso}T00:00:00Z`);
    const to = new Date(`${toIso}T23:59:59Z`);

    const [reminderItems, fieldItems] = await Promise.all([
      this.reminderItems(ctx, from, to),
      this.dateFieldItems(ctx, from, to),
    ]);
    const items = [...reminderItems, ...fieldItems];
    return {
      days: groupByDay(items),
      conflicts: findConflicts(items).map((c) => c.iso),
    };
  }

  private async reminderItems(ctx: RequestContext, from: Date, to: Date): Promise<AgendaItem[]> {
    if (!ctx.userId) return [];
    const rows = await this.reminders.find({
      where: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        status: 'pending',
        remindAt: Between(from, to),
      },
      order: { remindAt: 'ASC' },
      take: 500,
    });
    const titles = await this.titlesFor(
      ctx,
      rows.map((r) => r.blockId),
    );
    return rows
      .filter((r) => titles.has(r.blockId))
      .map((r) => ({
        blockId: r.blockId,
        title: titles.get(r.blockId)!,
        date: r.remindAt.toISOString().slice(0, 10),
        kind: 'reminder' as const,
        label: r.note ?? undefined,
      }));
  }

  private async dateFieldItems(ctx: RequestContext, from: Date, to: Date): Promise<AgendaItem[]> {
    const dateFields = await this.tagFields.find({ where: { type: FieldType.Date } });
    if (dateFields.length === 0) return [];
    const fieldById = new Map(dateFields.map((f) => [f.id, f]));
    const rows = await this.fieldValues.find({
      where: {
        tenantId: ctx.tenantId,
        fieldId: In([...fieldById.keys()]),
        valueDate: Between(from, to),
      },
      take: 1000,
    });
    if (rows.length === 0) return [];
    const titles = await this.titlesFor(
      ctx,
      rows.map((r) => r.blockId),
    );
    return rows
      .filter((r) => r.valueDate !== null && titles.has(r.blockId))
      .map((r) => ({
        blockId: r.blockId,
        title: titles.get(r.blockId)!,
        date: r.valueDate!.toISOString().slice(0, 10),
        kind: 'field' as const,
        label: fieldById.get(r.fieldId)?.name,
      }));
  }

  /** Titles for blocks the acting user can actually see (invariant 11); missing ⇒ not visible. */
  private async titlesFor(ctx: RequestContext, blockIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(blockIds)];
    if (ids.length === 0) return new Map();
    const blocks = await this.blocks.find({
      where: { id: In(ids), tenantId: ctx.tenantId, spaceId: In(ctx.visibleSpaceIds) },
    });
    return new Map(
      blocks
        .filter((b) => b.visibility !== BlockVisibility.Private || b.ownerUserId === ctx.userId)
        .map((b) => [b.id, title(b)]),
    );
  }
}

function title(block: Block): string {
  const doc: DocBlock[] = Array.isArray(block.content) ? (block.content as DocBlock[]) : [];
  const text = extractPlainText(doc).trim();
  return text ? text.split('\n')[0].slice(0, 80) : 'Untitled';
}
