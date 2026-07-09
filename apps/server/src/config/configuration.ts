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
  /** Run OCR on uploaded raster images so their text feeds search + deadline detection (§5/§6). */
  ocrEnabled: boolean;
  /** OCR recognition languages, tesseract codes joined by `+` (e.g. `eng+deu`). */
  ocrLanguages: string;
  /** OCR engine: local `tesseract` (default) or an Ollama `ollama` vision model. */
  ocrBackend: 'tesseract' | 'ollama';
  /** Ollama vision model used when `ocrBackend='ollama'` (e.g. `llama3.2-vision`, `llava`). */
  ocrVisionModel: string;
  /** IMAP capture source (§8.3). Poller stays idle unless `host` is set. */
  imap: ImapConfig | null;
  /** Authentication provider wiring (§2). */
  auth: AuthConfig;
}

export interface OAuthCreds {
  clientId: string;
  clientSecret: string;
}

export interface AuthConfig {
  /**
   * Which auth stack serves `/api/auth/*`. `legacy` is the built-in email+password JWT flow;
   * `better-auth` mounts Better Auth (email+password, Google/Apple social login, admin +
   * organization plugins). Kept behind a flag so the default boot path stays unchanged until an
   * operator opts in with real OAuth credentials.
   */
  provider: 'legacy' | 'better-auth';
  /** Signing secret for Better Auth sessions (falls back to APP_SECRET). */
  secret: string;
  /** Public base URL Better Auth serves from, e.g. https://app.example.com/api/auth. */
  baseURL: string;
  /** Origins allowed to call the auth endpoints (CSRF/redirect allow-list). */
  trustedOrigins: string[];
  /** Google OAuth client — null unless both id + secret are set. */
  google: OAuthCreds | null;
  /** Apple OAuth client — null unless both id + secret are set. */
  apple: OAuthCreds | null;
}

function loadOAuth(idVar: string, secretVar: string): OAuthCreds | null {
  const clientId = process.env[idVar];
  const clientSecret = process.env[secretVar];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function loadAuthConfig(): AuthConfig {
  const appUrl = process.env.APP_URL ?? 'http://localhost:8080';
  const provider = process.env.AUTH_PROVIDER === 'better-auth' ? 'better-auth' : 'legacy';
  return {
    provider,
    secret:
      process.env.BETTER_AUTH_SECRET ?? process.env.APP_SECRET ?? 'dev-insecure-secret-change-me',
    baseURL: process.env.BETTER_AUTH_URL ?? `${appUrl}/api/auth`,
    trustedOrigins: (process.env.AUTH_TRUSTED_ORIGINS ?? appUrl)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    google: loadOAuth('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    apple: loadOAuth('APPLE_CLIENT_ID', 'APPLE_CLIENT_SECRET'),
  };
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
    ocrEnabled: process.env.OCR_ENABLED === 'true',
    ocrLanguages: process.env.OCR_LANGUAGES ?? 'eng+deu',
    ocrBackend: process.env.OCR_BACKEND === 'ollama' ? 'ollama' : 'tesseract',
    ocrVisionModel: process.env.OCR_VISION_MODEL ?? 'llama3.2-vision',
    imap: loadImapConfig(),
    auth: loadAuthConfig(),
  };
}

export const EMBEDDING_DIM = 1024;
