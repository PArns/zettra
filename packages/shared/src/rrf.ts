/**
 * Reciprocal Rank Fusion (§11 hybrid search). Combines several ranked id lists (e.g. dense
 * pgvector kNN + Postgres full-text) into one ranking without needing comparable scores:
 * each list contributes `1 / (k + rank)` per id. Pure and unit-tested.
 */
export interface FusedResult {
  id: string;
  score: number;
}

export function reciprocalRankFusion(lists: string[][], k = 60): FusedResult[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, index) => {
      const rank = index + 1;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
