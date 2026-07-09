import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TenantTier } from '@zettra/shared';

/** Tenant — the isolation and sharding boundary (§5). */
@Entity('tenant')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  /** Subscription tier; caps members/spaces/blocks/storage (§5). */
  @Column({ type: 'text', default: TenantTier.Free })
  tier!: TenantTier;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
