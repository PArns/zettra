/**
 * Pure admin-safety rules. Kept side-effect-free so the "never lock yourself out" guarantees are
 * unit-testable without a database.
 */

/** Would removing/demoting `userId` still leave at least one admin among `adminIds`? */
export function leavesAnAdmin(adminIds: string[], userId: string): boolean {
  return adminIds.some((id) => id !== userId);
}
