import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { RelationKind, RelationStatus } from '@zettra/shared';

/**
 * BlockRelation — hard graph edges, the real second-brain graph (§6.1, invariant 3).
 * Soft (semantic) connections are computed live and NEVER inserted here.
 */
@Entity('block_relation')
@Index(['sourceId', 'targetId', 'fieldId'], { unique: true })
export class BlockRelation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  sourceId!: string;

  @Column({ type: 'uuid' })
  @Index()
  targetId!: string;

  /** Set when the link came via a relation field; null for mentions. */
  @Column({ type: 'uuid', nullable: true })
  fieldId!: string | null;

  @Column({ type: 'enum', enum: RelationKind })
  kind!: RelationKind;

  @Column({ type: 'enum', enum: RelationStatus, default: RelationStatus.Confirmed })
  status!: RelationStatus;

  /** Curation confidence for suggested edges; null for deterministic (invariant 8). */
  @Column({ type: 'real', nullable: true })
  confidence!: number | null;

  /** Audit trail: uuid of approver, or the literal 'system' for auto-approved (§8.5). */
  @Column({ type: 'text', nullable: true })
  approvedBy!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;
}
