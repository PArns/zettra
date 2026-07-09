import { FieldType } from '@zettra/shared';

/** The typed `field_value` column a value lands in (invariant 2). */
export type ValueColumn = 'valueText' | 'valueNumber' | 'valueDate' | 'valueBool' | 'valueJson';

export interface CoercedValue {
  column: ValueColumn;
  value: string | number | boolean | Date | unknown[];
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
    case FieldType.Text:
    case FieldType.Select:
    case FieldType.Relation:
    case FieldType.User:
    case FieldType.Url:
    case FieldType.File:
      return { column: 'valueText', value: String(raw) };
    default:
      return { column: 'valueText', value: String(raw) };
  }
}
