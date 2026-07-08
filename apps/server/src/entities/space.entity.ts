import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AiPrivacyScope } from '@zettra/shared';

/**
 * Space — an organizational unit inside a tenant (§5). A permission scope and view filter,
 * NEVER a sharding boundary (invariant 6). Carries the shared AI privacy posture (§14.2).
 */
@Entity('space')
export class Space {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'text' })
  name!: string;

  /**
   * Space-level AI privacy posture (§14.2 / §15.5). `local_only` forbids remote calls for
   * everyone in the space — resolves at the space, never per-user.
   */
  @Column({ type: 'text', default: AiPrivacyScope.Default })
  aiPolicy!: AiPrivacyScope;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
