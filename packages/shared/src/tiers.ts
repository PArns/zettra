/**
 * Subscription tiers and their limits (§5). A tenant has one tier; limits are enforced at the
 * create paths (members, spaces, blocks, storage). Pure and table-driven so the caps are
 * obvious and unit-testable; `null` means unlimited.
 */

export enum TenantTier {
  Free = 'free',
  Pro = 'pro',
  Team = 'team',
}

/** Countable resources a limit can apply to. */
export type LimitedResource = 'members' | 'spaces' | 'blocks' | 'storageMb';

export interface TierLimits {
  members: number | null;
  spaces: number | null;
  blocks: number | null;
  /** Total uploaded bytes budget, in mebibytes. */
  storageMb: number | null;
}

export const TIER_LIMITS: Record<TenantTier, TierLimits> = {
  [TenantTier.Free]: { members: 1, spaces: 3, blocks: 2_000, storageMb: 500 },
  [TenantTier.Pro]: { members: 5, spaces: 20, blocks: 50_000, storageMb: 10_240 },
  [TenantTier.Team]: { members: 50, spaces: null, blocks: 1_000_000, storageMb: 102_400 },
};

export interface TierMeta {
  id: TenantTier;
  label: string;
}

export const TIERS: readonly TierMeta[] = [
  { id: TenantTier.Free, label: 'Free' },
  { id: TenantTier.Pro, label: 'Pro' },
  { id: TenantTier.Team, label: 'Team' },
];

/** Coerce an arbitrary stored value to a valid tier (defaults to Free). */
export function asTier(value: unknown): TenantTier {
  return Object.values(TenantTier).includes(value as TenantTier)
    ? (value as TenantTier)
    : TenantTier.Free;
}

export function limitsFor(tier: TenantTier): TierLimits {
  return TIER_LIMITS[asTier(tier)];
}

/**
 * Would adding `add` items to the current `current` count exceed the limit? `null` (unlimited)
 * never exceeds. Used before creating a member/space/block/upload.
 */
export function wouldExceed(current: number, limit: number | null, add = 1): boolean {
  return limit != null && current + add > limit;
}

export interface TierUsage {
  members: number;
  spaces: number;
  blocks: number;
  storageMb: number;
}
