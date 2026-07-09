import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RelatedBlockDto } from '@zettra/shared';
import { RequestContext } from '../../common/request-context';

/**
 * Soft connections (§8.4 layer 2). Live cosine kNN over `block_embedding` — NEVER stored
 * (invariant 3). This query is additionally filtered by the acting user's visible spaces
 * (§8.4 note, §15.2): as written in the spec it is only tenant-scoped and would leak the
 * existence and content of blocks in spaces the user cannot access.
 */
@Injectable()
export class SimilarityService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Related blocks for `blockId`, excluding blocks already hard-linked (any non-dismissed
   * relation, either direction). `maxDistance` is the main tuning knob and is per-tenant
   * configurable (~0.35).
   */
  async related(
    ctx: RequestContext,
    blockId: string,
    queryEmbedding: number[],
    maxDistance = 0.35,
    limit = 10,
  ): Promise<RelatedBlockDto[]> {
    if (ctx.visibleSpaceIds.length === 0) return [];
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    // Exact cosine over the tenant's visible embeddings (the join to `block` filters by
    // tenant/space/visibility first, so this is O(tenant's blocks), not global). Correct
    // recall within the tenant is preferred over HNSW acceleration here.
    // SPEC-GAP: for very large tenants, switch to an HNSW-accelerated overfetch candidate
    // set (or pgvector iterative-scan) wrapped by this permission filter.
    const rows: Array<{ blockId: string; distance: number }> = await this.dataSource.query(
      `
      SELECT be."blockId" AS "blockId", MIN(be."embedding" <=> $1::vector) AS distance
      FROM block_embedding be
      JOIN block b ON b.id = be."blockId"
      WHERE b."tenantId" = $2
        AND b."spaceId" = ANY($6)               -- §15.2 permission scoping
        AND (b."visibility" = 'space' OR b."ownerUserId" = $7)  -- §8.8/§11 block-level
        AND be."blockId" <> $3
        AND be."blockId" NOT IN (
          SELECT "targetId" FROM block_relation WHERE "sourceId" = $3 AND status <> 'dismissed'
          UNION
          SELECT "sourceId" FROM block_relation WHERE "targetId" = $3 AND status <> 'dismissed'
        )
      GROUP BY be."blockId"
      HAVING MIN(be."embedding" <=> $1::vector) < $4
      ORDER BY distance ASC
      LIMIT $5
      `,
      [vectorLiteral, ctx.tenantId, blockId, maxDistance, limit, ctx.visibleSpaceIds, ctx.userId],
    );

    return rows.map((r) => ({ blockId: r.blockId, distance: Number(r.distance) }));
  }

  /**
   * Top-k nearest blocks to an arbitrary query embedding (for AI chat / semantic answer, §1).
   * Same permission scoping as {@link related} (§15.2): visible spaces + block-level visibility.
   * Optionally restricted to a single space.
   */
  async search(
    ctx: RequestContext,
    queryEmbedding: number[],
    limit = 8,
    spaceId?: string,
  ): Promise<RelatedBlockDto[]> {
    if (ctx.visibleSpaceIds.length === 0) return [];
    const spaces = spaceId
      ? [spaceId].filter((s) => ctx.visibleSpaceIds.includes(s))
      : ctx.visibleSpaceIds;
    if (spaces.length === 0) return [];
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    const rows: Array<{ blockId: string; distance: number }> = await this.dataSource.query(
      `
      SELECT be."blockId" AS "blockId", MIN(be."embedding" <=> $1::vector) AS distance
      FROM block_embedding be
      JOIN block b ON b.id = be."blockId"
      WHERE b."tenantId" = $2
        AND b."spaceId" = ANY($3)
        AND (b."visibility" = 'space' OR b."ownerUserId" = $4)
      GROUP BY be."blockId"
      ORDER BY distance ASC
      LIMIT $5
      `,
      [vectorLiteral, ctx.tenantId, spaces, ctx.userId, limit],
    );
    return rows.map((r) => ({ blockId: r.blockId, distance: Number(r.distance) }));
  }
}
