/**
 * Framework-agnostic BlockNote *block* configs (§4). Mirrors the reference-primitive pattern:
 * the prop schema + type name live here so the client (React render) and the collab server
 * (DOM render for `ServerBlockNoteEditor`) register structurally identical block specs. If the
 * two schemas diverge, the Yjs round-trip drops unknown blocks — so both build from these.
 *
 * These extend BlockNote's defaults with callout/admonition, blockquote, divider, web bookmark,
 * LaTeX math (KaTeX), and Mermaid diagram blocks.
 *
 * SPEC-GAP: promoting the kanban/formula-table widgets to first-class block types remains —
 * it needs interactive (browser-driven) iteration.
 */

export const CALLOUT_KINDS = ['info', 'tip', 'warning', 'danger', 'note'] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export interface CalloutMeta {
  glyph: string;
  label: string;
  /** CSS custom property holding the accent color for this kind. */
  colorVar: string;
}

const CALLOUT_META: Record<CalloutKind, CalloutMeta> = {
  info: { glyph: 'ℹ️', label: 'Info', colorVar: '--blue' },
  tip: { glyph: '💡', label: 'Tip', colorVar: '--green' },
  warning: { glyph: '⚠️', label: 'Warning', colorVar: '--amber' },
  danger: { glyph: '🛑', label: 'Danger', colorVar: '--red' },
  note: { glyph: '📝', label: 'Note', colorVar: '--accent' },
};

/** Coerce an arbitrary stored value to a valid callout kind (defaults to `info`). */
export function calloutKind(value: unknown): CalloutKind {
  return (CALLOUT_KINDS as readonly string[]).includes(value as string)
    ? (value as CalloutKind)
    : 'info';
}

export function calloutMeta(value: unknown): CalloutMeta {
  return CALLOUT_META[calloutKind(value)];
}

/** Block type names (kept in one place so client + server can't drift). */
export const BLOCK_TYPES = {
  callout: 'callout',
  quote: 'quote',
  divider: 'divider',
  bookmark: 'bookmark',
  math: 'math',
  mermaid: 'mermaid',
  toggle: 'toggle',
} as const;

/** Collapsible toggle: an inline header whose nested child blocks hide when `open` is false. */
export const togglePropSchema = {
  open: { default: true as boolean },
} as const;

/** LaTeX math block (KaTeX renders it client-side; the server keeps the source as text). */
export const mathPropSchema = {
  latex: { default: '' as string },
} as const;

/** Mermaid diagram block (mermaid renders it client-side; the server keeps the source as text). */
export const mermaidPropSchema = {
  code: { default: '' as string },
} as const;

export const calloutPropSchema = {
  kind: { default: 'info' as string, values: CALLOUT_KINDS },
} as const;

export const bookmarkPropSchema = {
  url: { default: '' as string },
  title: { default: '' as string },
  description: { default: '' as string },
  favicon: { default: '' as string },
} as const;

/** Best-effort hostname for display; falls back to the raw string. */
export function bookmarkHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
