import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * pgvector migration (§6.2). Requires the `pgvector/pgvector:pg16` image (§13.2) — this
 * fails on stock Postgres. Idempotent so it is safe to re-run on every boot (§13.3).
 */
export class Vector1700000000001 implements MigrationInterface {
  name = 'Vector1700000000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // Add the vector column if the initial migration created the table without it.
    await q.query(`
      ALTER TABLE "block_embedding"
        ADD COLUMN IF NOT EXISTS "embedding" vector(1024);
    `);

    // HNSW: faster queries + better recall than IVFFlat, slower build. Worth it here (§6.2).
    await q.query(`
      CREATE INDEX IF NOT EXISTS "block_embedding_hnsw"
        ON "block_embedding" USING hnsw ("embedding" vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "block_embedding_hnsw";`);
    await q.query(`ALTER TABLE "block_embedding" DROP COLUMN IF EXISTS "embedding";`);
    // Leave the extension in place; other objects may depend on it.
  }
}
