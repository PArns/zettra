/** Typed configuration loaded from environment (see .env.example). */
export interface AppConfig {
  port: number;
  appUrl: string;
  appSecret: string;
  databaseUrl: string;
  redisUrl: string;
  ollamaUrl: string;
  embeddingModel: string;
  llmModel: string;
  anthropicApiKey: string | undefined;
  /** Directory where uploaded files are stored (§8.3 upload source). Mount a volume in prod. */
  uploadDir: string;
  /** Whether this process runs the in-process BullMQ workers (§8) alongside the API. */
  runWorkers: boolean;
  /** IMAP capture source (§8.3). Poller stays idle unless `host` is set. */
  imap: ImapConfig | null;
}

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  pollIntervalMs: number;
  /** Which tenant/space/owner captured emails land in (per-mailbox mapping for v1). */
  tenantId: string;
  spaceId: string;
  ownerUserId: string;
}

function loadImapConfig(): ImapConfig | null {
  const host = process.env.IMAP_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.IMAP_PORT ?? 993),
    secure: (process.env.IMAP_TLS ?? 'true') !== 'false',
    user: process.env.IMAP_USER ?? '',
    password: process.env.IMAP_PASSWORD ?? '',
    pollIntervalMs: Number(process.env.IMAP_POLL_INTERVAL_MS ?? 60_000),
    tenantId: process.env.IMAP_TENANT_ID ?? '',
    spaceId: process.env.IMAP_SPACE_ID ?? '',
    ownerUserId: process.env.IMAP_OWNER_USER_ID ?? '',
  };
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    appUrl: process.env.APP_URL ?? 'http://localhost:8080',
    // In non-prod the secret has a dev default so the app boots; production must set it.
    appSecret: required('APP_SECRET', 'dev-insecure-secret-change-me'),
    databaseUrl: required(
      'DATABASE_URL',
      'postgresql://zettra:change_me@localhost:5432/zettra?schema=public',
    ),
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    embeddingModel: process.env.EMBEDDING_MODEL ?? 'bge-m3',
    llmModel: process.env.LLM_MODEL ?? 'qwen3.6',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    uploadDir: process.env.UPLOAD_DIR ?? '/data/uploads',
    runWorkers: (process.env.RUN_WORKERS ?? 'true') !== 'false',
    imap: loadImapConfig(),
  };
}

export const EMBEDDING_DIM = 1024;
