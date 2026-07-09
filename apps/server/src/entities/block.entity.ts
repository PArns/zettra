import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BlockSource, BlockVisibility } from '@zettra/shared';

/**
 * Block — the universal primitive (§5, §6.1). A page, task, email, person, meeting: all are
 * blocks. Behaviour comes from attached supertags, not a fixed type column (invariant 1).
 * Rich text stays as BlockNote JSON in `content`; referenceable entities are their own rows.
 */
@Entity('block')
@Index(['tenantId', 'sourceRef'], { unique: true, where: '"sourceRef" IS NOT NULL' })
export class Block {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  spaceId!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  parentId!: string | null;

  /** Fractional index for sibling ordering (§6.1). */
  @Column({ type: 'text', default: 'a0' })
  position!: string;

  /** BlockNote/ProseMirror document JSON for this entity's rich-text body. */
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  content!: unknown;

  /**
   * Extracted plaintext of `content`, maintained by the embed worker. Feeds the full-text
   * half of hybrid search (§11); a generated `tsvector` + GIN index is added by migration.
   */
  @Column({ type: 'text', nullable: true, select: false })
  searchText!: string | null;

  @Column({ type: 'enum', enum: BlockSource, default: BlockSource.Manual })
  source!: BlockSource;

  /** Block-level visibility override (§8.8, §11). `private` restricts to the owner. */
  @Column({ type: 'text', default: BlockVisibility.Space })
  visibility!: BlockVisibility;

  /** External identity for capture idempotency (unique per tenantId + sourceRef). */
  @Column({ type: 'text', nullable: true })
  sourceRef!: string | null;

  /** The user who captured/owns a capture item; drives the per-user inbox (§15.1). */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  ownerUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;

  /** Edit attribution (§15.1). */
  @Column({ type: 'uuid', array: true, default: () => "'{}'" })
  contributorIds!: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
