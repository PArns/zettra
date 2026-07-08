import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Row-level tenancy via RLS (§9, §7.6). Defense-in-depth beneath the application-level
 * permission scoping that is the primary gate in v1 (§7.11, §15.2).
 *
 * Each policy isolates rows by `tenantId` against the `app.tenant_id` GUC set per request
 * (see TenantContextService). The policy is intentionally PERMISSIVE WHEN THE GUC IS UNSET
 * so migrations, the seeder, and any not-yet-wired code path keep working; isolation
 * engages as soon as a request sets the GUC. This is the v1 posture — do not treat RLS as
 * the sole tenant boundary until the per-request GUC wiring is enforced everywhere.
 *
 * The model migrates to Citus without a data-model change (§9): distribution by `tenantId`
 * is an ops step, since every table already carries it.
 */
export class Rls1700000000002 implements MigrationInterface {
  name = 'Rls1700000000002';

  // Tables carrying a `tenantId` column (tag_field is covered transitively via its tag).
  private readonly tenantTables = [
    'user',
    'space',
    'membership',
    'block',
    'tag',
    'block_tag',
    'field_value',
    'block_relation',
    'block_embedding',
    'view',
    'approval_policy',
    'user_block_state',
    'notification',
  ];

  private readonly predicate = `(
    current_setting('app.tenant_id', true) IS NULL
    OR current_setting('app.tenant_id', true) = ''
    OR "tenantId" = current_setting('app.tenant_id', true)::uuid
  )`;

  async up(q: QueryRunner): Promise<void> {
    for (const table of this.tenantTables) {
      await q.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      await q.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;`);
      await q.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}";`);
      await q.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
          USING ${this.predicate}
          WITH CHECK ${this.predicate};
      `);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const table of this.tenantTables) {
      await q.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}";`);
      await q.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY;`);
      await q.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY;`);
    }
  }
}
