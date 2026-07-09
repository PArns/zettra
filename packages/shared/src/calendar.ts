/**
 * Pure calendar helpers for the date picker + calendar surface (§3). Deterministic (UTC + explicit
 * arguments, never `Date.now()`), so the month-grid math is unit-testable.
 */

export interface DayCell {
  /** ISO date, `YYYY-MM-DD`. */
  iso: string;
  /** Day of month, 1–31. */
  day: number;
  /** Whether the cell belongs to the displayed month (vs. leading/trailing spillover). */
  inMonth: boolean;
}

/** Zero-padded ISO date for a UTC y/m/d (month 0-indexed). */
function iso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

/**
 * A 6×7 Monday-first month grid for `year`/`month` (month 0-indexed), including the leading and
 * trailing days needed to fill whole weeks. Always 6 rows so the grid never reflows height.
 */
export function monthGrid(year: number, month: number): DayCell[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const firstWeekday = (first.getUTCDay() + 6) % 7; // Monday = 0
  const weeks: DayCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const offset = w * 7 + d - firstWeekday;
      const cur = new Date(Date.UTC(year, month, 1 + offset));
      week.push({
        iso: iso(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate()),
        day: cur.getUTCDate(),
        inMonth: cur.getUTCMonth() === month,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

/** Step a `year`/`month` (0-indexed) by whole months, normalizing the year. */
export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}
