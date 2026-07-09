import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `user.role` (admin/member). Existing users default to `member`; the tenant creator is set
 * to `admin` at provisioning. Gates the admin console (user + space management, impersonation).
 * Idempotent.
 */
export class UserRole1700000000010 implements MigrationInterface {
  name = 'UserRole1700000000010';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'member';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "role";`);
  }
}
