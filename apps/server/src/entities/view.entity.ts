import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ViewFilter, ViewLayout, ViewSort } from '@zettra/shared';

/**
 * View — a saved query over blocks (§6.1, §8.2). The Briefkasten is just the view with
 * `tagId = null` and an "untagged" structural filter.
 */
@Entity('view')
export class View {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  spaceId!: string | null;

  @Column({ type: 'text' })
  name!: string;

  /** null = spans all blocks (inbox / global search). */
  @Column({ type: 'uuid', nullable: true })
  tagId!: string | null;

  @Column({ type: 'enum', enum: ViewLayout, default: ViewLayout.Table })
  layout!: ViewLayout;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  filters!: ViewFilter[];

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  sorts!: ViewSort[];

  /** fieldId for board columns / calendar buckets. */
  @Column({ type: 'uuid', nullable: true })
  groupBy!: string | null;

  /** null = shared (space-level); set = private to a user (§15.1). */
  @Column({ type: 'uuid', nullable: true })
  ownerUserId!: string | null;
}
