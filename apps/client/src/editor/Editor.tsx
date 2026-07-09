import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { BlockNoteView } from '@blocknote/mantine';
import {
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import '@blocknote/mantine/style.css';
import { api, getToken } from '../lib/api';
import { useToast } from '../components/Toast';
import { schema } from './inline';

type SyncState = 'connecting' | 'synced' | 'offline';

/**
 * Collaborative BlockNote editor for one block (§8.6, §13.1). Wires:
 * - image/file upload → `POST /api/uploads` (BlockNote's `uploadFile`), enabling drag-drop
 *   and paste of images.
 * - `#` tag, `@` person, `[` reference suggestion menus with fuzzy search + create-if-not-
 *   exists against the entity API (§8.6). The Yjs doc stays the source of truth (invariant 7).
 */
export function Editor({ blockId, userName = 'You' }: { blockId: string; userName?: string }) {
  const toast = useToast();
  const [sync, setSync] = useState<SyncState>('connecting');

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

  useEffect(() => {
    const onStatus = (e: { status: string }) => {
      if (e.status === 'connected') setSync('synced');
      else if (e.status === 'disconnected') setSync('offline');
      else setSync('connecting');
    };
    const onSynced = () => setSync('synced');
    provider.on('status', onStatus);
    provider.on('synced', onSynced);
    return () => {
      provider.off('status', onStatus);
      provider.off('synced', onSynced);
      provider.destroy();
    };
  }, [provider]);

  const editor = useCreateBlockNote(
    {
      schema,
      uploadFile: async (file: File) => {
        try {
          return await api.upload(file);
        } catch {
          toast.error('Upload failed');
          throw new Error('upload failed');
        }
      },
      collaboration: {
        provider,
        fragment: provider.document.getXmlFragment('document'),
        user: { name: userName, color: '#6d5efc' },
      },
    },
    [provider],
  );

  const referenceItems = (kind: 'reference' | 'tag', tagName?: string) => {
    return async (query: string): Promise<DefaultReactSuggestionItem[]> => {
      const hits = await api.searchEntities(query).catch(() => []);
      const items: DefaultReactSuggestionItem[] = hits.map((h) => ({
        title: h.alias,
        onItemClick: () =>
          editor.insertInlineContent([
            { type: kind, props: { blockId: h.blockId, label: h.alias } },
            ' ',
          ]),
      }));
      if (query.trim()) {
        items.push({
          title: `Create "${query}"`,
          onItemClick: async () => {
            const created = await api.createEntity({ name: query, tagName });
            editor.insertInlineContent([
              { type: kind, props: { blockId: created.blockId, label: created.label } },
              ' ',
            ]);
          },
        });
      }
      return items;
    };
  };

  return (
    <div>
      <div className="editor-status">
        <span className={`sync-dot ${sync}`} />
        {sync === 'synced'
          ? 'Synced'
          : sync === 'offline'
            ? 'Offline — changes saved locally'
            : 'Connecting…'}
      </div>
      <div className="editor-host">
        <BlockNoteView editor={editor} theme={currentTheme()}>
          {/* # → tag, @ → person reference, [ → general reference (§8.6). */}
          <SuggestionMenuController triggerCharacter="#" getItems={referenceItems('tag')} />
          <SuggestionMenuController triggerCharacter="@" getItems={referenceItems('reference')} />
          <SuggestionMenuController triggerCharacter="[" getItems={referenceItems('reference')} />
        </BlockNoteView>
      </div>
    </div>
  );
}

function currentTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
