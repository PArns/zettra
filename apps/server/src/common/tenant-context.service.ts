import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Sets the `app.tenant_id` GUC for a unit of work so the RLS policies (migration 1002)
 * engage. Runs the callback inside a transaction with `SET LOCAL`, which is automatically
 * scoped to that transaction — no leakage across pooled connections.
 *
 * v1 uses this as defense-in-depth; application-level permission scoping (§15.2) is the
 * primary gate. Wiring this around every request path is tracked as a seam.
 */
@Injectable()
export class TenantContextService {
  constructor(private readonly dataSource: DataSource) {}

  async runWithTenant<T>(tenantId: string, fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      // set_config(name, value, is_local=true) is parameterizable, unlike SET LOCAL.
      await manager.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
      return fn(manager);
    });
  }
}
