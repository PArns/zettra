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
