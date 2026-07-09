import { beforeEach, describe, expect, it } from 'vitest';
import { currentTheme, initTheme, toggleTheme } from './theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme', () => {
  it('toggles between light and dark and persists the choice', () => {
    const first = toggleTheme();
    expect(['light', 'dark']).toContain(first);
    expect(document.documentElement.getAttribute('data-theme')).toBe(first);
    expect(localStorage.getItem('zettra.theme')).toBe(first);

    const second = toggleTheme();
    expect(second).not.toBe(first);
    expect(document.documentElement.getAttribute('data-theme')).toBe(second);
  });

  it('initTheme restores the persisted theme onto <html>', () => {
    localStorage.setItem('zettra.theme', 'dark');
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(currentTheme()).toBe('dark');
  });

  it('currentTheme reads the data-theme attribute when set', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    expect(currentTheme()).toBe('light');
  });
});
