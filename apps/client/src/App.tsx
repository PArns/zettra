import { useCallback, useEffect, useState } from 'react';
import type { BlockDto } from '@zettra/shared';
import { api, getToken, setToken } from './api';
import { Auth } from './components/Auth';
import { Editor } from './components/Editor';

/**
 * App shell: an auth gate, a Briefkasten (inbox) sidebar, and a collaborative editor pane.
 * This is the v1 foundation UI — views, boards, and the Related sidebar attach in later phases.
 */
export function App() {
  const [authed, setAuthed] = useState<boolean>(!!getToken());
  const [me, setMe] = useState<{ tenantId: string; spaces: string[] } | null>(null);
  const [inbox, setInbox] = useState<BlockDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [meRes, inboxRes] = await Promise.all([api.me(), api.inbox()]);
      setMe(meRes);
      setInbox(inboxRes);
    } catch {
      // Token likely expired.
      setToken(null);
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    if (authed) void refresh();
  }, [authed, refresh]);

  async function capture() {
    if (!me?.spaces[0]) return;
    const block = await api.createBlock({ spaceId: me.spaces[0] });
    setInbox((prev) => [block, ...prev]);
    setSelected(block.id);
  }

  if (!authed) return <Auth onAuthed={() => setAuthed(true)} />;

  return (
    <div className="zettra-shell">
      <aside className="zettra-sidebar">
        <h2>Briefkasten</h2>
        <button onClick={capture}>+ Capture</button>
        <div style={{ marginTop: '1rem' }}>
          {inbox.map((b) => (
            <div
              key={b.id}
              className="zettra-inbox-item"
              onClick={() => setSelected(b.id)}
              style={{ cursor: 'pointer' }}
            >
              {b.id.slice(0, 8)} · {new Date(b.createdAt).toLocaleString()}
            </div>
          ))}
          {inbox.length === 0 && <p style={{ opacity: 0.6 }}>Inbox is empty.</p>}
        </div>
        <button
          style={{ marginTop: '1rem' }}
          onClick={() => {
            setToken(null);
            setAuthed(false);
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="zettra-main">
        {selected ? <Editor blockId={selected} /> : <p>Select or capture a block to edit.</p>}
      </main>
    </div>
  );
}
