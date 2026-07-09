import { describe, expect, it } from 'vitest';
import { findConflicts, groupByDay, reconcile, type AgendaItem } from './calendar-agenda';

function item(date: string, over: Partial<AgendaItem> = {}): AgendaItem {
  return { blockId: 'b', title: 't', date, kind: 'field', ...over };
}

describe('groupByDay', () => {
  it('groups by day, days ascending, reminders before fields', () => {
    const items = [
      item('2026-07-10', { title: 'Field A' }),
      item('2026-07-09', { title: 'Later reminder', kind: 'reminder' }),
      item('2026-07-09', { title: 'A field' }),
      item('2026-07-09', { title: 'Early reminder', kind: 'reminder' }),
    ];
    const buckets = groupByDay(items);
    expect(buckets.map((b) => b.iso)).toEqual(['2026-07-09', '2026-07-10']);
    expect(buckets[0].items.map((i) => i.title)).toEqual([
      'Early reminder',
      'Later reminder',
      'A field',
    ]);
  });

  it('is empty for no items', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('findConflicts', () => {
  it('flags days with more than one item by default', () => {
    const items = [item('2026-07-09'), item('2026-07-09'), item('2026-07-10')];
    const conflicts = findConflicts(items);
    expect(conflicts.map((c) => c.iso)).toEqual(['2026-07-09']);
    expect(conflicts[0].items).toHaveLength(2);
  });

  it('respects a custom threshold', () => {
    const items = [item('2026-07-09'), item('2026-07-09')];
    expect(findConflicts(items, 2)).toEqual([]);
  });
});

describe('reconcile', () => {
  it('splits proposed dates into free and clashing, deduped and sorted', () => {
    const existing = [item('2026-07-23', { kind: 'reminder' })];
    const { free, clashes } = reconcile(existing, ['2026-08-01', '2026-07-23', '2026-08-01']);
    expect(clashes).toEqual(['2026-07-23']);
    expect(free).toEqual(['2026-08-01']);
  });

  it('treats an empty agenda as all-free', () => {
    expect(reconcile([], ['2026-07-10']).free).toEqual(['2026-07-10']);
  });
});
