import { describe, expect, it } from 'vitest';
import { asRecurrenceRule, nextOccurrence } from './recurrence';

describe('nextOccurrence', () => {
  it('advances daily and weekly', () => {
    expect(nextOccurrence('2026-07-09', 'daily')).toBe('2026-07-10');
    expect(nextOccurrence('2026-07-09', 'weekly')).toBe('2026-07-16');
  });

  it('advances monthly, clamping short months', () => {
    expect(nextOccurrence('2026-07-15', 'monthly')).toBe('2026-08-15');
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28'); // Feb has 28 days in 2026
    expect(nextOccurrence('2026-12-31', 'monthly')).toBe('2027-01-31'); // year rolls over
  });

  it('advances yearly, clamping a leap day', () => {
    expect(nextOccurrence('2026-03-01', 'yearly')).toBe('2027-03-01');
    expect(nextOccurrence('2024-02-29', 'yearly')).toBe('2025-02-28'); // 2025 is not a leap year
  });
});

describe('asRecurrenceRule', () => {
  it('accepts known rules and rejects anything else', () => {
    expect(asRecurrenceRule('weekly')).toBe('weekly');
    expect(asRecurrenceRule('fortnightly')).toBeNull();
    expect(asRecurrenceRule(null)).toBeNull();
    expect(asRecurrenceRule(undefined)).toBeNull();
  });
});
