import { describe, expect, it } from 'vitest';
import { bookmarkHost, calloutKind, calloutMeta, CALLOUT_KINDS } from './blocks';

describe('calloutKind', () => {
  it('accepts every declared kind', () => {
    for (const k of CALLOUT_KINDS) expect(calloutKind(k)).toBe(k);
  });

  it('falls back to info for unknown or non-string values', () => {
    expect(calloutKind('bogus')).toBe('info');
    expect(calloutKind(undefined)).toBe('info');
    expect(calloutKind(42)).toBe('info');
    expect(calloutKind(null)).toBe('info');
  });
});

describe('calloutMeta', () => {
  it('returns a glyph, label, and color var per kind', () => {
    const meta = calloutMeta('warning');
    expect(meta.label).toBe('Warning');
    expect(meta.colorVar).toBe('--amber');
    expect(meta.glyph).toBeTruthy();
  });

  it('resolves the info fallback for junk input', () => {
    expect(calloutMeta('nope').label).toBe('Info');
  });
});

describe('bookmarkHost', () => {
  it('extracts the host from a valid URL', () => {
    expect(bookmarkHost('https://www.postgresql.org/docs')).toBe('www.postgresql.org');
    expect(bookmarkHost('http://yjs.dev')).toBe('yjs.dev');
  });

  it('returns the raw string when it is not a URL', () => {
    expect(bookmarkHost('not a url')).toBe('not a url');
  });
});
