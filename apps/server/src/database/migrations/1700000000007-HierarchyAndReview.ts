import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two additions (idempotent):
 *  - `tag.parentId` — an organizational folder/tree parent, distinct from `extendsId`
 *    inheritance, so tags form a Zettelkasten-style folder tree.
 *  - `block.needsReview` — flags a captured block that could not be confidently auto-tagged so
 *    it surfaces in the "For Review" bucket (§8.3). Partial index for the common `= true` scan.
 */
export class HierarchyAndReview1700000000007 implements MigrationInterface {
  name = 'HierarchyAndReview1700000000007';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "tag" ADD COLUMN IF NOT EXISTS "parentId" uuid;`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_tag_parent" ON "tag" ("tenantId", "parentId");`);

    await q.query(
      `ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "needsReview" boolean NOT NULL DEFAULT false;`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_block_needs_review" ON "block" ("tenantId", "ownerUserId") WHERE "needsReview" = true;`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_block_needs_review";`);
    await q.query(`ALTER TABLE "block" DROP COLUMN IF EXISTS "needsReview";`);
    await q.query(`DROP INDEX IF EXISTS "idx_tag_parent";`);
    await q.query(`ALTER TABLE "tag" DROP COLUMN IF EXISTS "parentId";`);
  }
}
