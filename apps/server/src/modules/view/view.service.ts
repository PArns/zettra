import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import {
  BlockVisibility,
  CreateViewDto,
  DocBlock,
  extractPlainText,
  FieldType,
  SEED_TAGS,
  TodoItemDto,
  ViewDefinition,
  ViewLayout,
} from '@zettra/shared';
import { Block, FieldValue, Tag, View } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { TagService, EffectiveField } from '../tag/tag.service';
import { FieldValueService } from '../field/field-value.service';
import { CompiledQuery, compileView } from './view-compiler';

/** A view row = a block plus its structured field values, for table/board rendering. */
export interface ViewRow {
  block: Block;
  values: Record<string, unknown>;
}

export interface ViewData {
  view: View;
  fields: EffectiveField[];
  rows: ViewRow[];
}

/**
 * Executes saved views (§8.2). Resolves the tag's effective field schema (walking extendsId,
 * §8.1) so inherited fields are filterable, compiles the view to an IR, and applies it to a
 * TypeORM QueryBuilder. Always scoped to the acting user's visible spaces (§15.2) via the
 * compiler's mandatory clauses.
 */
@Injectable()
export class ViewService {
  constructor(
    @InjectRepository(View) private readonly views: Repository<View>,
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(FieldValue) private readonly fieldValues: Repository<FieldValue>,
    private readonly tags: TagService,
    private readonly fieldValueService: FieldValueService,
  ) {}

  // --- CRUD ---

  list(ctx: RequestContext): Promise<View[]> {
    return this.views.find({
      where: [
        { tenantId: ctx.tenantId, ownerUserId: ctx.userId ?? undefined },
        { tenantId: ctx.tenantId, ownerUserId: undefined },
      ],
    });
  }

  create(ctx: RequestContext, dto: CreateViewDto): Promise<View> {
    return this.views.save(
      this.views.create({
        tenantId: ctx.tenantId,
        spaceId: dto.spaceId ?? null,
        name: dto.name,
        tagId: dto.tagId ?? null,
        layout: dto.layout ?? ViewLayout.Table,
        filters: dto.filters ?? [],
        sorts: dto.sorts ?? [],
        groupBy: dto.groupBy ?? null,
        ownerUserId: ctx.userId,
      }),
    );
  }

  async update(ctx: RequestContext, id: string, patch: Partial<CreateViewDto>): Promise<View> {
    const view = await this.views.findOne({ where: { id, tenantId: ctx.tenantId } });
    if (!view) throw new NotFoundException('View not found');
    Object.assign(view, {
      name: patch.name ?? view.name,
      layout: patch.layout ?? view.layout,
      filters: patch.filters ?? view.filters,
      sorts: patch.sorts ?? view.sorts,
      groupBy: patch.groupBy !== undefined ? patch.groupBy : view.groupBy,
    });
    return this.views.save(view);
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    await this.views.delete({ id, tenantId: ctx.tenantId });
  }

  /** Full view payload for rendering: definition, effective fields, and rows with values. */
  async data(ctx: RequestContext, viewId: string): Promise<ViewData> {
    const view = await this.views.findOne({ where: { id: viewId, tenantId: ctx.tenantId } });
    if (!view) throw new NotFoundException('View not found');
    const rows = await this.run(ctx, viewId);
    const fields = view.tagId
      ? await this.tags.resolveEffectiveFields(ctx.tenantId, view.tagId)
      : [];
    const withValues = await this.attachValues(rows);
    return { view, fields, rows: withValues };
  }

  private async attachValues(blocks: Block[]): Promise<ViewRow[]> {
    if (blocks.length === 0) return [];
    const values = await this.fieldValues.find({
      where: { blockId: In(blocks.map((b) => b.id)) },
    });
    const byBlock = new Map<string, Record<string, unknown>>();
    for (const v of values) {
      const bucket = byBlock.get(v.blockId) ?? {};
      bucket[v.fieldId] = firstNonNull(v);
      byBlock.set(v.blockId, bucket);
    }
    return blocks.map((block) => ({ block, values: byBlock.get(block.id) ?? {} }));
  }

  async run(ctx: RequestContext, viewId: string): Promise<Block[]> {
    const view = await this.views.findOne({ where: { id: viewId, tenantId: ctx.tenantId } });
    if (!view) throw new NotFoundException('View not found');
    const def: ViewDefinition = {
      tagId: view.tagId,
      filters: view.filters,
      sorts: view.sorts,
      groupBy: view.groupBy,
      structural: view.tagId ? undefined : [{ kind: 'untagged' }],
    };
    return this.runDefinition(ctx, def);
  }

