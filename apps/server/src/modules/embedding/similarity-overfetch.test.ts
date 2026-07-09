import { describe, expect, it } from 'vitest';
import { overfetchLimit, OVERFETCH_FLOOR, OVERFETCH_MULTIPLIER } from './similarity-overfetch';

describe('overfetchLimit', () => {
  it('scales with limit above the floor', () => {
    expect(overfetchLimit(20)).toBe(20 * OVERFETCH_MULTIPLIER); // 400 > floor
    expect(overfetchLimit(50)).toBe(50 * OVERFETCH_MULTIPLIER); // 1000
  });

  it('never drops below the floor for small limits', () => {
    expect(overfetchLimit(1)).toBe(OVERFETCH_FLOOR);
    expect(overfetchLimit(10)).toBe(OVERFETCH_FLOOR); // 200 == floor
  });

  it('honors custom multiplier/floor', () => {
    expect(overfetchLimit(5, 10, 10)).toBe(50);
    expect(overfetchLimit(1, 2, 500)).toBe(500);
  });

  it('guards against non-positive/fractional limits', () => {
    expect(overfetchLimit(0)).toBe(OVERFETCH_FLOOR);
    expect(overfetchLimit(-5)).toBe(OVERFETCH_FLOOR);
    expect(overfetchLimit(3.9, 20, 1)).toBe(60); // trunc(3.9)=3 → 60
  });
});
