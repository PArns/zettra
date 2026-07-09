import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { CreateViewDto, FieldType, ViewDefinition, ViewLayout } from '@zettra/shared';
import { Block, FieldValue, View } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { TagService, EffectiveField } from '../tag/tag.service';
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

  /** The Briefkasten: untagged blocks owned by the acting user (§8.2, §15.3). */
  async inbox(ctx: RequestContext): Promise<Block[]> {
    const def: ViewDefinition = {
      tagId: null,
      filters: [],
      sorts: [],
      groupBy: null,
      structural: [
        { kind: 'untagged' },
        ...(ctx.userId ? [{ kind: 'owned_by' as const, userId: ctx.userId }] : []),
      ],
    };
    return this.runDefinition(ctx, def);
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
