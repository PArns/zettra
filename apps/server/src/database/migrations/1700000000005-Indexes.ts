import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Index tuning from the schema audit. Adds composites that match real query predicates,
 * a partial index for the hot review-queue poll, a trigram index for `contains` filters,
 * and drops single-column indexes that merely duplicate the leading column of a composite
 * unique index (less write amplification). Idempotent.
 */
export class Indexes1700000000005 implements MigrationInterface {
  name = 'Indexes1700000000005';

  async up(q: QueryRunner): Promise<void> {
    // Trigram support for ILIKE '%…%' (view "contains" filters + entity search).
    await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

    // Review-queue poll: WHERE tenantId = ? AND status = 'suggested' (partial = tiny).
    await q.query(`
      CREATE INDEX IF NOT EXISTS "idx_rel_tenant_suggested"
        ON "block_relation" ("tenantId") WHERE "status" = 'suggested';
    `);

    // Notification list: WHERE userId = ? ORDER BY createdAt DESC LIMIT 50.
    await q.query(`
      CREATE INDEX IF NOT EXISTS "idx_notif_user_created"
        ON "notification" ("userId", "createdAt" DESC);
    `);

    // View filters/sorts always hit a single fieldId's value column → fieldId-leading composites.
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_fv_field_text" ON "field_value" ("fieldId", "valueText");`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_fv_field_number" ON "field_value" ("fieldId", "valueNumber");`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS "idx_fv_field_date" ON "field_value" ("fieldId", "valueDate");`,
    );
    // "contains" (ILIKE substring) needs a trigram GIN — a btree cannot serve it.
    await q.query(`
      CREATE INDEX IF NOT EXISTS "idx_fv_text_trgm"
        ON "field_value" USING gin ("valueText" gin_trgm_ops);
    `);

    // Drop the now-superseded standalone value indexes (replaced by the fieldId composites).
    await q.query(`DROP INDEX IF EXISTS "idx_fv_text";`);
    await q.query(`DROP INDEX IF EXISTS "idx_fv_number";`);
    await q.query(`DROP INDEX IF EXISTS "idx_fv_date";`);

    // Drop single-column indexes duplicating a composite-unique leading column.
    const redundant = [
      'idx_fv_block', // uq_fv_block_field (blockId, fieldId)
      'idx_rel_source', // uq_rel_source_target_field (sourceId, …)
      'idx_blocktag_block', // uq_blocktag_block_tag (blockId, tagId)
      'idx_emb_block', // uq_emb_block_chunk_model (blockId, …)
      'idx_ubs_user', // uq_ubs_user_block (userId, blockId)
      'idx_membership_space', // uq_membership_space_user (spaceId, userId)
      'idx_user_tenant', // uq_user_tenant_email (tenantId, email)
      'idx_tag_tenant', // uq_tag_tenant_name (tenantId, name)
    ];
    for (const idx of redundant) {
      await q.query(`DROP INDEX IF EXISTS "${idx}";`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    // Recreate the dropped single-column indexes.
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_fv_block" ON "field_value" ("blockId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_rel_source" ON "block_relation" ("sourceId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_blocktag_block" ON "block_tag" ("blockId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_emb_block" ON "block_embedding" ("blockId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_ubs_user" ON "user_block_state" ("userId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_membership_space" ON "membership" ("spaceId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_user_tenant" ON "user" ("tenantId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_tag_tenant" ON "tag" ("tenantId");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_fv_text" ON "field_value" ("valueText");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_fv_number" ON "field_value" ("valueNumber");`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_fv_date" ON "field_value" ("valueDate");`);

    await q.query(`DROP INDEX IF EXISTS "idx_fv_text_trgm";`);
    await q.query(`DROP INDEX IF EXISTS "idx_fv_field_date";`);
    await q.query(`DROP INDEX IF EXISTS "idx_fv_field_number";`);
    await q.query(`DROP INDEX IF EXISTS "idx_fv_field_text";`);
    await q.query(`DROP INDEX IF EXISTS "idx_notif_user_created";`);
    await q.query(`DROP INDEX IF EXISTS "idx_rel_tenant_suggested";`);
  }
}
