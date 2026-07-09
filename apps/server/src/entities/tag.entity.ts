import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Tag — a supertag definition (§6.1). Applying it turns a block into a structured entity.
 * `extendsId` forms a self-ref chain walked for field inheritance (§8.1).
 */
@Entity('tag')
@Index(['tenantId', 'name'], { unique: true })
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'text' })
  name!: string;

  /** Self-ref; field resolution walks this chain (§8.1). */
  @Column({ type: 'uuid', nullable: true })
  extendsId!: string | null;

  /** Organizational folder/tree parent — distinct from `extendsId` inheritance. */
  @Column({ type: 'uuid', nullable: true })
  @Index()
  parentId!: string | null;

  @Column({ type: 'text', nullable: true })
  icon!: string | null;

  @Column({ type: 'text', nullable: true })
  color!: string | null;

  @Column({ type: 'uuid', nullable: true })
  defaultViewId!: string | null;
}
