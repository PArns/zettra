/** Collab process configuration (§13.5). Coordinates with the API through Redis + HTTP. */
export interface CollabConfig {
  port: number;
  redisUrl: string;
  appSecret: string;
  /** Base URL of the API for the internal sync callback (§8.7). */
  serverInternalUrl: string;
  /** Debounce window before projecting a settled doc to rows (§8.7). */
  persistDebounceMs: number;
}

export function loadCollabConfig(): CollabConfig {
  return {
    port: Number(process.env.COLLAB_PORT ?? 1234),
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    appSecret: process.env.APP_SECRET ?? 'dev-insecure-secret-change-me',
    serverInternalUrl: process.env.SERVER_INTERNAL_URL ?? 'http://localhost:3000',
    persistDebounceMs: Number(process.env.PERSIST_DEBOUNCE_MS ?? 2000),
  };
}
