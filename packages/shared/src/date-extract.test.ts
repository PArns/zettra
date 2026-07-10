import { describe, expect, it } from 'vitest';
import { addDaysIso, extractDueDates } from './date-extract';

const REF = '2026-07-09'; // a Thursday

function isos(text: string): string[] {
  return extractDueDates(text, REF).map((d) => d.iso);
}

describe('extractDueDates', () => {
  it('resolves relative offsets in English and German', () => {
    expect(isos('let’s meet in 2 weeks')).toEqual(['2026-07-23']);
    expect(isos('Rechnung in 3 Tagen fällig')).toEqual(['2026-07-12']);
    expect(isos('review in 1 month')).toEqual(['2026-08-08']);
  });

  it('resolves keyword dates', () => {
    expect(isos('do it today')).toEqual([REF]);
    expect(isos('bis morgen')).toEqual(['2026-07-10']);
    expect(isos('übermorgen')).toEqual(['2026-07-11']);
  });

  it('resolves the next weekday (never today)', () => {
    // From Thu 2026-07-09, next Monday is 2026-07-13.
    expect(isos('next monday')).toEqual(['2026-07-13']);
    expect(isos('am Freitag')).toEqual(['2026-07-10']);
  });

  it('parses explicit German and ISO dates', () => {
    expect(isos('Termin am 24.07.2026')).toEqual(['2026-07-24']);
    expect(isos('am 24.7.')).toEqual(['2026-07-24']); // year from reference
    expect(isos('deadline 2026-08-01')).toEqual(['2026-08-01']);
  });

  it('parses named-month dates (invoice deadlines), German and English', () => {
    expect(isos('Fällig am 30. September 2026')).toEqual(['2026-09-30']);
    expect(isos('Rechnung fällig am 5. Mai')).toEqual(['2026-05-05']); // year from reference
    expect(isos('Payment due September 30, 2026')).toEqual(['2026-09-30']);
    expect(isos('due Sep 5 2026')).toEqual(['2026-09-05']);
  });

  it('does not read a bare "Month YYYY" as a day', () => {
    expect(isos('report for September 2026')).toEqual([]);
  });

  it('finds several distinct dates, sorted, deduped', () => {
    expect(isos('call tomorrow, then again in 2 weeks and on 2026-07-10')).toEqual([
      '2026-07-10',
      '2026-07-23',
    ]);
  });

  it('returns nothing when there is no date', () => {
    expect(isos('just some thoughts about the project')).toEqual([]);
  });
});

describe('addDaysIso', () => {
  it('adds across month boundaries in UTC', () => {
    expect(addDaysIso('2026-07-30', 3)).toBe('2026-08-02');
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31');
  });
});
