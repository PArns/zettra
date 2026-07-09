import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Reminder / Wiedervorlage on a block (§3–§4). A block can carry several. The due-scan job
 * surfaces pending reminders whose `remindAt` has passed; the Today view unions them too.
 */
@Entity('reminder')
@Index(['tenantId', 'userId', 'status', 'remindAt'])
export class Reminder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  blockId!: string;

  /** Who should be reminded (the creator for now). */
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'timestamptz' })
  @Index()
  remindAt!: Date;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** `pending` | `done` | `dismissed`. */
  @Column({ type: 'text', default: 'pending' })
  status!: string;

  /**
   * Recurrence rule (§4 Wiedervorlage): `daily` | `weekly` | `monthly` | `yearly`, or null for a
   * one-off. Completing a recurring reminder reschedules it to the next occurrence rather than
   * closing it.
   */
  @Column({ type: 'text', nullable: true })
  recurrence!: string | null;

  /** Set when the due-scan job has emitted a notification, so it fires once. */
  @Column({ type: 'timestamptz', nullable: true })
  notifiedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
