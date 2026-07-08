import { useEffect, useMemo } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { getToken } from '../api';

/**
 * Collaborative BlockNote editor for one block. Connects to the Hocuspocus `collab` server
 * (§13.1) with the document name = blockId. The Yjs document is the source of truth (inv. 7);
 * the server materializes rows from it via the persistence hook (§8.7).
 *
 * SPEC-GAP: the `#`/`[[`/`@` suggestion menus and auto-detect input rules from
 * `@zettra/editor-ext` (§8.6) attach here; wired in the editor phase.
 */
export function Editor({ blockId }: { blockId: string }) {
  const provider = useMemo(
    () =>
      new HocuspocusProvider({
        url: `${location.origin.replace(/^http/, 'ws')}/collab`,
        name: blockId,
        token: getToken() ?? '',
        document: new Y.Doc(),
      }),
    [blockId],
  );

  useEffect(() => () => provider.destroy(), [provider]);

  const editor = useCreateBlockNote({
    collaboration: {
      provider,
      fragment: provider.document.getXmlFragment('document'),
      user: { name: 'You', color: '#4f46e5' },
    },
  });

  return <BlockNoteView editor={editor} />;
}
