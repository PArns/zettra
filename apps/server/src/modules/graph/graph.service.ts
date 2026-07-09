import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { BlockVisibility, DocBlock, extractPlainText, RelationStatus } from '@zettra/shared';
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
    if (!block || !this.visible(ctx, block)) throw new NotFoundException();
    const text = extractPlainText(toDoc(block.content));
    if (!text) return [];
    const vector = await this.embeddings.embedText(text);
    if (!vector) return [];
    const hits = await this.similarity.related(ctx, blockId, vector);
    if (hits.length === 0) return [];

    // Second-line tenant scoping on hydration (defense-in-depth, §7.6).
    const targets = await this.blocks.find({
      where: { tenantId: ctx.tenantId, id: In(hits.map((h) => h.blockId)) },
    });
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
    const byId = new Map(sources.filter((s) => this.visible(ctx, s)).map((s) => [s.id, s]));
    return edges
      .filter((e) => byId.has(e.sourceId))
      .map((e) => ({
        block: byId.get(e.sourceId)!,
        kind: e.kind,
        status: e.status,
        confidence: e.confidence,
      }));
  }

  /** App-level visibility check for secondary reads (§8.8). */
  private visible(ctx: RequestContext, block: Block): boolean {
    if (!ctx.visibleSpaceIds.includes(block.spaceId)) return false;
    return block.visibility !== BlockVisibility.Private || block.ownerUserId === ctx.userId;
  }

  /**
   * Dismiss-rate per confidence bucket (§8.5 calibration, §11). The observability signal for
   * auto-linking quality: feed the review queue's confirm/dismiss decisions back to measure
   * how well the curation confidence is calibrated.
   */
  async linkQualityBuckets(
    ctx: RequestContext,
  ): Promise<Array<{ bucket: string; confirmed: number; dismissed: number; dismissRate: number }>> {
    const rows: Array<{ bucket: number; status: string; n: string }> = await this.relations.query(
      `
      SELECT floor(least(confidence, 0.999) * 10) AS bucket, status, count(*) AS n
      FROM block_relation
      WHERE "tenantId" = $1 AND confidence IS NOT NULL AND status IN ('confirmed','dismissed')
      GROUP BY bucket, status
      ORDER BY bucket
      `,
      [ctx.tenantId],
    );
    const buckets = new Map<number, { confirmed: number; dismissed: number }>();
    for (const r of rows) {
      const b = buckets.get(Number(r.bucket)) ?? { confirmed: 0, dismissed: 0 };
      if (r.status === 'confirmed') b.confirmed += Number(r.n);
      else b.dismissed += Number(r.n);
      buckets.set(Number(r.bucket), b);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([b, v]) => {
        const total = v.confirmed + v.dismissed;
        const lo = (b / 10).toFixed(1);
        const hi = ((b + 1) / 10).toFixed(1);
        return {
          bucket: `${lo}–${hi}`,
          confirmed: v.confirmed,
          dismissed: v.dismissed,
          dismissRate: total ? v.dismissed / total : 0,
        };
      });
  }

  /** The suggested-link review queue (§8.5). Only edges touching a visible space. */
  async reviewQueue(ctx: RequestContext): Promise<BlockRelation[]> {
    const suggested = await this.relations.find({
      where: { tenantId: ctx.tenantId, status: RelationStatus.Suggested },
    });
    if (suggested.length === 0) return [];
    const ids = new Set(suggested.flatMap((r) => [r.sourceId, r.targetId]));
    const candidates = await this.blocks.find({
      where: { id: In([...ids]), spaceId: In(ctx.visibleSpaceIds) },
    });
    const visibleIds = new Set(candidates.filter((b) => this.visible(ctx, b)).map((b) => b.id));
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
