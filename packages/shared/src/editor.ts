/**
 * Editor document + reference-primitive types (§8.6, §8.7).
 *
 * `#tags` and `[[references]]` are the SAME inline primitive: a node with
 * `propSchema { blockId, label }`, label display-only (invariant 4). These types describe
 * the settled BlockNote/ProseMirror JSON that the persistence hook reads as the source of
 * truth (invariant 7) and that `extractRefs` walks.
 */

export const REFERENCE_NODE_TYPE = 'reference' as const;
export const TAG_NODE_TYPE = 'tag' as const;

/** Props carried by both the `reference` and `tag` inline nodes. */
export interface ReferenceProps {
  /** The stored identity. The label is re-resolved from the target on render (invariant 4). */
  blockId: string;
  /** Display-only cached label; never authoritative. */
  label: string;
}

/** A minimal inline-node shape sufficient for `extractRefs` traversal. */
export interface InlineNode {
  type?: string;
  /** Plain text for `text` nodes (used by the ingest-time mention linker, §8.4). */
  text?: string;
  props?: Partial<ReferenceProps> & Record<string, unknown>;
  content?: InlineNode[];
}

/** A block node in the settled document tree. */
export interface DocBlock {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  content?: InlineNode[];
  children?: DocBlock[];
}

/** Result of walking a document for reference/tag targets (§8.7). */
export interface ExtractedRefs {
  referenceIds: Set<string>;
  tagIds: Set<string>;
}
