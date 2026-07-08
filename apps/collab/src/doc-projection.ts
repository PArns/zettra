import * as Y from 'yjs';
import { DocBlock } from '@zettra/shared';

/**
 * Convert a settled Yjs document into the BlockNote block tree the server's materialize
 * endpoint consumes (§8.7 step 1-2).
 *
 * SPEC-GAP: full BlockNote<->Yjs projection needs BlockNote's server schema
 * (`@blocknote/server-util` `ServerBlockNoteEditor.yDocToBlocks`). Wiring that (and the
 * inverse for bidirectional field sync, §11) is the Phase 5 critical path. For now this
 * best-effort reads the shared `document` XML fragment so the pipeline is exercised end to
 * end; it returns [] when the fragment is absent rather than throwing.
 */
export function yDocToBlocks(doc: Y.Doc): DocBlock[] {
  const fragment = doc.getXmlFragment('document');
  if (!fragment || fragment.length === 0) return [];
  const blocks: DocBlock[] = [];
  for (const node of fragment.toArray()) {
    if (node instanceof Y.XmlElement) {
      blocks.push(xmlElementToBlock(node));
    }
  }
  return blocks;
}

function xmlElementToBlock(el: Y.XmlElement): DocBlock {
  const block: DocBlock = { type: el.nodeName, content: [], children: [] };
  for (const child of el.toArray()) {
    if (child instanceof Y.XmlElement) {
      // Inline reference/tag nodes carry their target as an attribute.
      const blockId = child.getAttribute('blockId');
      const label = child.getAttribute('label');
      if (blockId && (child.nodeName === 'reference' || child.nodeName === 'tag')) {
        block.content!.push({ type: child.nodeName, props: { blockId, label: label ?? '' } });
      } else {
        block.children!.push(xmlElementToBlock(child));
      }
    }
  }
  return block;
}
