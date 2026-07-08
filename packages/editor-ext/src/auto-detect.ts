/**
 * Auto-detection matchers for inline URL and date content (§8.6). Fed by ProseMirror input
 * rules in the client. All auto-detection SUGGESTS (subtle underline, accept with Tab/Enter)
 * and never force-replaces text under the cursor (invariant 10) — these functions only
 * classify; the accept/reject UX lives in the plugin.
 */

// Pragmatic URL matcher: http(s) or bare www., ending at whitespace.
const URL_RE = /\b(https?:\/\/[^\s]+|www\.[^\s]+)$/i;

// ISO-8601 date and common `YYYY-MM-DD` / `DD.MM.YYYY` (DE) forms.
const ISO_DATE_RE = /\b(\d{4}-\d{2}-\d{2})$/;
const DE_DATE_RE = /\b(\d{1,2}\.\d{1,2}\.\d{4})$/;

export interface DetectedUrl {
  kind: 'url';
  href: string;
  from: number;
}

export interface DetectedDate {
  kind: 'date';
  /** Normalized ISO date (YYYY-MM-DD). */
  iso: string;
  raw: string;
  from: number;
}

export function detectUrl(textBefore: string): DetectedUrl | null {
  const m = URL_RE.exec(textBefore);
  if (!m) return null;
  const raw = m[1]!;
  const href = raw.startsWith('www.') ? `https://${raw}` : raw;
  return { kind: 'url', href, from: textBefore.length - raw.length };
}

export function detectDate(textBefore: string): DetectedDate | null {
  const iso = ISO_DATE_RE.exec(textBefore);
  if (iso) {
    return { kind: 'date', iso: iso[1]!, raw: iso[1]!, from: textBefore.length - iso[1]!.length };
  }
  const de = DE_DATE_RE.exec(textBefore);
  if (de) {
    const raw = de[1]!;
    const [d, mo, y] = raw.split('.');
    const norm = `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
    return { kind: 'date', iso: norm, raw, from: textBefore.length - raw.length };
  }
  return null;
}
