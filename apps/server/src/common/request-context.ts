import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The acting principal for the current request. Every tenant-scoped service reads from this
 * rather than trusting caller-supplied ids (§12: "every service method that touches tenant
 * data takes/enforces tenantId").
 */
export interface RequestContext {
  tenantId: string;
  userId: string | null;
  /**
   * Space ids the acting user may read. Populated by the permission layer (§15.2) and used
   * to scope EVERY read path — views, inbox, similarity, backlinks, alias index, curation.
   */
  visibleSpaceIds: string[];
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** Returns the current context or throws — call only inside a request scope. */
export function requireContext(): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error('No request context — a tenant-scoped operation ran outside a request.');
  }
  return ctx;
}

/** Returns the current context or undefined (for code that may run out of request scope). */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}
