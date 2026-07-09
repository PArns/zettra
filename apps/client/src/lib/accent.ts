/**
 * Accent color theme. Independent of light/dark: the chosen palette is stamped as `data-accent`
 * on <html> and overrides `--accent` / `--accent-2` (from which `--ring`, `--accent-soft`, etc.
 * derive). Persisted locally for instant apply; the app also syncs it to the user's server-side
 * settings when signed in.
 */
const KEY = 'zettra.accent';

export interface AccentDef {
  id: string;
  label: string;
  /** Representative swatch colors [from, to] for the picker. */
  swatch: [string, string];
}

export const ACCENTS: readonly AccentDef[] = [
  { id: 'teal', label: 'Türkis', swatch: ['#0891b2', '#3b82f6'] },
  { id: 'blue', label: 'Blau', swatch: ['#2563eb', '#22d3ee'] },
  { id: 'violet', label: 'Violett', swatch: ['#7c6dff', '#c07bff'] },
  { id: 'emerald', label: 'Grün', swatch: ['#059669', '#34d399'] },
  { id: 'rose', label: 'Rosé', swatch: ['#e11d48', '#fb7185'] },
  { id: 'amber', label: 'Amber', swatch: ['#d97706', '#f59e0b'] },
];

export const DEFAULT_ACCENT = 'teal';

export function isAccent(v: unknown): v is string {
  return typeof v === 'string' && ACCENTS.some((a) => a.id === v);
}

export function getAccent(): string {
  const saved = localStorage.getItem(KEY);
  return isAccent(saved) ? saved : DEFAULT_ACCENT;
}

export function setAccent(id: string): void {
  const accent = isAccent(id) ? id : DEFAULT_ACCENT;
  localStorage.setItem(KEY, accent);
  document.documentElement.setAttribute('data-accent', accent);
}

/** Apply the persisted accent at boot. */
export function initAccent(): void {
  setAccent(getAccent());
}
