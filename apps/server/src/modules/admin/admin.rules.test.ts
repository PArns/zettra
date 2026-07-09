import { describe, expect, it } from 'vitest';
import { leavesAnAdmin } from './admin.rules';

describe('leavesAnAdmin', () => {
  it('is true when another admin remains', () => {
    expect(leavesAnAdmin(['a', 'b'], 'a')).toBe(true);
  });

  it('is false when removing the only admin', () => {
    expect(leavesAnAdmin(['a'], 'a')).toBe(false);
  });

  it('is true when the target is not even an admin', () => {
    expect(leavesAnAdmin(['a', 'b'], 'c')).toBe(true);
  });

  it('is false for an empty admin set', () => {
    expect(leavesAnAdmin([], 'a')).toBe(false);
  });
});
