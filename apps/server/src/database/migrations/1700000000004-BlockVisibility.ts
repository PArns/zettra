import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Block-level permission override (§8.8, §11). `visibility='private'` restricts a block to its
 * owner regardless of space membership; `space` (default) follows space roles. Enforced at the
 * query layer across read paths (§15.2). Idempotent.
 */
export class BlockVisibility1700000000004 implements MigrationInterface {
  name = 'BlockVisibility1700000000004';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "visibility" text NOT NULL DEFAULT 'space';`,
    );
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_block_visibility" ON "block" ("visibility");`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_block_visibility";`);
    await q.query(`ALTER TABLE "block" DROP COLUMN IF EXISTS "visibility";`);
  }
}
