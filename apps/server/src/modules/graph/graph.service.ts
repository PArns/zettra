import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { DocBlock, extractPlainText, RelationStatus } from '@zettra/shared';
import { Block, BlockRelation } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { EmbeddingService } from '../embedding/embedding.service';
import { SimilarityService } from '../embedding/similarity.service';

export interface RelatedResult {
  blockId: string;
  distance: number;
  preview: string;
}

export interface BacklinkResult {
  block: Block;
  kind: string;
  status: string;
  confidence: number | null;
}

/**
 * Smart-connections read surface (§8.4): live "Related" (soft), backlinks (hard-edge
 * traversal), and the suggested-link review queue. Every read is permission-scoped to the
 * acting user's visible spaces (§15.2).
 */
@Injectable()
export class GraphService {
  constructor(
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    @InjectRepository(BlockRelation) private readonly relations: Repository<BlockRelation>,
    private readonly embeddings: EmbeddingService,
    private readonly similarity: SimilarityService,
  ) {}

  /** Live semantic "Related" sidebar (§8.4 layer 2). Embeds on the fly; never stored. */
  async related(ctx: RequestContext, blockId: string): Promise<RelatedResult[]> {
    const block = await this.blocks.findOne({ where: { id: blockId, tenantId: ctx.tenantId } });
    if (!block || !ctx.visibleSpaceIds.includes(block.spaceId)) throw new NotFoundException();
    const text = extractPlainText(toDoc(block.content));
    if (!text) return [];
    const vector = await this.embeddings.embedText(text);
    if (!vector) return [];
    const hits = await this.similarity.related(ctx, blockId, vector);
    if (hits.length === 0) return [];

    const targets = await this.blocks.find({ where: { id: In(hits.map((h) => h.blockId)) } });
    const byId = new Map(targets.map((t) => [t.id, t]));
    return hits.map((h) => ({
      blockId: h.blockId,
      distance: h.distance,
      preview: preview(byId.get(h.blockId)),
    }));
  }

  /** Backlinks: confirmed/suggested hard edges pointing at this block, permission-scoped. */
  async backlinks(ctx: RequestContext, blockId: string): Promise<BacklinkResult[]> {
    const edges = await this.relations.find({
      where: { tenantId: ctx.tenantId, targetId: blockId, status: Not(RelationStatus.Dismissed) },
    });
    if (edges.length === 0) return [];
    const sources = await this.blocks.find({
      where: {
        id: In(edges.map((e) => e.sourceId)),
        spaceId: In(ctx.visibleSpaceIds),
      },
    });
    const byId = new Map(sources.map((s) => [s.id, s]));
    return edges
      .filter((e) => byId.has(e.sourceId))
      .map((e) => ({
        block: byId.get(e.sourceId)!,
        kind: e.kind,
        status: e.status,
        confidence: e.confidence,
      }));
  }

  /** The suggested-link review queue (§8.5). Only edges touching a visible space. */
  async reviewQueue(ctx: RequestContext): Promise<BlockRelation[]> {
    const suggested = await this.relations.find({
      where: { tenantId: ctx.tenantId, status: RelationStatus.Suggested },
    });
    if (suggested.length === 0) return [];
    const ids = new Set(suggested.flatMap((r) => [r.sourceId, r.targetId]));
    const visible = await this.blocks.find({
      where: { id: In([...ids]), spaceId: In(ctx.visibleSpaceIds) },
      select: { id: true },
    });
    const visibleIds = new Set(visible.map((b) => b.id));
    return suggested.filter((r) => visibleIds.has(r.sourceId) && visibleIds.has(r.targetId));
  }
}

function preview(block: Block | undefined): string {
  if (!block) return '';
  return extractPlainText(toDoc(block.content)).slice(0, 140);
}

function toDoc(content: unknown): DocBlock[] {
  return Array.isArray(content) ? (content as DocBlock[]) : [];
}
