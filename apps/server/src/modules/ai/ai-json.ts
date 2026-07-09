/**
 * Robust parsing of structured model output (§14.5: the parse step is the schema gate).
 * Local models often wrap JSON in prose or code fences and emit out-of-range confidences;
 * these pure helpers tolerate the former and clamp the latter. Unit-tested.
 */

/** Extract the JSON object from a model response that may wrap it in prose/```json fences. */
export function extractJson(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  if (fenced) return fenced[1]!;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end > start) return raw.slice(start, end + 1);
  return raw;
}

/** Clamp a confidence to a finite [0,1]; throws if it is not a finite number. */
export function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('confidence missing or non-finite');
  }
  return Math.max(0, Math.min(1, value));
}
