import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  decideLink,
  LinkDecision,
  PolicyScope,
  RelationKind,
  RelationStatus,
  resolveThresholds,
} from '@zettra/shared';
import { ApprovalPolicy, BlockRelation } from '../../entities/index';

export interface CurationCandidate {
  sourceId: string;
  targetId: string;
  confidence: number;
  /** null for a plain mention/suggestion; set when the curator inferred a relation field. */
  fieldId?: string | null;
}

/**
 * Approval policy (§8.5). Thresholds resolve most-specific-first space → user → system
 * (invariant 9). Decisions compare the curation confidence, never raw cosine (invariant 8).
 * Non-drop decisions store confidence + audit fields for rollback.
 */
@Injectable()
export class ApprovalService {
  constructor(
    @InjectRepository(ApprovalPolicy) private readonly policies: Repository<ApprovalPolicy>,
    @InjectRepository(BlockRelation) private readonly relations: Repository<BlockRelation>,
  ) {}

  /**
   * Resolve thresholds for a scope. In a shared space the space policy wins for everyone
   * (invariant 9), so `spaceId` is preferred over `userId`.
   */
  async resolveFor(tenantId: string, spaceId: string | null, userId: string | null) {
    const rows = await this.policies.find({ where: { tenantId } });
    const relevant = rows.filter(
      (r) =>
        r.scope === PolicyScope.System ||
        (r.scope === PolicyScope.Space && r.scopeId === spaceId) ||
        (r.scope === PolicyScope.User && r.scopeId === userId),
    );
    return resolveThresholds(
      relevant.map((r) => ({ scope: r.scope, autoApprove: r.autoApprove, suggest: r.suggest })),
    );
  }

  /**
   * Apply a curation decision to a candidate edge (§8.5):
   *   confirm  -> insert confirmed, approvedBy='system'
   *   suggest  -> insert suggested (review queue)
   *   drop     -> not stored
   * Returns the decision (and the inserted relation, if any).
   */
  async applyDecision(
    tenantId: string,
    spaceId: string | null,
    userId: string | null,
    candidate: CurationCandidate,
  ): Promise<{ decision: LinkDecision; relation: BlockRelation | null }> {
    const thresholds = await this.resolveFor(tenantId, spaceId, userId);
    const decision = decideLink(candidate.confidence, thresholds);
    if (decision.action === 'drop') return { decision, relation: null };

    const confirmed = decision.action === 'confirm';
    const relation = await this.relations.save(
      this.relations.create({
        tenantId,
        sourceId: candidate.sourceId,
        targetId: candidate.targetId,
        fieldId: candidate.fieldId ?? null,
        kind: RelationKind.Suggested,
        status: confirmed ? RelationStatus.Confirmed : RelationStatus.Suggested,
        confidence: candidate.confidence,
        approvedBy: confirmed ? 'system' : null,
        approvedAt: confirmed ? new Date() : null,
      }),
    );
    return { decision, relation };
  }

  /** Confirm a suggested edge from the review queue (audit trail for calibration, §8.5). */
  async confirm(tenantId: string, relationId: string, userId: string): Promise<void> {
    await this.relations.update(
      { id: relationId, tenantId },
      { status: RelationStatus.Confirmed, approvedBy: userId, approvedAt: new Date() },
    );
  }

  /** Dismiss a suggested edge; feeds the dismiss-rate-per-bucket metric (§8.5, §11). */
  async dismiss(tenantId: string, relationId: string, userId: string): Promise<void> {
    await this.relations.update(
      { id: relationId, tenantId },
      { status: RelationStatus.Dismissed, approvedBy: userId, approvedAt: new Date() },
    );
  }
}
