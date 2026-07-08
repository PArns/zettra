import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * FieldValue — one value for one field on one block (§6.1). Exactly one `value*` column is
 * populated per row, selected by the field's type (invariant 2). View filters/sorts hit
 * these indexed columns; `valueJson` is only for multi-value/complex cases.
 */
@Entity('field_value')
@Index(['blockId', 'fieldId'], { unique: true })
export class FieldValue {
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
  fieldId!: string;

  @Column({ type: 'text', nullable: true })
  @Index()
  valueText!: string | null;

  @Column({ type: 'numeric', nullable: true })
  @Index()
  valueNumber!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  @Index()
  valueDate!: Date | null;

  @Column({ type: 'boolean', nullable: true })
  valueBool!: boolean | null;

  /** Multi-select arrays / structured payloads only. */
  @Column({ type: 'jsonb', nullable: true })
  valueJson!: unknown;

  /** Who set this structured fact (§15.1) — last-write-wins keyed on updatedAt + updatedBy. */
  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
