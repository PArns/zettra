import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `user.settings` (jsonb) for per-user preferences — theme mode + accent palette today,
 * extensible later. Idempotent. Client-owned blob; the server only stores and returns it.
 */
export class UserSettings1700000000008 implements MigrationInterface {
  name = 'UserSettings1700000000008';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}'::jsonb;`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "settings";`);
  }
}
