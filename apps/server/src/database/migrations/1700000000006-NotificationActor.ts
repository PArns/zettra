import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `notification.actorUserId` (§15.6) so notifications can name who triggered them
 * ("Alex mentioned you") instead of a generic message. Nullable for system events. Idempotent.
 */
export class NotificationActor1700000000006 implements MigrationInterface {
  name = 'NotificationActor1700000000006';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "actorUserId" uuid;`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "notification" DROP COLUMN IF EXISTS "actorUserId";`);
  }
}
