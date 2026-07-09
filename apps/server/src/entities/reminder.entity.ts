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

  /** Set when the due-scan job has emitted a notification, so it fires once. */
  @Column({ type: 'timestamptz', nullable: true })
  notifiedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
