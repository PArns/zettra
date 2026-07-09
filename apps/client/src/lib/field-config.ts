/**
 * Pure helpers for editing a supertag field's `config` (§8.1). Kept side-effect-free so the
 * option/parse logic that the property editor depends on is unit-testable in isolation.
 */

/** Field types whose `config.options` drives a fixed choice list. */
export function needsOptions(type: string): boolean {
  return type === 'select' || type === 'multi_select';
}

/** Field types that point at another supertag via `config.targetTagId`. */
export function needsRelationTarget(type: string): boolean {
  return type === 'relation';
}

/** Field types for which a scalar default value makes sense in the editor. */
export function supportsDefault(type: string): boolean {
  return type === 'text' || type === 'number' || type === 'date' || type === 'url';
}

/**
 * Parse a user-entered option list (one per line, or comma-separated) into a clean, de-duplicated
 * array — trimming blanks and collapsing accidental duplicates while preserving first-seen order.
 */
export function parseOptions(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const opt = raw.trim();
    if (opt && !seen.has(opt)) {
      seen.add(opt);
      out.push(opt);
    }
  }
  return out;
}

/** Render an option array back into the newline-separated text the editor edits. */
export function formatOptions(options: unknown): string {
  return Array.isArray(options) ? options.map(String).join('\n') : '';
}

/** Read `config.options` as a string array regardless of how it was stored. */
export function optionsOf(config: Record<string, unknown>): string[] {
  return Array.isArray(config.options) ? config.options.map(String) : [];
}
