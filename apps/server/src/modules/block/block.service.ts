import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateBlockDto, BlockSource } from '@zettra/shared';
import { Block, BlockTag } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { QUEUE, QueueService } from '../jobs/queue.service';

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
  ) {}

  async create(ctx: RequestContext, dto: CreateBlockDto): Promise<Block> {
    if (!ctx.visibleSpaceIds.includes(dto.spaceId)) {
      throw new ForbiddenException('No access to target space');
    }
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

  /** Fetch a block, enforcing tenant + space visibility (§15.2). */
  async get(ctx: RequestContext, id: string): Promise<Block> {
    const block = await this.blocks.findOne({ where: { id, tenantId: ctx.tenantId } });
    if (!block) throw new NotFoundException('Block not found');
    if (!ctx.visibleSpaceIds.includes(block.spaceId)) {
      // Do not distinguish "forbidden" from "not found" to avoid leaking existence (§15.2).
      throw new NotFoundException('Block not found');
    }
    return block;
  }

  /** List blocks in a space the user can see. */
  async listInSpace(ctx: RequestContext, spaceId: string): Promise<Block[]> {
    if (!ctx.visibleSpaceIds.includes(spaceId)) return [];
    return this.blocks.find({
      where: { tenantId: ctx.tenantId, spaceId },
      order: { position: 'ASC' },
    });
  }

  async tagIdsFor(blockId: string): Promise<string[]> {
    const rows = await this.blockTags.find({ where: { blockId }, select: { tagId: true } });
    return rows.map((r) => r.tagId);
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
    const rows = await this.blocks.find({
      where: { tenantId: ctx.tenantId, id: In(ids), spaceId: In(ctx.visibleSpaceIds) },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private enqueueEmbed(tenantId: string, blockId: string): Promise<void> {
    // Debounced by blockId so an edit storm collapses to one embed job (§8.7).
    return this.queue.enqueue(QUEUE.Embed, { tenantId, blockId }, `embed:${blockId}`);
  }
}
