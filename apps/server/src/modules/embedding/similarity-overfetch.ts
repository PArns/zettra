/**
 * Overfetch sizing for HNSW-accelerated soft-connection search (§8.4). The similarity query
 * asks the vector index for a candidate set ordered by ANN distance, then re-ranks/filters it
 * down to `limit`. A generous candidate set keeps recall high (and *exact* whenever a tenant's
 * visible embeddings fit inside it) while bounding work for very large tenants.
 *
 * Pure and unit-tested so the recall/cost trade-off is explicit and reviewable.
 */

/** Candidate set = `limit * multiplier`, floored, so small `limit`s still get a wide net. */
export const OVERFETCH_MULTIPLIER = 20;
export const OVERFETCH_FLOOR = 200;

export function overfetchLimit(
  limit: number,
  multiplier = OVERFETCH_MULTIPLIER,
  floor = OVERFETCH_FLOOR,
): number {
  const wanted = Math.max(1, Math.trunc(limit)) * multiplier;
  return Math.max(wanted, floor);
}
