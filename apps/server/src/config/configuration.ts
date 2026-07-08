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
  };
}

export const EMBEDDING_DIM = 1024;
