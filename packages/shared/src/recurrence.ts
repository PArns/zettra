/**
 * Reminder recurrence (§4, Wiedervorlage). A Wiedervorlage resurfaces on a cycle: when a recurring
 * reminder is completed it is rescheduled to its next occurrence rather than closed. The date math
 * is pure and UTC-based (no `Date.now()`), so the cycle rules are unit-testable.
 */

export const RECURRENCE_RULES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type RecurrenceRule = (typeof RECURRENCE_RULES)[number];

/** Narrow an arbitrary string to a {@link RecurrenceRule}, or null if it is not one. */
export function asRecurrenceRule(value: string | null | undefined): RecurrenceRule | null {
  return value && (RECURRENCE_RULES as readonly string[]).includes(value)
    ? (value as RecurrenceRule)
    : null;
}

/**
 * The next occurrence of an ISO date (`YYYY-MM-DD`) under a recurrence rule, in UTC. Monthly and
 * yearly steps clamp the day to the target month's length so e.g. Jan 31 → Feb 28 (not Mar 3).
 */
export function nextOccurrence(iso: string, rule: RecurrenceRule): string {
  const [y, m, d] = iso.split('-').map(Number);
  switch (rule) {
    case 'daily':
      return fromUtc(Date.UTC(y, m - 1, d + 1));
    case 'weekly':
      return fromUtc(Date.UTC(y, m - 1, d + 7));
    case 'monthly':
      return clampedYmd(y, m - 1 + 1, d);
    case 'yearly':
      return clampedYmd(y + 1, m - 1, d);
  }
}

/** Build an ISO date from a UTC y/month/day, clamping the day to the resolved month's length. */
function clampedYmd(year: number, month: number, day: number): string {
  // month may be out of 0–11; normalize via a Date first, then clamp the day.
  const base = new Date(Date.UTC(year, month, 1));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(y, m, Math.min(day, lastDay)));
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