  /** Run an ad-hoc definition (used by the Briefkasten and search). */
  async runDefinition(ctx: RequestContext, def: ViewDefinition): Promise<Block[]> {
    const fields = await this.resolveFieldTypes(ctx, def);
    const compiled = compileView(def, fields, {
      tenantId: ctx.tenantId,
      visibleSpaceIds: ctx.visibleSpaceIds,
      actingUserId: ctx.userId,
    });
    return this.applyCompiled(compiled).getMany();
  }

  /**
   * Blocks carrying a supertag, as lightweight `{ blockId, title }` entities — the population a
   * `relation`-typed field can point at. Runs through the same permission-scoped compiler as
   * views (§15.2), so private blocks the caller can't read never appear.
   */
  async entitiesForTag(
    ctx: RequestContext,
    tagId: string,
  ): Promise<{ blockId: string; title: string }[]> {
    const blocks = await this.runDefinition(ctx, {
      tagId,
      filters: [],
      sorts: [],
      groupBy: null,
    });
    return blocks.map((b) => ({ blockId: b.id, title: entityTitle(b) }));
  }

  /** The Briefkasten: untagged, unfiled blocks owned by the acting user (§8.2, §15.3). */
  async inbox(ctx: RequestContext): Promise<Block[]> {
    const def: ViewDefinition = {
      tagId: null,
      filters: [],
      sorts: [],
      groupBy: null,
      structural: [
        { kind: 'untagged' },
        { kind: 'unfiled' },
        ...(ctx.userId ? [{ kind: 'owned_by' as const, userId: ctx.userId }] : []),
      ],
    };
    return this.runDefinition(ctx, def);
  }

