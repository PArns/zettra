import { describe, expect, it } from 'vitest';
import { cellTone, matchesRule, type CondRule } from './conditional-format';
import type { CellResult } from './formula';

const numCell = (value: number): CellResult => ({ display: String(value), value });
const textCell = (display: string): CellResult => ({ display, value: null });

describe('matchesRule', () => {
  it('matches numeric comparison operators', () => {
    expect(matchesRule(numCell(120), { op: 'gt', value: 100, tone: 'green' })).toBe(true);
    expect(matchesRule(numCell(80), { op: 'gt', value: 100, tone: 'green' })).toBe(false);
    expect(matchesRule(numCell(-5), { op: 'lt', value: 0, tone: 'red' })).toBe(true);
    expect(matchesRule(numCell(50), { op: 'between', value: 10, value2: 100, tone: 'blue' })).toBe(
      true,
    );
  });

  it('matches text contains/eq case-insensitively', () => {
    expect(matchesRule(textCell('Done'), { op: 'contains', value: 'do', tone: 'green' })).toBe(
      true,
    );
    expect(matchesRule(textCell('Open'), { op: 'eq', value: 'open', tone: 'amber' })).toBe(true);
  });

  it('never matches an errored cell', () => {
    const err: CellResult = { display: '#ERR', value: null, error: 'boom' };
    expect(matchesRule(err, { op: 'gt', value: 0, tone: 'red' })).toBe(false);
  });
});

describe('cellTone', () => {
  const rules: CondRule[] = [
    { op: 'lt', value: 0, tone: 'red' },
    { op: 'gt', value: 100, tone: 'green', column: 3 },
  ];

  it('returns the first matching rule tone', () => {
    expect(cellTone(numCell(-1), 0, rules)).toBe('red');
  });

  it('respects a column-scoped rule', () => {
    expect(cellTone(numCell(150), 3, rules)).toBe('green');
    expect(cellTone(numCell(150), 1, rules)).toBeNull(); // wrong column
  });

  it('returns null when nothing matches', () => {
    expect(cellTone(numCell(50), 0, rules)).toBeNull();
  });
});
