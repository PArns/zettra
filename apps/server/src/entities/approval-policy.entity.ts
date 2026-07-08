import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PolicyScope } from '@zettra/shared';

/** ApprovalPolicy — per-scope confidence thresholds (§6.1, §8.5). */
@Entity('approval_policy')
@Index(['tenantId', 'scope', 'scopeId'], { unique: true })
export class ApprovalPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'enum', enum: PolicyScope })
  scope!: PolicyScope;

  /** null for system scope; userId or spaceId otherwise. */
  @Column({ type: 'uuid', nullable: true })
  scopeId!: string | null;

  @Column({ type: 'real', default: 0.9 })
  autoApprove!: number;

  @Column({ type: 'real', default: 0.5 })
  suggest!: number;
}
