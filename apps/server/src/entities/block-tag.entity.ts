import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** BlockTag — M:N block↔supertag (§6.1). A block may carry several supertags. */
@Entity('block_tag')
@Index(['blockId', 'tagId'], { unique: true })
export class BlockTag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  blockId!: string;

  @Column({ type: 'uuid' })
  @Index()
  tagId!: string;

  /** Who applied the tag (§15.1) — needed for audit and review routing. */
  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
