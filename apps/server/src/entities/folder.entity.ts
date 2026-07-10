import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Folder — an organizational tree for notes (§8.2). Distinct from tags/supertags: a folder just
 * holds notes so not everything piles up in the Briefkasten. `parentId` forms the tree; a note's
 * `block.folderId` files it here. Tenant-scoped and owned by its creator.
 */
@Entity('folder')
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  spaceId!: string;

  @Column({ type: 'text' })
  name!: string;

  /** Tree parent; null = a root folder. */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  parentId!: string | null;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'uuid', nullable: true })
  ownerUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
