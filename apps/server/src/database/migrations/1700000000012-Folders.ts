import { MigrationInterface, QueryRunner } from 'typeorm';

/** Note folders (§8.2): a `folder` tree + `block.folderId` to file notes out of the Briefkasten. */
export class Folders1700000000012 implements MigrationInterface {
  name = 'Folders1700000000012';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "folder" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "spaceId" uuid NOT NULL,
        "name" text NOT NULL,
        "parentId" uuid,
        "position" integer NOT NULL DEFAULT 0,
        "ownerUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_folder" PRIMARY KEY ("id")
      );
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_folder_tenant" ON "folder" ("tenantId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_folder_space" ON "folder" ("spaceId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_folder_parent" ON "folder" ("parentId");`);
    await q.query(`ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "folderId" uuid;`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_block_folder" ON "block" ("folderId");`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_block_folder";`);
    await q.query(`ALTER TABLE "block" DROP COLUMN IF EXISTS "folderId";`);
    await q.query(`DROP TABLE IF EXISTS "folder";`);
  }
}
