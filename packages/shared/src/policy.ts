/**
 * Approval-policy resolution + link decision (§8.5). Pure and unit-tested (§12).
 *
 * Thresholds resolve most-specific-first: space → user → system (invariant 9: in a shared
 * space the space policy wins for everyone). The decision compares the *curation
 * confidence*, never raw cosine distance (invariant 8).
 */
import { PolicyScope } from './enums';
import { DEFAULT_THRESHOLDS, LinkDecision, ResolvedThresholds } from './approval';

/** A stored approval_policy row, reduced to what resolution needs. */
export interface PolicyRow {
  scope: PolicyScope;
  autoApprove: number;
  suggest: number;
}

/**
 * Resolve effective thresholds. Precedence: space → user → system → hardcoded defaults.
 * Only one row per scope is expected (unique(tenantId, scope, scopeId)); the first match
 * per scope wins.
 */
export function resolveThresholds(policies: PolicyRow[]): ResolvedThresholds {
  const bySpecificity = [PolicyScope.Space, PolicyScope.User, PolicyScope.System];
  for (const scope of bySpecificity) {
    const row = policies.find((p) => p.scope === scope);
    if (row) return { autoApprove: row.autoApprove, suggest: row.suggest };
  }
  return { ...DEFAULT_THRESHOLDS };
}

/**
 * Decide what to do with a curation confidence (§8.5):
 *   confidence >= autoApprove         -> confirm (insert confirmed, approvedBy='system')
 *   suggest <= confidence < auto      -> suggest (review queue)
 *   confidence < suggest              -> drop (not stored)
 */
export function decideLink(confidence: number, thresholds: ResolvedThresholds): LinkDecision {
  if (confidence >= thresholds.autoApprove) return { action: 'confirm', confidence };
  if (confidence >= thresholds.suggest) return { action: 'suggest', confidence };
  return { action: 'drop', confidence };
}
