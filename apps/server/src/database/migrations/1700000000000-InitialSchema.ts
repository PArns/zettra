import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema (§6). Hand-authored raw SQL so it is idempotent (§13.3) and does not
 * depend on a live DB to generate. Column identifiers are quoted camelCase to match the
 * entity property names and the spec's reference SQL (e.g. "tenantId").
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  private readonly enums: Array<[string, string[]]> = [
    ['block_source_enum', ['manual', 'email', 'upload', 'web_clip', 'voice']],
    [
      'field_type_enum',
      [
        'text',
        'number',
        'date',
        'checkbox',
        'select',
        'multi_select',
        'relation',
        'user',
        'url',
        'file',
      ],
    ],
    ['relation_kind_enum', ['mention', 'relation', 'suggested']],
    ['relation_status_enum', ['confirmed', 'suggested', 'dismissed']],
    ['view_layout_enum', ['table', 'board', 'calendar', 'list', 'gallery']],
    ['membership_role_enum', ['viewer', 'commenter', 'editor', 'owner']],
    ['policy_scope_enum', ['system', 'user', 'space']],
  ];

  async up(q: QueryRunner): Promise<void> {
    for (const [name, values] of this.enums) {
      const labels = values.map((v) => `'${v}'`).join(', ');
      await q.query(
        `DO $$ BEGIN CREATE TYPE ${name} AS ENUM (${labels}); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
      );
    }

    await q.query(`
      CREATE TABLE IF NOT EXISTS "tenant" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "email" text NOT NULL,
        "displayName" text,
        "passwordHash" text,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_user_tenant" ON "user" ("tenantId");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_tenant_email" ON "user" ("tenantId", "email");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "space" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" text NOT NULL,
        "aiPolicy" text NOT NULL DEFAULT 'default',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_space_tenant" ON "space" ("tenantId");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "membership" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "spaceId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" membership_role_enum NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_membership_tenant" ON "membership" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_membership_space" ON "membership" ("spaceId");
      CREATE INDEX IF NOT EXISTS "idx_membership_user" ON "membership" ("userId");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_membership_space_user" ON "membership" ("spaceId", "userId");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "block" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "spaceId" uuid NOT NULL,
        "parentId" uuid,
        "position" text NOT NULL DEFAULT 'a0',
        "content" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "source" block_source_enum NOT NULL DEFAULT 'manual',
        "sourceRef" text,
        "ownerUserId" uuid,
        "createdBy" uuid,
        "updatedBy" uuid,
        "contributorIds" uuid[] NOT NULL DEFAULT '{}',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_block_tenant" ON "block" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_block_space" ON "block" ("spaceId");
      CREATE INDEX IF NOT EXISTS "idx_block_parent" ON "block" ("parentId");
      CREATE INDEX IF NOT EXISTS "idx_block_owner" ON "block" ("ownerUserId");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_block_tenant_sourceref"
        ON "block" ("tenantId", "sourceRef") WHERE "sourceRef" IS NOT NULL;
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "tag" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" text NOT NULL,
        "extendsId" uuid,
        "icon" text,
        "color" text,
        "defaultViewId" uuid
      );
      CREATE INDEX IF NOT EXISTS "idx_tag_tenant" ON "tag" ("tenantId");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_tag_tenant_name" ON "tag" ("tenantId", "name");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "tag_field" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tagId" uuid NOT NULL,
        "name" text NOT NULL,
        "type" field_type_enum NOT NULL,
        "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "position" int NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS "idx_tagfield_tag" ON "tag_field" ("tagId");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "block_tag" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "blockId" uuid NOT NULL,
        "tagId" uuid NOT NULL,
        "createdBy" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_blocktag_tenant" ON "block_tag" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_blocktag_block" ON "block_tag" ("blockId");
      CREATE INDEX IF NOT EXISTS "idx_blocktag_tag" ON "block_tag" ("tagId");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_blocktag_block_tag" ON "block_tag" ("blockId", "tagId");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "field_value" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "blockId" uuid NOT NULL,
        "fieldId" uuid NOT NULL,
        "valueText" text,
        "valueNumber" numeric,
        "valueDate" timestamptz,
        "valueBool" boolean,
        "valueJson" jsonb,
        "updatedBy" uuid,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_fv_tenant" ON "field_value" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_fv_block" ON "field_value" ("blockId");
      CREATE INDEX IF NOT EXISTS "idx_fv_field" ON "field_value" ("fieldId");
      CREATE INDEX IF NOT EXISTS "idx_fv_text" ON "field_value" ("valueText");
      CREATE INDEX IF NOT EXISTS "idx_fv_number" ON "field_value" ("valueNumber");
      CREATE INDEX IF NOT EXISTS "idx_fv_date" ON "field_value" ("valueDate");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_fv_block_field" ON "field_value" ("blockId", "fieldId");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "block_relation" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "sourceId" uuid NOT NULL,
        "targetId" uuid NOT NULL,
        "fieldId" uuid,
        "kind" relation_kind_enum NOT NULL,
        "status" relation_status_enum NOT NULL DEFAULT 'confirmed',
        "confidence" real,
        "approvedBy" text,
        "approvedAt" timestamptz
      );
      CREATE INDEX IF NOT EXISTS "idx_rel_tenant" ON "block_relation" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_rel_source" ON "block_relation" ("sourceId");
      CREATE INDEX IF NOT EXISTS "idx_rel_target" ON "block_relation" ("targetId");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_rel_source_target_field"
        ON "block_relation" ("sourceId", "targetId", COALESCE("fieldId", '00000000-0000-0000-0000-000000000000'::uuid));
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "block_embedding" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "blockId" uuid NOT NULL,
        "chunkIndex" int NOT NULL DEFAULT 0,
        "model" text NOT NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_emb_tenant" ON "block_embedding" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_emb_block" ON "block_embedding" ("blockId");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_emb_block_chunk_model"
        ON "block_embedding" ("blockId", "chunkIndex", "model");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "view" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "spaceId" uuid,
        "name" text NOT NULL,
        "tagId" uuid,
        "layout" view_layout_enum NOT NULL DEFAULT 'table',
        "filters" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "sorts" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "groupBy" uuid,
        "ownerUserId" uuid
      );
      CREATE INDEX IF NOT EXISTS "idx_view_tenant" ON "view" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_view_space" ON "view" ("spaceId");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "approval_policy" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "scope" policy_scope_enum NOT NULL,
        "scopeId" uuid,
        "autoApprove" real NOT NULL DEFAULT 0.9,
        "suggest" real NOT NULL DEFAULT 0.5
      );
      CREATE INDEX IF NOT EXISTS "idx_policy_tenant" ON "approval_policy" ("tenantId");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_policy_scope"
        ON "approval_policy" ("tenantId", "scope", COALESCE("scopeId", '00000000-0000-0000-0000-000000000000'::uuid));
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "user_block_state" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "blockId" uuid NOT NULL,
        "read" boolean NOT NULL DEFAULT false,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_ubs_tenant" ON "user_block_state" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_ubs_user" ON "user_block_state" ("userId");
      CREATE INDEX IF NOT EXISTS "idx_ubs_block" ON "user_block_state" ("blockId");
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ubs_user_block" ON "user_block_state" ("userId", "blockId");
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS "notification" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "kind" text NOT NULL,
        "sourceBlockId" uuid,
        "read" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS "idx_notif_tenant" ON "notification" ("tenantId");
      CREATE INDEX IF NOT EXISTS "idx_notif_user" ON "notification" ("userId");
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    const tables = [
      'notification',
      'user_block_state',
      'approval_policy',
      'view',
      'block_embedding',
      'block_relation',
      'field_value',
      'block_tag',
      'tag_field',
      'tag',
      'block',
      'membership',
      'space',
      'user',
      'tenant',
    ];
    for (const t of tables) {
      await q.query(`DROP TABLE IF EXISTS "${t}" CASCADE;`);
    }
    for (const [name] of this.enums) {
      await q.query(`DROP TYPE IF EXISTS ${name};`);
    }
  }
}
