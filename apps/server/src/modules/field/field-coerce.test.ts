import { describe, expect, it } from 'vitest';
import { FieldType } from '@zettra/shared';
import { coerceFieldValue } from './field-coerce';

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
