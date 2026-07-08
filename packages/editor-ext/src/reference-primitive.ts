import { REFERENCE_NODE_TYPE, TAG_NODE_TYPE, ReferenceProps } from '@zettra/shared';

/**
 * The reference inline primitive (§8.6). `#tags` and `[[references]]` are the SAME custom
 * inline node — a node with `propSchema { blockId, label }`, label display-only (invariant 4).
 * `@` is a `reference` filtered to `#person`.
 *
 * This module declares the framework-agnostic prop schema + trigger grammar. The concrete
 * BlockNote spec (`createReactInlineContentSpec`) and ProseMirror plugin are assembled in the
 * client against these definitions.
 */

export const INLINE_TYPES = {
  reference: REFERENCE_NODE_TYPE,
  tag: TAG_NODE_TYPE,
} as const;

/** BlockNote-style prop schema for both inline nodes. `blockId` is the stored identity. */
export const referencePropSchema = {
  blockId: { default: '' as string },
  label: { default: '' as string },
} as const;

export type ReferenceKind = keyof typeof INLINE_TYPES;

/** A resolved suggestion item returned by a `getItems` fuzzy search (§8.6). */
export interface SuggestionItem {
  blockId: string;
  label: string;
  /** Present on the synthetic "Create new: …" item → create-if-not-exists. */
  isCreateNew?: boolean;
}

export function makeReferenceProps(blockId: string, label: string): ReferenceProps {
  return { blockId, label };
}
