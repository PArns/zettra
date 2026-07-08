import { describe, expect, it } from 'vitest';
import { detectTrigger } from './triggers';
import { detectUrl, detectDate } from './auto-detect';

describe('detectTrigger', () => {
  it('detects a tag trigger at token start', () => {
    expect(detectTrigger('hello #ta')).toEqual({ kind: 'tag', query: 'ta', from: 6 });
  });

  it('detects a person trigger', () => {
    expect(detectTrigger('cc @ali')).toEqual({ kind: 'person', query: 'ali', from: 3 });
  });

  it('detects the [[ reference trigger and precedes # inside it', () => {
    expect(detectTrigger('see [[Proj')).toEqual({ kind: 'reference', query: 'Proj', from: 4 });
    expect(detectTrigger('see [[#foo')).toEqual({ kind: 'reference', query: '#foo', from: 4 });
  });

  it('dismisses when the query contains whitespace', () => {
    expect(detectTrigger('#tag done')).toBeNull();
  });

  it('dismisses a closed [[ reference', () => {
    expect(detectTrigger('[[Done]] next')).toBeNull();
  });

  it('returns null with no trigger', () => {
    expect(detectTrigger('just text')).toBeNull();
  });
});

describe('auto-detect', () => {
  it('detects http and bare www urls, normalizing www', () => {
    expect(detectUrl('visit https://zettra.dev')?.href).toBe('https://zettra.dev');
    expect(detectUrl('see www.example.com')?.href).toBe('https://www.example.com');
    expect(detectUrl('no url here')).toBeNull();
  });

  it('detects ISO and German dates, normalizing to ISO', () => {
    expect(detectDate('due 2026-08-01')?.iso).toBe('2026-08-01');
    expect(detectDate('am 1.8.2026')?.iso).toBe('2026-08-01');
    expect(detectDate('nope')).toBeNull();
  });
});
