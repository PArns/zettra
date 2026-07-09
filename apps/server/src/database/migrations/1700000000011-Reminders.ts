import { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates the `reminder` table (§3–§4): per-block reminders / Wiedervorlage. Idempotent. */
export class Reminders1700000000011 implements MigrationInterface {
  name = 'Reminders1700000000011';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "reminder" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "blockId" uuid NOT NULL,
        "userId" uuid,
        "remindAt" timestamptz NOT NULL,
        "note" text,
        "status" text NOT NULL DEFAULT 'pending',
        "notifiedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reminder" PRIMARY KEY ("id")
      );
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_reminder_tenant" ON "reminder" ("tenantId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_reminder_block" ON "reminder" ("blockId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_reminder_at" ON "reminder" ("remindAt");`);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_reminder_scan" ON "reminder" ("tenantId", "userId", "status", "remindAt");`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "reminder";`);
  }
}
