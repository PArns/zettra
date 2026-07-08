import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Notification — mentions, task assignments, review requests (§15.1, §15.6). The delivery
 * mechanism is scaffolded here; producers are wired in later phases.
 */
export type NotificationKind = 'mention' | 'task_assignment' | 'review_request';

@Entity('notification')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'text' })
  kind!: NotificationKind;

  @Column({ type: 'uuid', nullable: true })
  sourceBlockId!: string | null;

  @Column({ type: 'boolean', default: false })
  read!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
