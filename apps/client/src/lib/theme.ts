/** Light/dark theme, persisted; stamps `data-theme` on <html> so CSS overrides win. */
const KEY = 'zettra.theme';

export type Theme = 'light' | 'dark';

export function initTheme(): void {
  const saved = localStorage.getItem(KEY) as Theme | null;
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}

export function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(KEY, next);
  return next;
}
