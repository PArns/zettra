import { MigrationInterface, QueryRunner } from 'typeorm';

/** Notion-style note headers (§4): an emoji icon + a cover image URL per block. */
export class NoteHeader1700000000013 implements MigrationInterface {
  name = 'NoteHeader1700000000013';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "icon" text;`);
    await q.query(`ALTER TABLE "block" ADD COLUMN IF NOT EXISTS "coverImageUrl" text;`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "block" DROP COLUMN IF EXISTS "coverImageUrl";`);
    await q.query(`ALTER TABLE "block" DROP COLUMN IF EXISTS "icon";`);
  }
}
