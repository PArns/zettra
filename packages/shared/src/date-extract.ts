/**
 * Pure natural-language date extraction (§5). Given free text (a captured mail, a note) and a
 * reference date, find the dates it mentions — "in 2 weeks", "next Thursday", "am 24.07.", ISO —
 * resolved to absolute ISO dates. Deterministic (no `Date.now()`, all math in UTC), so the mail
 * "detect a deadline" heart is unit-testable. English + German patterns.
 */

export interface ExtractedDate {
  /** Absolute date, `YYYY-MM-DD`. */
  iso: string;
  /** The text fragment that produced it. */
  match: string;
}

const UNIT_DAYS: Record<string, number> = {
  day: 1,
  days: 1,
  tag: 1,
  tage: 1,
  tagen: 1,
  week: 7,
  weeks: 7,
  woche: 7,
  wochen: 7,
  month: 30,
  months: 30,
  monat: 30,
  monate: 30,
  monaten: 30,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sonntag: 0,
  monday: 1,
  montag: 1,
  tuesday: 2,
  dienstag: 2,
  wednesday: 3,
  mittwoch: 3,
  thursday: 4,
  donnerstag: 4,
  friday: 5,
  freitag: 5,
  saturday: 6,
  samstag: 6,
};

/** Month names → 1-12, English + German, with common abbreviations (lowercased keys). */
const MONTHS: Record<string, number> = {
  january: 1, jan: 1, januar: 1,
  february: 2, feb: 2, februar: 2,
  march: 3, mar: 3, märz: 3, maerz: 3,
  april: 4, apr: 4,
  may: 5, mai: 5,
  june: 6, jun: 6, juni: 6,
  july: 7, jul: 7, juli: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10, oktober: 10, okt: 10,
  november: 11, nov: 11,
  december: 12, dec: 12, dezember: 12, dez: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Add `n` days to an ISO date, in UTC. */
export function addDaysIso(refIso: string, n: number): string {
  const [y, m, d] = refIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The next occurrence of `targetDow` (0=Sun) strictly after the reference date. */
function nextWeekday(refIso: string, targetDow: number): string {
  const [y, m, d] = refIso.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const delta = (targetDow - cur + 7) % 7 || 7;
  return addDaysIso(refIso, delta);
}

/** Extract absolute ISO dates mentioned in `text`, resolved against `refIso` (`YYYY-MM-DD`). */
export function extractDueDates(text: string, refIso: string): ExtractedDate[] {
  const out: ExtractedDate[] = [];
  const push = (iso: string, match: string): void => {
    if (iso && !out.some((o) => o.iso === iso)) out.push({ iso, match });
  };
  const lower = text.toLowerCase();

  // "in 2 weeks" / "in 3 Tagen"
  for (const m of lower.matchAll(/\bin\s+(\d{1,3})\s+([a-zä]+)\b/g)) {
    const unit = UNIT_DAYS[m[2]];
    if (unit) push(addDaysIso(refIso, Number(m[1]) * unit), m[0]);
  }

  // Keyword days. `\b` is ASCII-only (it won't bound "übermorgen"), so match that as a substring
  // and strip it before testing "morgen" so the two never double-count.
  const ueber = lower.includes('übermorgen') || lower.includes('day after tomorrow');
  const withoutUeber = lower.replace(/übermorgen/g, '');
  if (/\b(today|heute)\b/.test(lower)) push(refIso, 'today');
  if (ueber) push(addDaysIso(refIso, 2), 'übermorgen');
  if (/\btomorrow\b/.test(lower) || /\bmorgen\b/.test(withoutUeber)) {
    push(addDaysIso(refIso, 1), 'tomorrow');
  }

  // "next Monday" / "nächsten Donnerstag" / "am Freitag"
  for (const m of lower.matchAll(/\b(?:next|nächsten|nächste[rn]?|am|on)\s+([a-zä]+)\b/g)) {
    const wd = WEEKDAYS[m[1]];
    if (wd !== undefined) push(nextWeekday(refIso, wd), m[0]);
  }

  // ISO: 2026-08-01
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    push(`${m[1]}-${m[2]}-${m[3]}`, m[0]);
  }

  // German: 24.07.2026 / 24.7. (year defaults to the reference year). No trailing \b — the date
  // ends in a dot, which is a non-word char, so \b would never match after "24.7.".
  for (const m of text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/g)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    let y = m[3] ? Number(m[3]) : Number(refIso.slice(0, 4));
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) push(`${y}-${pad2(mo)}-${pad2(d)}`, m[0]);
  }

  // Named month, day-first (German): "30. September 2026" / "30 Sept" (year defaults to reference).
  for (const m of text.matchAll(/\b(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]+)\.?(?:\s+(\d{4}))?/g)) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) continue;
    const d = Number(m[1]);
    const y = m[3] ? Number(m[3]) : Number(refIso.slice(0, 4));
    if (d >= 1 && d <= 31) push(`${y}-${pad2(mo)}-${pad2(d)}`, m[0].trim());
  }

  // Named month, month-first (English): "September 30, 2026" / "Sep 5". The `(?!\d)` after the day
  // stops "September 2026" being read as month + day "20" (the year's first two digits).
  for (const m of text.matchAll(/\b([A-Za-zÄÖÜäöü]+)\.?\s+(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/g)) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (!mo) continue;
    const d = Number(m[2]);
    const y = m[3] ? Number(m[3]) : Number(refIso.slice(0, 4));
    if (d >= 1 && d <= 31) push(`${y}-${pad2(mo)}-${pad2(d)}`, m[0].trim());
  }

  return out.sort((a, b) => a.iso.localeCompare(b.iso));
}
