/**
 * Theme system with three modes — light, dark, and system — persisted per browser. "system"
 * follows the OS preference live via matchMedia. The resolved value is stamped as
 * `data-theme` on <html> so both the Tailwind `dark:` variant and the CSS tokens switch.
 */
const KEY = 'zettra.theme';

export type ThemeMode = 'light' | 'dark' | 'system';

let media: MediaQueryList | null = null;
let mediaListener: (() => void) | null = null;

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** The concrete light/dark currently applied (resolving "system"). */
export function resolvedTheme(): 'light' | 'dark' {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function getMode(): ThemeMode {
  const saved = localStorage.getItem(KEY) as ThemeMode | null;
  return saved ?? 'system';
}

function stamp(mode: ThemeMode): void {
  const dark = mode === 'dark' || (mode === 'system' && systemPrefersDark());
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

/** Apply a mode: persist it, stamp data-theme, and (re)bind the OS listener for "system". */
export function setMode(mode: ThemeMode): void {
  localStorage.setItem(KEY, mode);
  stamp(mode);

  if (media && mediaListener) media.removeEventListener('change', mediaListener);
  media = null;
  mediaListener = null;

  if (mode === 'system' && typeof window !== 'undefined') {
    media = window.matchMedia('(prefers-color-scheme: dark)');
    mediaListener = () => stamp('system');
    media.addEventListener('change', mediaListener);
  }
}

/** Initialise from persisted mode at boot. */
export function initTheme(): void {
  setMode(getMode());
}
