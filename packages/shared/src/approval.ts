/**
 * Approval-policy contracts (§8.5). Thresholds are compared against the *curation
 * confidence* (Claude/local LLM judgment), never raw cosine distance (invariant 8).
 */

/** Resolved thresholds for a scope, most-specific-first: space → user → system (§8.5). */
export interface ResolvedThresholds {
  autoApprove: number;
  suggest: number;
}

/** The three possible outcomes of a curation confidence decision (§8.5). */
export type LinkDecisionAction = 'confirm' | 'suggest' | 'drop';

export interface LinkDecision {
  action: LinkDecisionAction;
  /** Echoes the confidence that produced the decision, for the audit trail. */
  confidence: number;
}

/** Default thresholds (§6.1 `approval_policy` defaults). */
export const DEFAULT_THRESHOLDS: ResolvedThresholds = {
  autoApprove: 0.9,
  suggest: 0.5,
};
