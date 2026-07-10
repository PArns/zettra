import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { BlockNoteView } from '@blocknote/mantine';
import { filterSuggestionItems, insertOrUpdateBlock } from '@blocknote/core';
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from '@blocknote/react';
import '@blocknote/mantine/style.css';
import { bookmarkHost } from '@zettra/shared';
import { api, getToken } from '../lib/api';
import { useToast } from '../components/Toast';
import { resolvedTheme } from '../lib/theme';
import { schema } from './inline';
import { TableToolbar, type EditorLike } from './TableToolbar';

/** The note's title: the first non-empty line of the document, trimmed to 80 chars. */
function firstLineTitle(editor: { document: Array<{ content?: unknown }> }): string {
  for (const block of editor.document) {
    const c = block.content;
    if (!Array.isArray(c)) continue;
    const text = c
      .map((n) => (n && typeof n === 'object' && 'text' in n ? String((n as { text?: string }).text ?? '') : ''))
      .join('')
      .trim();
    if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }
  return '';
}

/** Track the resolved light/dark theme so the editor re-themes when the switcher changes it. */
function useResolvedTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => resolvedTheme());
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(resolvedTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

type SyncState = 'connecting' | 'synced' | 'offline';

/**
 * Collaborative BlockNote editor for one block (§8.6, §13.1). Wires:
 * - image/file upload → `POST /api/uploads` (BlockNote's `uploadFile`), enabling drag-drop
 *   and paste of images.
 * - `#` tag, `@` person, `[` reference suggestion menus with fuzzy search + create-if-not-
 *   exists against the entity API (§8.6). The Yjs doc stays the source of truth (invariant 7).
 */
export function Editor({
  blockId,
  userName = 'You',
  onTitle,
}: {
  blockId: string;
  userName?: string;
  /** Reports the note's first non-empty line so the shell can title the note live. */
  onTitle?: (title: string) => void;
}) {
  const toast = useToast();
  const [sync, setSync] = useState<SyncState>('connecting');
  const theme = useResolvedTheme();

  const provider = useMemo(
    () => {
      // Same-origin `/collab` in prod (nginx). In dev, VITE_COLLAB_URL can point straight at the
      // backend origin (e.g. ws://localhost:5050) so the Hocuspocus WS bypasses the vite dev proxy.
      // Vite inlines import.meta.env; cast avoids needing the vite/client ambient types here.
      const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
      const base = env?.VITE_COLLAB_URL || location.origin.replace(/^http/, 'ws');
      return new HocuspocusProvider({
        url: `${base}/collab`,
        name: blockId,
        token: getToken() ?? '',
        document: new Y.Doc(),
      });
    },
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
        user: { name: userName, color: '#0891b2' },
      },
    },
    [provider],
  );

  // Report the initial title once content has loaded from the collab doc.
  useEffect(() => {
    const report = () => onTitle?.(firstLineTitle(editor));
    report();
    const t = setTimeout(report, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

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

  // The `/` slash menu: BlockNote defaults plus our custom blocks (§4 — callout, quote,
  // divider, bookmark). Filtered client-side by the typed query.
  const slashItems = async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    const custom: DefaultReactSuggestionItem[] = [
      {
        title: 'Callout',
        subtext: 'Highlighted info / tip / warning box',
        aliases: ['callout', 'admonition', 'note', 'info'],
        group: 'Blocks',
        icon: <span className="zx-slash-ico">💡</span>,
        onItemClick: () =>
          insertOrUpdateBlock(editor, { type: 'callout', props: { kind: 'info' } }),
      },
      {
        title: 'Quote',
        subtext: 'Blockquote',
        aliases: ['quote', 'blockquote', 'citation'],
        group: 'Blocks',
        icon: <span className="zx-slash-ico">❝</span>,
        onItemClick: () => insertOrUpdateBlock(editor, { type: 'quote' }),
      },
      {
        title: 'Divider',
        subtext: 'Horizontal rule',
        aliases: ['divider', 'hr', 'separator', 'rule'],
        group: 'Blocks',
        icon: <span className="zx-slash-ico">➖</span>,
        onItemClick: () => insertOrUpdateBlock(editor, { type: 'divider' }),
      },
      {
        title: 'Bookmark',
        subtext: 'Rich link preview card',
        aliases: ['bookmark', 'link', 'embed', 'url'],
        group: 'Blocks',
        icon: <span className="zx-slash-ico">🔖</span>,
        onItemClick: () => {
          const url = window.prompt('Bookmark URL')?.trim();
          if (!url) return;
          insertOrUpdateBlock(editor, {
            type: 'bookmark',
            props: { url, title: bookmarkHost(url) },
          });
        },
      },
      {
        title: 'Math',
        subtext: 'LaTeX formula (KaTeX)',
        aliases: ['math', 'latex', 'formula', 'equation', 'katex'],
        group: 'Blocks',
        icon: <span className="zx-slash-ico">∑</span>,
        onItemClick: () => {
          const latex = window.prompt('LaTeX')?.trim();
          insertOrUpdateBlock(editor, { type: 'math', props: { latex: latex ?? '' } });
        },
      },
      {
        title: 'Diagram',
        subtext: 'Mermaid diagram',
        aliases: ['mermaid', 'diagram', 'flowchart', 'graph', 'sequence'],
        group: 'Blocks',
        icon: <span className="zx-slash-ico">📊</span>,
        onItemClick: () => {
          const code = window.prompt('Mermaid diagram source')?.trim();
          insertOrUpdateBlock(editor, { type: 'mermaid', props: { code: code ?? '' } });
        },
      },
      {
        title: 'Toggle',
        subtext: 'Collapsible section (indent blocks under it)',
        aliases: ['toggle', 'collapse', 'collapsible', 'details', 'accordion'],
        group: 'Blocks',
        icon: <span className="zx-slash-ico">▸</span>,
        onItemClick: () => insertOrUpdateBlock(editor, { type: 'toggle', props: { open: true } }),
      },
      {
        title: 'Spreadsheet',
        subtext: 'Grid with =formulas, cell refs & conditional formatting',
        aliases: ['spreadsheet', 'formula', 'formel', 'sheet', 'excel', 'calc', 'tabelle'],
        group: 'Blocks',
        icon: <span className="zx-slash-ico">🔢</span>,
        onItemClick: () =>
          insertOrUpdateBlock(editor, { type: 'spreadsheet', props: { data: '' } }),
      },
    ];
    return filterSuggestionItems([...getDefaultReactSlashMenuItems(editor), ...custom], query);
  };

  const syncLabel =
    sync === 'synced'
      ? 'Synced'
      : sync === 'offline'
        ? 'Offline — changes saved locally'
        : 'Connecting…';
  return (
    <div className="editor-shell">
      {/* Discreet: when synced it's just a small dot in the corner (title tooltip); a problem
          state (connecting/offline) spells itself out so it's noticeable. */}
      <div className={`editor-status ${sync}`} title={syncLabel}>
        <span className={`sync-dot ${sync}`} />
        {sync !== 'synced' && <span className="sync-label">{syncLabel}</span>}
      </div>
      <div className="editor-host">
        <BlockNoteView
          editor={editor}
          theme={theme}
          slashMenu={false}
          onChange={() => onTitle?.(firstLineTitle(editor))}
        >
          {/* / → block insert menu (defaults + custom blocks). */}
          <SuggestionMenuController triggerCharacter="/" getItems={slashItems} />
          {/* # → tag, @ → person reference, [ → general reference (§8.6). */}
          <SuggestionMenuController triggerCharacter="#" getItems={referenceItems('tag')} />
          <SuggestionMenuController triggerCharacter="@" getItems={referenceItems('reference')} />
          <SuggestionMenuController triggerCharacter="[" getItems={referenceItems('reference')} />
        </BlockNoteView>
      </div>
      {/* Floating table tools (header row/col, formula summary, cross-reference) when a table is focused. */}
      <TableToolbar editor={editor as unknown as EditorLike} />
    </div>
  );
}
