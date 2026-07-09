/**
 * Pure calendar-agenda + reconciliation logic (§3, mail↔calendar). The server aggregates every
 * dated thing a user can see — reminders and date-typed field values — into `AgendaItem`s; these
 * helpers group them by day, surface scheduling conflicts (a day already carrying appointments),
 * and reconcile freshly-detected appointment dates (e.g. "Termin in 2 Wochen" from a mail) against
 * what is already booked. Deterministic (all keying on the caller-supplied `YYYY-MM-DD`, no
 * `Date.now()`), so the reconciliation heart is unit-testable.
 */

import { addDaysIso } from './date-extract';

export type AgendaKind = 'reminder' | 'field';

export interface AgendaItem {
  blockId: string;
  title: string;
  /** The day this item falls on, `YYYY-MM-DD`. */
  date: string;
  kind: AgendaKind;
  /** Field name (for `field`) or reminder note (for `reminder`); display-only. */
  label?: string;
}

export interface DayBucket {
  /** `YYYY-MM-DD`. */
  iso: string;
  items: AgendaItem[];
}

/** Group agenda items by day, days ascending; items within a day keep reminders before fields. */
export function groupByDay(items: AgendaItem[]): DayBucket[] {
  const byDay = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const bucket = byDay.get(item.date);
    if (bucket) bucket.push(item);
    else byDay.set(item.date, [item]);
  }
  const rank = (k: AgendaKind): number => (k === 'reminder' ? 0 : 1);
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([iso, list]) => ({
      iso,
      items: [...list].sort(
        (a, b) => rank(a.kind) - rank(b.kind) || a.title.localeCompare(b.title),
      ),
    }));
}

export interface Conflict {
  /** `YYYY-MM-DD`. */
  iso: string;
  items: AgendaItem[];
}

/**
 * Days carrying more than `max` items — candidate scheduling conflicts. With the default `max=1`,
 * any day with two or more dated things is flagged, which is what the calendar highlights and what
 * a mail-detected appointment is checked against before it is silently scheduled.
 */
export function findConflicts(items: AgendaItem[], max = 1): Conflict[] {
  return groupByDay(items)
    .filter((d) => d.items.length > max)
    .map((d) => ({ iso: d.iso, items: d.items }));
}

export interface Reconciliation {
  /** Proposed dates that land on an already-occupied day. */
  clashes: string[];
  /** Proposed dates that are free. */
  free: string[];
}

/**
 * Reconcile freshly-detected appointment dates against what is already booked (§ mail↔calendar).
 * A proposed date clashes when the existing agenda already has any item on that day. Input dates
 * are deduped; the result preserves ascending date order.
 */
export function reconcile(existing: AgendaItem[], proposed: string[]): Reconciliation {
  const busy = new Set(existing.map((i) => i.date));
  const seen = new Set<string>();
  const clashes: string[] = [];
  const free: string[] = [];
  for (const date of [...proposed].sort((a, b) => a.localeCompare(b))) {
    if (seen.has(date)) continue;
    seen.add(date);
    (busy.has(date) ? clashes : free).push(date);
  }
  return { clashes, free };
}

/**
 * The nearest open day at or after `targetIso` (§ mail↔calendar "find a free slot"). If the target
 * day is itself free it is returned unchanged; otherwise the search steps forward one day at a time
 * up to `maxSearch` days. Returns null when every day in the window is booked. Deterministic —
 * UTC date math against the caller's ISO input.
 */
export function nearestFreeDay(
  existing: AgendaItem[],
  targetIso: string,
  maxSearch = 14,
): string | null {
  const busy = new Set(existing.map((i) => i.date));
  for (let offset = 0; offset <= maxSearch; offset++) {
    const day = addDaysIso(targetIso, offset);
    if (!busy.has(day)) return day;
  }
  return null;
}
