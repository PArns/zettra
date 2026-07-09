import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RelatedBlockDto } from '@zettra/shared';
import { RequestContext } from '../../common/request-context';
import { overfetchLimit } from './similarity-overfetch';

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

    // HNSW-accelerated overfetch (§8.4): the `candidate` CTE asks the vector index for the nearest
    // `$8` embeddings *within the acting user's permission scope* (tenant + visible spaces +
    // block-level visibility, all inside the CTE so nothing outside it can surface — invariant 11),
    // ordered by ANN distance so the HNSW index can serve the ORDER BY … LIMIT. The outer query
    // then collapses multi-chunk blocks (MIN per block), drops already-linked blocks, and applies
    // the distance cut. Recall is exact whenever the tenant's visible embeddings fit in the
    // candidate set (`overfetchLimit(limit)`), which is the common case; only very large tenants
    // trade a little recall for the index speed-up. NOTE: for the index to actually serve the
    // overfetch under filtering on huge tenants, tune `hnsw.ef_search` / enable iterative scan
    // (pgvector ≥ 0.8) at the DB — an ops step; correctness/permissions do not depend on it.
    const candidates = overfetchLimit(limit);
    const rows: Array<{ blockId: string; distance: number }> = await this.dataSource.query(
      `
      WITH candidate AS (
        SELECT be."blockId" AS "blockId", (be."embedding" <=> $1::vector) AS distance
        FROM block_embedding be
        JOIN block b ON b.id = be."blockId"
        WHERE b."tenantId" = $2
          AND b."spaceId" = ANY($6)               -- §15.2 permission scoping
          AND (b."visibility" = 'space' OR b."ownerUserId" = $7)  -- §8.8/§11 block-level
          AND be."blockId" <> $3
        ORDER BY be."embedding" <=> $1::vector      -- HNSW-servable
        LIMIT $8
      )
      SELECT "blockId", MIN(distance) AS distance
      FROM candidate
      WHERE "blockId" NOT IN (
        SELECT "targetId" FROM block_relation WHERE "sourceId" = $3 AND status <> 'dismissed'
        UNION
        SELECT "sourceId" FROM block_relation WHERE "targetId" = $3 AND status <> 'dismissed'
      )
      GROUP BY "blockId"
      HAVING MIN(distance) < $4
      ORDER BY distance ASC
      LIMIT $5
      `,
      [
        vectorLiteral,
        ctx.tenantId,
        blockId,
        maxDistance,
        limit,
        ctx.visibleSpaceIds,
        ctx.userId,
        candidates,
      ],
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
    // Same permission-safe HNSW overfetch as {@link related}: the index serves the ANN ORDER BY
    // inside the scoped `candidate` CTE, then blocks are collapsed (MIN per block) and cut to k.
    const candidates = overfetchLimit(limit);
    const rows: Array<{ blockId: string; distance: number }> = await this.dataSource.query(
      `
      WITH candidate AS (
        SELECT be."blockId" AS "blockId", (be."embedding" <=> $1::vector) AS distance
        FROM block_embedding be
        JOIN block b ON b.id = be."blockId"
        WHERE b."tenantId" = $2
          AND b."spaceId" = ANY($3)
          AND (b."visibility" = 'space' OR b."ownerUserId" = $4)
        ORDER BY be."embedding" <=> $1::vector
        LIMIT $6
      )
      SELECT "blockId", MIN(distance) AS distance
      FROM candidate
      GROUP BY "blockId"
      ORDER BY distance ASC
      LIMIT $5
      `,
      [vectorLiteral, ctx.tenantId, spaces, ctx.userId, limit, candidates],
    );
    return rows.map((r) => ({ blockId: r.blockId, distance: Number(r.distance) }));
  }
}
