import { describe, expect, it } from 'vitest';
import {
  formatOptions,
  needsOptions,
  needsRelationTarget,
  optionsOf,
  parseOptions,
  supportsDefault,
} from './field-config';

describe('field-config predicates', () => {
  it('flags option-driven types', () => {
    expect(needsOptions('select')).toBe(true);
    expect(needsOptions('multi_select')).toBe(true);
    expect(needsOptions('text')).toBe(false);
  });

  it('flags relation targets', () => {
    expect(needsRelationTarget('relation')).toBe(true);
    expect(needsRelationTarget('select')).toBe(false);
  });

  it('flags scalar-default types', () => {
    expect(supportsDefault('text')).toBe(true);
    expect(supportsDefault('number')).toBe(true);
    expect(supportsDefault('checkbox')).toBe(false);
    expect(supportsDefault('relation')).toBe(false);
  });
});

describe('parseOptions', () => {
  it('splits on newlines and commas, trims, and drops blanks', () => {
    expect(parseOptions('Todo\nDoing\n\n Done ')).toEqual(['Todo', 'Doing', 'Done']);
    expect(parseOptions('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('de-duplicates while preserving first-seen order', () => {
    expect(parseOptions('High\nLow\nHigh\nMedium\nLow')).toEqual(['High', 'Low', 'Medium']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseOptions('')).toEqual([]);
    expect(parseOptions('   \n  ')).toEqual([]);
  });
});

describe('formatOptions / optionsOf', () => {
  it('round-trips an option array through text', () => {
    const opts = ['Alpha', 'Beta', 'Gamma'];
    expect(parseOptions(formatOptions(opts))).toEqual(opts);
  });

  it('tolerates a non-array config value', () => {
    expect(formatOptions(undefined)).toBe('');
    expect(optionsOf({})).toEqual([]);
    expect(optionsOf({ options: ['x', 'y'] })).toEqual(['x', 'y']);
  });
});
