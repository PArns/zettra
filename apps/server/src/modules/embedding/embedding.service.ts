import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { loadConfig, EMBEDDING_DIM } from '../../config/configuration';

/**
 * Local embeddings via Ollama `bge-m3` (§8.4 layer 2). The embed worker (later phase) calls
 * `embedText` then `upsertEmbedding`. Vector I/O uses parameterized raw SQL with a `::vector`
 * cast since TypeORM has no vector type (§6.1). The worker no-ops gracefully if the model is
 * not present yet (§13.3).
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly baseUrl = loadConfig().ollamaUrl;
  private readonly model = loadConfig().embeddingModel;

  constructor(private readonly dataSource: DataSource) {}

  /** Returns the embedding vector, or null if the model/endpoint is unavailable. */
  async embedText(text: string): Promise<number[] | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });
      if (!res.ok) {
        this.logger.warn(`Embedding endpoint returned ${res.status}; skipping`);
        return null;
      }
      const json = (await res.json()) as { embedding?: number[] };
      const vec = json.embedding;
      if (!vec || vec.length !== EMBEDDING_DIM) {
        this.logger.warn(`Unexpected embedding length ${vec?.length ?? 0}; skipping`);
        return null;
      }
      return vec;
    } catch (err) {
      this.logger.warn(`Embedding failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Replace all chunk embeddings for a block+model (handles shrinking content). */
  async replaceForBlock(tenantId: string, blockId: string, vectors: number[][]): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM block_embedding WHERE "blockId" = $1 AND "model" = $2`,
      [blockId, this.model],
    );
    for (let i = 0; i < vectors.length; i++) {
      await this.upsertEmbedding(tenantId, blockId, i, vectors[i]!);
    }
  }

  /** Upsert one chunk embedding, keyed on (blockId, chunkIndex, model). Idempotent (§12). */
  async upsertEmbedding(
    tenantId: string,
    blockId: string,
    chunkIndex: number,
    embedding: number[],
  ): Promise<void> {
    const literal = `[${embedding.join(',')}]`;
    await this.dataSource.query(
      `
      INSERT INTO block_embedding ("tenantId", "blockId", "chunkIndex", "model", "embedding", "updatedAt")
      VALUES ($1, $2, $3, $4, $5::vector, now())
      ON CONFLICT ("blockId", "chunkIndex", "model")
      DO UPDATE SET "embedding" = EXCLUDED."embedding", "updatedAt" = now()
      `,
      [tenantId, blockId, chunkIndex, this.model, literal],
    );
  }
}
