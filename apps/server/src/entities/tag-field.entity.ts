import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { FieldType } from '@zettra/shared';

/** TagField — one field in a supertag's schema (§6.1). */
@Entity('tag_field')
export class TagField {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tagId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'enum', enum: FieldType })
  type!: FieldType;

  /** Select options, relation `targetTagId`, number format, etc. */
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  config!: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  position!: number;
}
