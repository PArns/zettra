import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DocBlock, extractPlainText, reciprocalRankFusion } from '@zettra/shared';
import { Block } from '../../entities/index';
import { RequestContext } from '../../common/request-context';
import { EmbeddingService } from '../embedding/embedding.service';

export interface SearchHit {
  blockId: string;
  score: number;
  preview: string;
}

/**
 * Hybrid search (§11): dense pgvector kNN + Postgres full-text (tsvector/GIN), fused with
 * Reciprocal Rank Fusion. Both candidate lists are permission-scoped to the acting user's
 * visible spaces (§15.2). Sparse BGE-M3 vectors are a reserved further seam.
 */
@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    private readonly embeddings: EmbeddingService,
  ) {}

  async search(ctx: RequestContext, query: string, limit = 20): Promise<SearchHit[]> {
    const q = query.trim();
    if (!q || ctx.visibleSpaceIds.length === 0) return [];

    const [dense, fts] = await Promise.all([
      this.denseCandidates(ctx, q),
      this.ftsCandidates(ctx, q),
    ]);

    const fused = reciprocalRankFusion([dense, fts]).slice(0, limit);
    if (fused.length === 0) return [];

    // Second-line tenant scoping on hydration (defense-in-depth, §7.6).
    const blocks = await this.blocks.find({
      where: { tenantId: ctx.tenantId, id: In(fused.map((f) => f.id)) },
    });
    const byId = new Map(blocks.map((b) => [b.id, b]));
    return fused
      .filter((f) => byId.has(f.id))
      .map((f) => ({
        blockId: f.id,
        score: f.score,
        preview: extractPlainText(toDoc(byId.get(f.id)!.content)).slice(0, 160),
      }));
  }

  /** Dense kNN: embed the query, order block ids by cosine distance (permission-scoped). */
  private async denseCandidates(ctx: RequestContext, query: string): Promise<string[]> {
    const vector = await this.embeddings.embedText(query);
    if (!vector) return [];
    const literal = `[${vector.join(',')}]`;
    const rows: Array<{ blockId: string }> = await this.blocks.query(
      `
      SELECT be."blockId" AS "blockId"
      FROM block_embedding be
      JOIN block b ON b.id = be."blockId"
      WHERE b."tenantId" = $1 AND b."spaceId" = ANY($3)
        AND (b."visibility" = 'space' OR b."ownerUserId" = $4)
      GROUP BY be."blockId"
      ORDER BY MIN(be."embedding" <=> $2::vector) ASC
      LIMIT 50
      `,
      [ctx.tenantId, literal, ctx.visibleSpaceIds, ctx.userId],
    );
    return rows.map((r) => r.blockId);
  }

  /** Full-text: rank block ids by ts_rank against the generated tsvector (permission-scoped). */
  private async ftsCandidates(ctx: RequestContext, query: string): Promise<string[]> {
    const rows: Array<{ id: string }> = await this.blocks.query(
      `
      SELECT b.id AS id
      FROM block b
      WHERE b."tenantId" = $1 AND b."spaceId" = ANY($3)
        AND (b."visibility" = 'space' OR b."ownerUserId" = $4)
        AND b."search_tsv" @@ websearch_to_tsquery('simple', $2)
      ORDER BY ts_rank(b."search_tsv", websearch_to_tsquery('simple', $2)) DESC
      LIMIT 50
      `,
      [ctx.tenantId, query, ctx.visibleSpaceIds, ctx.userId],
    );
    return rows.map((r) => r.id);
  }
}

function toDoc(content: unknown): DocBlock[] {
  return Array.isArray(content) ? (content as DocBlock[]) : [];
}