  /**
   * The global to-do list (§4): every #todo-tagged note the acting user can see, with its due
   * date, follow-up (Wiedervorlage) and status, sorted overdue-first then by due date (undated
   * last, done at the bottom). Ensures the #todo supertag exists so the list always works.
   */
  async todos(ctx: RequestContext): Promise<TodoItemDto[]> {
    const todoTag = await this.ensureTodoTag(ctx);
    const blocks = await this.runDefinition(ctx, {
      tagId: todoTag.id,
      filters: [],
      sorts: [],
      groupBy: null,
    });
    if (blocks.length === 0) return [];

    const fields = await this.tags.resolveEffectiveFields(ctx.tenantId, todoTag.id);
    const idByName = new Map(fields.map((f) => [f.name, f.id]));
    const dueId = idByName.get('due');
    const statusId = idByName.get('status');
    const wvId = idByName.get('Wiedervorlage');

    const rows = await this.fieldValues.find({ where: { blockId: In(blocks.map((b) => b.id)) } });
    const byBlock = new Map<string, Map<string, FieldValue>>();
    for (const r of rows) {
      const m = byBlock.get(r.blockId) ?? new Map();
      m.set(r.fieldId, r);
      byBlock.set(r.blockId, m);
    }
    const dateOf = (m: Map<string, FieldValue> | undefined, id?: string): string | null => {
      const v = id ? m?.get(id) : undefined;
      return v?.valueDate ? new Date(v.valueDate).toISOString().slice(0, 10) : null;
    };

    const items: TodoItemDto[] = blocks.map((b) => {
      const m = byBlock.get(b.id);
      const status = (statusId ? m?.get(statusId)?.valueText : null) ?? null;
      return {
        blockId: b.id,
        title: entityTitle(b),
        due: dateOf(m, dueId),
        followUp: dateOf(m, wvId),
        status,
        done: status === 'done',
      };
    });

    // Overdue/undated ordering: not-done first (overdue→soonest→undated), done last.
    const far = '9999-12-31';
    return items.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.due ?? far).localeCompare(b.due ?? far);
    });
  }

  /** Set a #todo note's status (drives the done-toggle in the global list, §4). */
  async setTodoStatus(ctx: RequestContext, blockId: string, status: string): Promise<void> {
    const todoTag = await this.ensureTodoTag(ctx);
    const fields = await this.tags.resolveEffectiveFields(ctx.tenantId, todoTag.id);
    const statusId = fields.find((f) => f.name === 'status')?.id;
    if (!statusId) return;
    await this.fieldValueService.set(ctx.tenantId, blockId, statusId, status, ctx.userId);
  }

  /** Find the tenant's #todo supertag, creating it from the seed (fields included) if absent. */
  async ensureTodoTag(ctx: RequestContext): Promise<Tag> {
    const all = await this.tags.list(ctx.tenantId);
    const existing = all.find((t) => t.name === 'todo');
    if (existing) return existing;
    const seed = SEED_TAGS.find((s) => s.name === 'todo');
    if (!seed) throw new Error('todo seed missing');
    return this.tags.create(ctx.tenantId, {
      name: seed.name,
      icon: seed.icon,
      color: seed.color,
      fields: seed.fields.map((f, i) => ({
        name: f.name,
        type: f.type,
        config: f.config as Record<string, unknown> | undefined,
        position: i,
      })),
    });
  }

  /** Notes filed into a specific folder (§8.2). Permission-scoped like every read path. */
  async folderContents(ctx: RequestContext, folderId: string): Promise<Block[]> {
    const def: ViewDefinition = {
      tagId: null,
      filters: [],
      sorts: [],
      groupBy: null,
      structural: [{ kind: 'in_folder', folderId }],
    };
    return this.runDefinition(ctx, def);
  }

  /** The "For Review" bucket: the acting user's captures awaiting triage (§8.3). */
  async forReview(ctx: RequestContext): Promise<Block[]> {
    const def: ViewDefinition = {
      tagId: null,
      filters: [],
      sorts: [],
      groupBy: null,
      structural: [
        { kind: 'needs_review' },
        ...(ctx.userId ? [{ kind: 'owned_by' as const, userId: ctx.userId }] : []),
      ],
    };
    return this.runDefinition(ctx, def);
  }

  /**
   * The Today feed (§6): everything the acting user can see that was created OR updated today
   * (UTC day). Permission-scoped (visible spaces + block-level visibility, invariant 11).
   */
  async todayItems(ctx: RequestContext): Promise<Block[]> {
    if (ctx.visibleSpaceIds.length === 0) return [];
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return this.blocks
      .createQueryBuilder('block')
      .where('block.tenantId = :tenantId', { tenantId: ctx.tenantId })
      .andWhere('block.spaceId IN (:...spaces)', { spaces: ctx.visibleSpaceIds })
      .andWhere('(block.visibility = :vis OR block.ownerUserId = :uid)', {
        vis: BlockVisibility.Space,
        uid: ctx.userId,
      })
      .andWhere('(block.createdAt >= :start OR block.updatedAt >= :start)', { start })
      .orderBy('block.updatedAt', 'DESC')
      .take(50)
      .getMany();
  }

  private async resolveFieldTypes(
    ctx: RequestContext,
    def: ViewDefinition,
  ): Promise<Map<string, FieldType>> {
    if (!def.tagId) return new Map();
    const effective = await this.tags.resolveEffectiveFields(ctx.tenantId, def.tagId);
    return new Map(effective.map((f) => [f.id, f.type]));
  }

  private applyCompiled(compiled: CompiledQuery): SelectQueryBuilder<Block> {
    const qb = this.blocks.createQueryBuilder('block');
    for (const join of compiled.joins) {
      qb.leftJoin(
        'field_value',
        join.alias,
        `${join.alias}."blockId" = block."id" AND ${join.alias}."fieldId" = :${join.fieldParam}`,
      );
    }
    if (compiled.wheres.length) qb.where(compiled.wheres.join(' AND '));
    qb.setParameters(compiled.params);
    for (const order of compiled.orderBy) qb.addOrderBy(order.expr, order.dir);
    return qb;
  }
}

/** Return the single populated value column for a field_value row (invariant 2). */
function firstNonNull(v: FieldValue): unknown {
  if (v.valueText !== null) return v.valueText;
  if (v.valueNumber !== null) return v.valueNumber;
  if (v.valueDate !== null) return v.valueDate;
  if (v.valueBool !== null) return v.valueBool;
  if (v.valueJson !== null && v.valueJson !== undefined) return v.valueJson;
  return null;
}

/** First non-empty line of a block's prose, capped — the display label for an entity. */
function entityTitle(block: Block): string {
  const doc: DocBlock[] = Array.isArray(block.content) ? (block.content as DocBlock[]) : [];
  const text = extractPlainText(doc).trim();
  return text ? text.split('\n')[0].slice(0, 80) : 'Untitled';
}
