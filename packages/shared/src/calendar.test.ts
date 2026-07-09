import { describe, expect, it } from 'vitest';
import { addMonths, monthGrid } from './calendar';

describe('monthGrid', () => {
  const grid = monthGrid(2026, 6); // July 2026

  it('is a 6×7 grid', () => {
    expect(grid).toHaveLength(6);
    for (const week of grid) expect(week).toHaveLength(7);
  });

  it('starts on a Monday and includes the leading spillover', () => {
    // July 1 2026 is a Wednesday, so the grid starts Mon Jun 29.
    expect(grid[0][0].iso).toBe('2026-06-29');
    expect(grid[0][0].inMonth).toBe(false);
    expect(grid[0][2].iso).toBe('2026-07-01');
    expect(grid[0][2].inMonth).toBe(true);
  });

  it('flags in-month vs. spillover days', () => {
    const inMonth = grid.flat().filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31); // July has 31 days
    expect(inMonth.every((c) => c.iso.startsWith('2026-07'))).toBe(true);
  });

  it('handles a leap-year February', () => {
    const feb = monthGrid(2028, 1)
      .flat()
      .filter((c) => c.inMonth);
    expect(feb).toHaveLength(29);
  });
});

describe('addMonths', () => {
  it('steps forward across a year boundary', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });
  it('steps backward across a year boundary', () => {
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
  it('steps multiple months', () => {
    expect(addMonths(2026, 6, 8)).toEqual({ year: 2027, month: 2 });
  });
});
