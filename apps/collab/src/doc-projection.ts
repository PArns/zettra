import * as Y from 'yjs';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { DocBlock } from '@zettra/shared';
import { serverSchema } from './schema';

/**
 * Convert a settled Yjs document into the BlockNote block tree the server's materialize
 * endpoint consumes (§8.7 step 1-2). Uses `@blocknote/server-util`'s ServerBlockNoteEditor
 * with the same custom schema as the client, so `reference`/`tag` inline nodes (and their
 * `blockId`s) survive the round-trip and `extractRefs` sees them.
 *
 * The returned BlockNote blocks are structurally the `DocBlock` shape extractRefs walks
 * (`type`, `props.blockId`, `content`, `children`), so the cast is safe.
 */
const editor = ServerBlockNoteEditor.create({ schema: serverSchema });

export function yDocToBlocks(doc: Y.Doc): DocBlock[] {
  const fragment = doc.getXmlFragment('document');
  if (!fragment || fragment.length === 0) return [];
  try {
    return editor.yDocToBlocks(doc, 'document') as unknown as DocBlock[];
  } catch {
    return [];
  }
}

/**
 * Rebuild a Yjs document from the stored block tree (the inverse of {@link yDocToBlocks}), for
 * onLoadDocument (§8.7): the Yjs doc is ephemeral, so on reopen it is reconstructed from the
 * `block.content` projection. Returns null when there is nothing to load.
 */
export function blocksToYDoc(blocks: DocBlock[]): Y.Doc | null {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  try {
    return editor.blocksToYDoc(
      blocks as unknown as Parameters<typeof editor.blocksToYDoc>[0],
      'document',
    );
  } catch {
    return null;
  }
}
