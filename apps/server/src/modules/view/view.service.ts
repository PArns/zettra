import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { FieldType, ViewDefinition } from '@zettra/shared';
import { Block, View } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { TagService } from '../tag/tag.service';
import { CompiledQuery, compileView } from './view-compiler';

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
    private readonly tags: TagService,
  ) {}

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
