import { describe, expect, it } from 'vitest';
import { reciprocalRankFusion } from './rrf';

describe('reciprocalRankFusion', () => {
  it('ranks an id appearing high in multiple lists first', () => {
    const dense = ['a', 'b', 'c'];
    const fts = ['b', 'a', 'd'];
    const fused = reciprocalRankFusion([dense, fts]);
    // 'a' (ranks 1,2) and 'b' (ranks 2,1) both beat single-list 'c'/'d'.
    expect(fused[0]!.id === 'a' || fused[0]!.id === 'b').toBe(true);
    const ids = fused.map((f) => f.id);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'));
  });

  it('unions ids across lists', () => {
    const fused = reciprocalRankFusion([['a'], ['b'], ['c']]);
    expect(fused.map((f) => f.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('rewards a higher rank via the k constant', () => {
    const fused = reciprocalRankFusion([['x', 'y']], 60);
    expect(fused[0]!.id).toBe('x');
    expect(fused[0]!.score).toBeCloseTo(1 / 61, 6);
  });

  it('handles empty input', () => {
    expect(reciprocalRankFusion([])).toEqual([]);
  });
});
