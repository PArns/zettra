/**
 * AI routing contracts (§14). Every generative/reasoning call goes through the AiRouter
 * with a descriptor — never a provider directly. `resolveProvider` is a pure function of
 * this descriptor (§14.3) and is unit-tested (§12).
 */
import { AiPrivacyScope, AiProviderKind, AiStakes, AiTaskType } from './enums';

/** The request-level descriptor the AiRouter resolves against policy (§14.3). */
export interface AiTaskDescriptor {
  type: AiTaskType;
  /** Privacy posture of the acting scope (space/tag). `local_only` is a hard gate. */
  privacyScope: AiPrivacyScope;
  /** Rough token estimate; drives context-window escalation (§14.2 axis 3a). */
  estimatedTokens: number;
  stakes: AiStakes;
  /**
   * Set true when a prior local attempt failed schema validation (§14.5) — the preferred,
   * hard escalation signal over self-reported confidence.
   */
  schemaValidationFailed?: boolean;
  /** True when the local provider is unavailable/overloaded (§14.2 axis 3c). */
  localUnavailable?: boolean;
}

/** Static routing configuration per task type (§14.1). */
export interface AiTaskProfile {
  type: AiTaskType;
  default: AiProviderKind;
  /** Whether capability escalation to remote is permitted for this task. */
  canEscalate: boolean;
}

/** Result of `resolveProvider` — the chosen tier plus the reason, for observability. */
export interface AiRoutingDecision {
  provider: AiProviderKind;
  reason:
    | 'privacy_gate'
    | 'task_default'
    | 'escalate_context'
    | 'escalate_schema_failure'
    | 'escalate_unavailable'
    | 'escalate_stakes';
  /**
   * True when the descriptor *wanted* remote but the privacy gate forced local; the caller
   * must mark the result low-confidence rather than sending data out (§14.2 axis 1).
   */
  privacyDowngraded: boolean;
}

/** Provider-agnostic chat/structured interface (§14.3). */
export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Local model's approximate context window in tokens (used for escalation axis 3a). */
export const LOCAL_CONTEXT_WINDOW_TOKENS = 32_000;
