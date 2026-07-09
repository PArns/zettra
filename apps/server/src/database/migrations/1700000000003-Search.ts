import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Full-text search column for hybrid search (§11). Adds `searchText` (maintained by the embed
 * worker) plus a generated `search_tsv tsvector` and a GIN index. The dense half is pgvector
 * (migration 1001); a search endpoint fuses the two with Reciprocal Rank Fusion. Idempotent.
 */
export class Search1700000000003 implements MigrationInterface {
  name = 'Search1700000000003';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "searchText" text;`);
    await q.query(`
      ALTER TABLE "block"
        ADD COLUMN IF NOT EXISTS "search_tsv" tsvector
        GENERATED ALWAYS AS (to_tsvector('simple', coalesce("searchText", ''))) STORED;
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "block_search_tsv_gin" ON "block" USING gin ("search_tsv");`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "block_search_tsv_gin";`);
    await q.query(`ALTER TABLE "block" DROP COLUMN IF EXISTS "search_tsv";`);
    await q.query(`ALTER TABLE "block" DROP COLUMN IF EXISTS "searchText";`);
  }
}
