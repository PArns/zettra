import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `tenant.tier` (free/pro/team). Existing tenants default to `free`. Idempotent. The tier
 * caps members/spaces/blocks/storage, enforced at the create paths by LimitsService (§5).
 */
export class TenantTier1700000000009 implements MigrationInterface {
  name = 'TenantTier1700000000009';

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE "tenant" ADD COLUMN IF NOT EXISTS "tier" text NOT NULL DEFAULT 'free';`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "tenant" DROP COLUMN IF EXISTS "tier";`);
  }
}
