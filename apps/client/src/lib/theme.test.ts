import { beforeEach, describe, expect, it } from 'vitest';
import { getMode, initTheme, resolvedTheme, setMode } from './theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme', () => {
  it('defaults to system mode when nothing is persisted', () => {
    expect(getMode()).toBe('system');
  });

  it('setMode persists the choice and stamps data-theme', () => {
    setMode('dark');
    expect(getMode()).toBe('dark');
    expect(localStorage.getItem('zettra.theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(resolvedTheme()).toBe('dark');

    setMode('light');
    expect(getMode()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(resolvedTheme()).toBe('light');
  });

  it('system mode resolves to a concrete light/dark via matchMedia', () => {
    setMode('system');
    // jsdom's matchMedia polyfill reports no dark preference, so system → light.
    expect(getMode()).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('initTheme restores the persisted mode onto <html>', () => {
    localStorage.setItem('zettra.theme', 'dark');
    initTheme();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(resolvedTheme()).toBe('dark');
  });
});
