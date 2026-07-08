/**
 * `resolveProvider` — the pure AI routing policy (§14.2). Three axes resolved in order:
 *   1. Privacy gate (hard). `local_only` forbids remote regardless of task.
 *   2. Task default (static per-type config).
 *   3. Capability escalation (context window / schema failure / unavailability / stakes).
 *
 * Keep this pure and unit-tested — it encodes the routing invariants (§14.3, §12).
 */
import {
  AiRoutingDecision,
  AiTaskDescriptor,
  AiTaskProfile,
  LOCAL_CONTEXT_WINDOW_TOKENS,
} from './ai';
import { AiPrivacyScope, AiProviderKind, AiStakes, AiTaskType } from './enums';

/** Static per-task routing config (§14.1). */
export const DEFAULT_TASK_PROFILES: Record<AiTaskType, AiTaskProfile> = {
  [AiTaskType.CaptureTagging]: {
    type: AiTaskType.CaptureTagging,
    default: AiProviderKind.Local,
    canEscalate: true,
  },
  [AiTaskType.RelationCuration]: {
    type: AiTaskType.RelationCuration,
    default: AiProviderKind.Local,
    canEscalate: true,
  },
  [AiTaskType.Summarization]: {
    type: AiTaskType.Summarization,
    default: AiProviderKind.Local,
    canEscalate: true,
  },
};

/**
 * Resolve which provider tier handles a request. Pure function of the descriptor + profile.
 *
 * The privacy gate is evaluated FIRST and wins absolutely (invariant §14.2.1): if the task
 * would otherwise escalate to remote but the scope is `local_only`, we stay local and flag
 * `privacyDowngraded` so the caller marks the result low-confidence instead of leaking data.
 */
export function resolveProvider(
  descriptor: AiTaskDescriptor,
  profile: AiTaskProfile,
): AiRoutingDecision {
  const localOnly = descriptor.privacyScope === AiPrivacyScope.LocalOnly;

  // Determine whether capability escalation *wants* remote, independent of the privacy gate.
  const escalationReason = resolveEscalation(descriptor, profile);

  if (localOnly) {
    // Privacy beats quality. Local regardless; downgrade flag if we suppressed an escalation.
    return {
      provider: AiProviderKind.Local,
      reason: 'privacy_gate',
      privacyDowngraded: escalationReason !== null,
    };
  }

  if (escalationReason) {
    return { provider: AiProviderKind.Remote, reason: escalationReason, privacyDowngraded: false };
  }

  return { provider: profile.default, reason: 'task_default', privacyDowngraded: false };
}

/** Returns the escalation reason if remote is warranted, else null. */
function resolveEscalation(
  descriptor: AiTaskDescriptor,
  profile: AiTaskProfile,
): AiRoutingDecision['reason'] | null {
  if (!profile.canEscalate) return null;

  // (a) context exceeds the local model's window
  if (descriptor.estimatedTokens > LOCAL_CONTEXT_WINDOW_TOKENS) return 'escalate_context';
  // (b) local output failed schema validation — the preferred hard signal (§14.5)
  if (descriptor.schemaValidationFailed) return 'escalate_schema_failure';
  // (c) local provider unavailable / overloaded
  if (descriptor.localUnavailable) return 'escalate_unavailable';
  // (d) task flagged high-stakes
  if (descriptor.stakes === AiStakes.High) return 'escalate_stakes';

  return null;
}
