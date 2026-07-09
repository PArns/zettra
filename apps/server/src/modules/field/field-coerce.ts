import { FieldType } from '@zettra/shared';

/** The typed `field_value` column a value lands in (invariant 2). */
export type ValueColumn = 'valueText' | 'valueNumber' | 'valueDate' | 'valueBool' | 'valueJson';

export interface CoercedValue {
  column: ValueColumn;
  value: string | number | boolean | Date | unknown[];
}

/** The subset of a `field_value` row the migration helpers read from. */
export interface StoredColumns {
  valueText: string | null;
  valueNumber: string | null;
  valueDate: Date | null;
  valueBool: boolean | null;
  valueJson: unknown;
}

/** The single typed column a field of `type` stores into (invariant 2). */
export function columnForType(type: FieldType): ValueColumn {
  switch (type) {
    case FieldType.Number:
      return 'valueNumber';
    case FieldType.Date:
      return 'valueDate';
    case FieldType.Checkbox:
      return 'valueBool';
    case FieldType.MultiSelect:
      return 'valueJson';
    default:
      return 'valueText';
  }
}

/**
 * Route a raw value to the single typed column for its field type (invariant 2), coercing
 * the representation (numbers stored as text for the `numeric` column, dates as `Date`, etc.).
 * Returns null for null/undefined (the caller clears all columns). Pure and unit-tested.
 */
export function coerceFieldValue(type: FieldType, raw: unknown): CoercedValue | null {
  if (raw === null || raw === undefined) return null;
  switch (type) {
    case FieldType.Number:
      return { column: 'valueNumber', value: String(Number(raw)) };
    case FieldType.Date:
      return { column: 'valueDate', value: raw instanceof Date ? raw : new Date(String(raw)) };
    case FieldType.Checkbox:
      return { column: 'valueBool', value: Boolean(raw) };
    case FieldType.MultiSelect:
      return { column: 'valueJson', value: Array.isArray(raw) ? raw : [raw] };
    default:
      return { column: 'valueText', value: String(raw) };
  }
}

/**
 * Read the currently-populated value out of a `field_value` row, interpreted as the field's
 * old `type` — the inverse of the column routing. Numeric strings come back as numbers so a
 * later re-coercion normalizes them. Returns null when the type's column is empty.
 */
export function readStoredValue(type: FieldType, cols: StoredColumns): unknown {
  switch (columnForType(type)) {
    case 'valueNumber':
      return cols.valueNumber === null ? null : Number(cols.valueNumber);
    case 'valueDate':
      return cols.valueDate ?? null;
    case 'valueBool':
      return cols.valueBool ?? null;
    case 'valueJson':
      return cols.valueJson ?? null;
    default:
      return cols.valueText ?? null;
  }
}

/**
 * Re-route an existing value from a field's old type to its new type when the field is retyped
 * (§11). Reads the old typed column and coerces into the new one, dropping values that don't
 * survive the target type (a non-numeric text → Number, an unparseable text → Date) so the
 * typed column never holds `NaN`/`Invalid Date`. Returns null → the caller clears the row.
 * Pure and unit-tested.
 */
export function migrateFieldValue(
  oldType: FieldType,
  newType: FieldType,
  cols: StoredColumns,
): CoercedValue | null {
  const coerced = coerceFieldValue(newType, readStoredValue(oldType, cols));
  if (!coerced) return null;
  if (coerced.column === 'valueNumber' && !Number.isFinite(Number(coerced.value))) return null;
  if (coerced.column === 'valueDate' && Number.isNaN((coerced.value as Date).getTime())) return null;
  return coerced;
}
