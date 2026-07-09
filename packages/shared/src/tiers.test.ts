import { describe, expect, it } from 'vitest';
import { asTier, limitsFor, TenantTier, TIER_LIMITS, wouldExceed } from './tiers';

describe('asTier', () => {
  it('accepts valid tiers and falls back to Free', () => {
    expect(asTier('pro')).toBe(TenantTier.Pro);
    expect(asTier('team')).toBe(TenantTier.Team);
    expect(asTier('bogus')).toBe(TenantTier.Free);
    expect(asTier(undefined)).toBe(TenantTier.Free);
  });
});

describe('limitsFor', () => {
  it('returns the table entry for a tier', () => {
    expect(limitsFor(TenantTier.Free)).toEqual(TIER_LIMITS.free);
    expect(limitsFor(TenantTier.Pro).spaces).toBe(20);
    expect(limitsFor(TenantTier.Team).spaces).toBeNull(); // unlimited
  });
});

describe('wouldExceed', () => {
  it('is false while under the limit and true once adding would cross it', () => {
    expect(wouldExceed(2, 3)).toBe(false); // 2 + 1 = 3 ≤ 3
    expect(wouldExceed(3, 3)).toBe(true); // 3 + 1 = 4 > 3
    expect(wouldExceed(0, 1)).toBe(false); // first item allowed
    expect(wouldExceed(1, 1)).toBe(true); // second not
  });

  it('treats null as unlimited', () => {
    expect(wouldExceed(1_000_000, null)).toBe(false);
  });

  it('honors a custom add amount', () => {
    expect(wouldExceed(1, 3, 2)).toBe(false); // 1 + 2 = 3 ≤ 3
    expect(wouldExceed(2, 3, 2)).toBe(true); // 2 + 2 = 4 > 3
  });
});
