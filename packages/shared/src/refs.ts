/**
 * `extractRefs` — pure walk of a settled document for reference/tag targets (§8.7).
 *
 * This is the reference implementation from the spec, typed. It is the read half of the
 * persistence hook; `materializeRefs` (server-side, in a transaction) diffs these sets
 * against stored rows. Reference deletes MUST be scoped to `kind='mention'` (invariant 5)
 * — that scoping lives in `materializeRefs`, not here.
 */
import { DocBlock, ExtractedRefs, InlineNode, REFERENCE_NODE_TYPE, TAG_NODE_TYPE } from './editor';

export function extractRefs(blocks: DocBlock[]): ExtractedRefs {
  const referenceIds = new Set<string>();
  const tagIds = new Set<string>();

  const visitInline = (nodes: InlineNode[] = []): void => {
    for (const n of nodes) {
      const id = n.props?.blockId;
      if (id && n.type === REFERENCE_NODE_TYPE) referenceIds.add(id);
      if (id && n.type === TAG_NODE_TYPE) tagIds.add(id);
      if (n.content) visitInline(n.content);
    }
  };

  const visitBlock = (b: DocBlock): void => {
    visitInline(b.content);
    b.children?.forEach(visitBlock);
  };

  blocks.forEach(visitBlock);
  return { referenceIds, tagIds };
}
