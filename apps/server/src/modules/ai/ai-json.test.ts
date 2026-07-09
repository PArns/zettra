import { describe, expect, it } from 'vitest';
import { clampConfidence, extractJson } from './ai-json';

describe('extractJson', () => {
  it('unwraps a ```json fenced block', () => {
    const raw = 'Here you go:\n```json\n{"tag":"task","confidence":0.9}\n```\nDone.';
    expect(JSON.parse(extractJson(raw))).toEqual({ tag: 'task', confidence: 0.9 });
  });

  it('unwraps a bare ``` fence', () => {
    expect(JSON.parse(extractJson('```\n{"a":1}\n```'))).toEqual({ a: 1 });
  });

  it('slices the object out of surrounding prose', () => {
    expect(JSON.parse(extractJson('The answer is {"x":true} obviously'))).toEqual({ x: true });
  });

  it('returns raw when already plain JSON', () => {
    expect(JSON.parse(extractJson('{"y":2}'))).toEqual({ y: 2 });
  });
});

describe('clampConfidence', () => {
  it('passes through values already in range', () => {
    expect(clampConfidence(0)).toBe(0);
    expect(clampConfidence(0.42)).toBe(0.42);
    expect(clampConfidence(1)).toBe(1);
  });

  it('clamps out-of-range numbers so they cannot force approval', () => {
    expect(clampConfidence(5)).toBe(1);
    expect(clampConfidence(-3)).toBe(0);
  });

  it('throws on non-finite / non-number (the schema gate, §14.5)', () => {
    expect(() => clampConfidence(Infinity)).toThrow();
    expect(() => clampConfidence(NaN)).toThrow();
    expect(() => clampConfidence('0.9')).toThrow();
    expect(() => clampConfidence(undefined)).toThrow();
  });
});
