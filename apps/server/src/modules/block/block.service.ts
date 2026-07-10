import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateBlockDto, BlockSource, BlockVisibility } from '@zettra/shared';
import { Block, BlockTag } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { QUEUE, QueueService } from '../jobs/queue.service';
import { LimitsService } from '../limits/limits.service';

/**
 * Block CRUD. Every read is permission-scoped to the acting user's visible spaces (§15.2),
 * not just tenant-scoped. Writes enqueue a debounced embed job (§8.7 step 4).
 */
@Injectable()
export class BlockService {
  constructor(
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(BlockTag) private readonly blockTags: Repository<BlockTag>,
    private readonly queue: QueueService,
    private readonly limits: LimitsService,
  ) {}

  async create(ctx: RequestContext, dto: CreateBlockDto): Promise<Block> {
    if (!ctx.visibleSpaceIds.includes(dto.spaceId)) {
      throw new ForbiddenException('No access to target space');
    }
    await this.limits.assertCanCreate(ctx.tenantId, 'blocks');
    const block = await this.blocks.save(
      this.blocks.create({
        tenantId: ctx.tenantId,
        spaceId: dto.spaceId,
        parentId: dto.parentId ?? null,
        content: dto.content ?? {},
        source: dto.source ?? BlockSource.Manual,
        sourceRef: dto.sourceRef ?? null,
        ownerUserId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
        contributorIds: ctx.userId ? [ctx.userId] : [],
      }),
    );
    await this.enqueueEmbed(ctx.tenantId, block.id);
    // Captured (non-manual) blocks run the capture pipeline: tag/field proposal + linking (§8.3).
    if ((dto.source ?? BlockSource.Manual) !== BlockSource.Manual) {
      await this.queue.enqueue(
        QUEUE.ProcessCapture,
        { tenantId: ctx.tenantId, blockId: block.id },
        `capture:${block.id}`,
      );
    }
    return block;
  }

  /** Fetch a block, enforcing tenant + space + block-level visibility (§15.2, §8.8). */
  async get(ctx: RequestContext, id: string): Promise<Block> {
    const block = await this.blocks.findOne({ where: { id, tenantId: ctx.tenantId } });
    if (!block || !this.canRead(ctx, block)) {
      // Do not distinguish "forbidden" from "not found" to avoid leaking existence (§15.2).
      throw new NotFoundException('Block not found');
    }
    return block;
  }

  /** Whether the acting user may read a block (space membership + private override). */
  private canRead(ctx: RequestContext, block: Block): boolean {
    if (!ctx.visibleSpaceIds.includes(block.spaceId)) return false;
    if (block.visibility === BlockVisibility.Private && block.ownerUserId !== ctx.userId) {
      return false;
    }
    return true;
  }

  /** List blocks in a space the user can see, honouring private overrides (§8.8). */
  async listInSpace(ctx: RequestContext, spaceId: string): Promise<Block[]> {
    if (!ctx.visibleSpaceIds.includes(spaceId)) return [];
    return this.blocks
      .createQueryBuilder('block')
      .where('block."tenantId" = :tenantId AND block."spaceId" = :spaceId', {
        tenantId: ctx.tenantId,
        spaceId,
      })
      .andWhere('(block."visibility" = :space OR block."ownerUserId" = :uid)', {
        space: BlockVisibility.Space,
        uid: ctx.userId,
      })
      .orderBy('block.position', 'ASC')
      .getMany();
  }

  async tagIdsFor(blockId: string): Promise<string[]> {
    const rows = await this.blockTags.find({ where: { blockId }, select: { tagId: true } });
    return rows.map((r) => r.tagId);
  }

  /** Batched tag-id lookup for many blocks (one query) — avoids N+1 on list endpoints. */
  async tagIdsForMany(blockIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (blockIds.length === 0) return map;
    const rows = await this.blockTags.find({
      where: { blockId: In(blockIds) },
      select: { blockId: true, tagId: true },
    });
    for (const r of rows) {
      const list = map.get(r.blockId) ?? [];
      list.push(r.tagId);
      map.set(r.blockId, list);
    }
    return map;
  }

