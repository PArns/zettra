import { AiChatMessage } from '@zettra/shared';

/**
 * Provider-agnostic AI interface (§14.3). Implementations: OllamaProvider (local) and
 * AnthropicProvider (remote). All generative calls go through the AiRouter, never a provider
 * directly.
 */
export interface StructuredRequest<T> {
  messages: AiChatMessage[];
  /** JSON schema the response must satisfy; validation failure is the hard escalation signal (§14.5). */
  schema: Record<string, unknown>;
  /** Parses+validates the raw model output; throws on schema mismatch. */
  parse: (raw: string) => T;
}

export interface AiProvider {
  readonly kind: 'local' | 'remote';
  chat(messages: AiChatMessage[]): Promise<string>;
  structured<T>(req: StructuredRequest<T>): Promise<T>;
  /** Cheap liveness probe used for the availability escalation axis (§14.2 axis 3c). */
  isAvailable(): Promise<boolean>;
}

export const LOCAL_PROVIDER = Symbol('LOCAL_PROVIDER');
export const REMOTE_PROVIDER = Symbol('REMOTE_PROVIDER');
