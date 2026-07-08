import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** UserBlockState — per-user read/unread and view state (§15.1). */
@Entity('user_block_state')
@Index(['userId', 'blockId'], { unique: true })
export class UserBlockState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'uuid' })
  @Index()
  blockId!: string;

  @Column({ type: 'boolean', default: false })
  read!: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