  async updateContent(ctx: RequestContext, id: string, content: unknown): Promise<Block> {
    const block = await this.get(ctx, id);
    block.content = content;
    block.updatedBy = ctx.userId;
    if (ctx.userId && !block.contributorIds.includes(ctx.userId)) {
      block.contributorIds = [...block.contributorIds, ctx.userId];
    }
    const saved = await this.blocks.save(block);
    await this.enqueueEmbed(ctx.tenantId, id);
    return saved;
  }

  /** Blocks visible to the context, restricted to those in `ids`. Used by traversals (§15.2). */
  async filterVisible(ctx: RequestContext, ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.blocks
      .createQueryBuilder('block')
      .select('block.id', 'id')
      .where(
        'block."tenantId" = :tenantId AND block.id IN (:...ids) AND block."spaceId" IN (:...spaceIds)',
        {
          tenantId: ctx.tenantId,
          ids,
          spaceIds: ctx.visibleSpaceIds,
        },
      )
      .andWhere('(block."visibility" = :space OR block."ownerUserId" = :uid)', {
        space: BlockVisibility.Space,
        uid: ctx.userId,
      })
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  /** Set a block's visibility override (§8.8). Only the owner may make it private. */
  async setVisibility(
    ctx: RequestContext,
    id: string,
    visibility: BlockVisibility,
  ): Promise<Block> {
    const block = await this.get(ctx, id);
    if (visibility === BlockVisibility.Private && block.ownerUserId !== ctx.userId) {
      throw new ForbiddenException('Only the owner can make a block private');
    }
    block.visibility = visibility;
    return this.blocks.save(block);
  }

  /** Set a note's Notion-style header (emoji icon + cover image URL); either may be null to clear. */
  async setHeader(
    ctx: RequestContext,
    id: string,
    patch: { icon?: string | null; coverImageUrl?: string | null },
  ): Promise<Block> {
    const block = await this.get(ctx, id);
    if (patch.icon !== undefined) block.icon = patch.icon;
    if (patch.coverImageUrl !== undefined) block.coverImageUrl = patch.coverImageUrl;
    return this.blocks.save(block);
  }

  /** Clear the review flag after a capture has been triaged (§8.3). */
  async markReviewed(ctx: RequestContext, id: string): Promise<Block> {
    const block = await this.get(ctx, id);
    block.needsReview = false;
    return this.blocks.save(block);
  }

  /**
   * Permanently delete a note and its projected rows (§8.7 — rows/fields/refs/embeddings are
   * projections of the Yjs doc, so they go with it). Permission-checked via {@link get}. Runs in
   * one transaction so a note never half-deletes; the Yjs doc in Redis is orphaned and GC'd by
   * Hocuspocus. Child rows are removed explicitly (no FK cascades in the schema).
   */
  async remove(ctx: RequestContext, id: string): Promise<void> {
    // Enforces tenant + space + visibility; throws NotFound if the caller can't see it.
    await this.get(ctx, id);
    await this.blocks.manager.transaction(async (m) => {
      const t = ctx.tenantId;
      await m.delete('block_tag', { tenantId: t, blockId: id });
      await m.delete('field_value', { tenantId: t, blockId: id });
      await m.delete('block_embedding', { tenantId: t, blockId: id });
      await m.delete('reminder', { tenantId: t, blockId: id });
      await m.delete('user_block_state', { blockId: id });
      await m.delete('block_relation', [
        { tenantId: t, sourceId: id },
        { tenantId: t, targetId: id },
      ]);
      // Re-parent any children to this note's parent so they don't dangle (§6.1).
      const block = await m.findOne(Block, { where: { id, tenantId: t } });
      await m.update(Block, { tenantId: t, parentId: id }, { parentId: block?.parentId ?? null });
      await m.delete(Block, { id, tenantId: t });
    });
  }

  private enqueueEmbed(tenantId: string, blockId: string): Promise<void> {
    // Debounced by blockId so an edit storm collapses to one embed job (§8.7).
    return this.queue.enqueue(QUEUE.Embed, { tenantId, blockId }, `embed:${blockId}`);
  }
}
