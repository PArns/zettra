import { describe, expect, it } from 'vitest';
import { FieldType } from '@zettra/shared';
import {
  coerceFieldValue,
  columnForType,
  migrateFieldValue,
  readStoredValue,
  type StoredColumns,
} from './field-coerce';

const empty: StoredColumns = {
  valueText: null,
  valueNumber: null,
  valueDate: null,
  valueBool: null,
  valueJson: null,
};

describe('coerceFieldValue (invariant 2: one typed column per value)', () => {
  it('routes number to valueNumber as a numeric string', () => {
    expect(coerceFieldValue(FieldType.Number, 42)).toEqual({ column: 'valueNumber', value: '42' });
    expect(coerceFieldValue(FieldType.Number, '7')).toEqual({ column: 'valueNumber', value: '7' });
  });

  it('routes date to valueDate as a Date', () => {
    const r = coerceFieldValue(FieldType.Date, '2026-08-01');
    expect(r?.column).toBe('valueDate');
    expect(r?.value).toBeInstanceOf(Date);
  });

  it('routes checkbox to valueBool', () => {
    expect(coerceFieldValue(FieldType.Checkbox, true)).toEqual({
      column: 'valueBool',
      value: true,
    });
    expect(coerceFieldValue(FieldType.Checkbox, '')).toEqual({ column: 'valueBool', value: false });
  });

  it('routes multi_select to valueJson as an array', () => {
    expect(coerceFieldValue(FieldType.MultiSelect, 'a')).toEqual({
      column: 'valueJson',
      value: ['a'],
    });
    expect(coerceFieldValue(FieldType.MultiSelect, ['a', 'b'])).toEqual({
      column: 'valueJson',
      value: ['a', 'b'],
    });
  });

  it('routes text/select/relation/user/url/file to valueText', () => {
    for (const t of [
      FieldType.Text,
      FieldType.Select,
      FieldType.Relation,
      FieldType.User,
      FieldType.Url,
      FieldType.File,
    ]) {
      expect(coerceFieldValue(t, 'x')).toEqual({ column: 'valueText', value: 'x' });
    }
  });

  it('returns null for null/undefined (caller clears all columns)', () => {
    expect(coerceFieldValue(FieldType.Text, null)).toBeNull();
    expect(coerceFieldValue(FieldType.Text, undefined)).toBeNull();
  });
});

describe('columnForType', () => {
  it('maps each field type to its single typed column', () => {
    expect(columnForType(FieldType.Number)).toBe('valueNumber');
    expect(columnForType(FieldType.Date)).toBe('valueDate');
    expect(columnForType(FieldType.Checkbox)).toBe('valueBool');
    expect(columnForType(FieldType.MultiSelect)).toBe('valueJson');
    expect(columnForType(FieldType.Text)).toBe('valueText');
    expect(columnForType(FieldType.Relation)).toBe('valueText');
  });
});

describe('readStoredValue', () => {
  it('reads the populated column for the field type, numbers as numbers', () => {
    expect(readStoredValue(FieldType.Number, { ...empty, valueNumber: '42' })).toBe(42);
    expect(readStoredValue(FieldType.Text, { ...empty, valueText: 'hi' })).toBe('hi');
    expect(readStoredValue(FieldType.Checkbox, { ...empty, valueBool: true })).toBe(true);
    expect(readStoredValue(FieldType.MultiSelect, { ...empty, valueJson: ['a'] })).toEqual(['a']);
  });

  it('returns null when the type column is empty', () => {
    expect(readStoredValue(FieldType.Number, empty)).toBeNull();
    expect(readStoredValue(FieldType.Text, empty)).toBeNull();
  });
});

describe('migrateFieldValue (retype re-routes existing values, §11)', () => {
  it('moves a number to text and back, normalizing', () => {
    expect(migrateFieldValue(FieldType.Number, FieldType.Text, { ...empty, valueNumber: '42' })).toEqual(
      { column: 'valueText', value: '42' },
    );
    expect(migrateFieldValue(FieldType.Text, FieldType.Number, { ...empty, valueText: '7' })).toEqual({
      column: 'valueNumber',
      value: '7',
    });
  });

  it('drops values that do not survive the target type', () => {
    // "hello" → Number would be NaN; "hello" → Date would be Invalid Date → cleared.
    expect(
      migrateFieldValue(FieldType.Text, FieldType.Number, { ...empty, valueText: 'hello' }),
    ).toBeNull();
    expect(
      migrateFieldValue(FieldType.Text, FieldType.Date, { ...empty, valueText: 'not-a-date' }),
    ).toBeNull();
  });

  it('parses a valid text date into valueDate', () => {
    const r = migrateFieldValue(FieldType.Text, FieldType.Date, { ...empty, valueText: '2026-08-01' });
    expect(r?.column).toBe('valueDate');
    expect((r?.value as Date).getUTCFullYear()).toBe(2026);
  });

  it('wraps a single text value into a multi_select array', () => {
    expect(
      migrateFieldValue(FieldType.Text, FieldType.MultiSelect, { ...empty, valueText: 'a' }),
    ).toEqual({ column: 'valueJson', value: ['a'] });
  });

  it('clears when the source column is empty', () => {
    expect(migrateFieldValue(FieldType.Text, FieldType.Number, empty)).toBeNull();
  });
});
