import { useCallback, useEffect, useState } from 'react';
import type { BlockDto } from '@zettra/shared';
import { api, getToken, setToken, type Space, type Tag, type View } from './lib/api';
import { currentTheme, toggleTheme } from './lib/theme';
import { Auth } from './components/Auth';
import { Sidebar, type Nav } from './components/Sidebar';
import { InboxPane } from './components/InboxPane';
import { ViewPane } from './components/ViewPane';
import { ReviewQueue } from './components/ReviewQueue';
import { RightRail } from './components/RightRail';
import { NotificationsBell } from './components/NotificationsBell';
import { ApplyTagMenu } from './components/ApplyTagMenu';
import { Editor } from './editor/Editor';

export function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [me, setMe] = useState<{ tenantId: string; spaces: string[] } | null>(null);
  const [email, setEmail] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [inbox, setInbox] = useState<BlockDto[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [nav, setNav] = useState<Nav>({ kind: 'inbox' });
  const [selected, setSelected] = useState<string | null>(null);
  const [theme, setTheme] = useState(currentTheme());

  const refresh = useCallback(async () => {
    try {
      const [meRes, t, v, s, i, r] = await Promise.all([
        api.me(),
        api.tags(),
        api.views(),
        api.spaces(),
        api.inbox(),
        api.review().catch(() => []),
      ]);
      setMe(meRes);
      setTags(t);
      setViews(v);
      setSpaces(s);
      setInbox(i);
      setReviewCount(r.length);
    } catch {
      setToken(null);
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    if (authed) void refresh();
  }, [authed, refresh]);

  useEffect(() => {
    // Best-effort read of the signed-in email from the token payload for the avatar.
    const token = getToken();
    if (token) {
      try {
        const claims = JSON.parse(atob(token.split('.')[1] ?? ''));
        if (claims.email) setEmail(String(claims.email));
      } catch {
        /* ignore */
      }
    }
  }, [authed]);

  async function capture() {
    const spaceId = spaces[0]?.id ?? me?.spaces[0];
    if (!spaceId) return;
    const block = await api.createBlock({ spaceId });
    setInbox((prev) => [block, ...prev]);
    setSelected(block.id);
  }

  function signOut() {
    setToken(null);
    setAuthed(false);
    setSelected(null);
  }

  if (!authed) return <Auth onAuthed={() => setAuthed(true)} />;

  const crumb =
    selected != null
      ? 'Note'
      : nav.kind === 'inbox'
        ? 'Briefkasten'
        : nav.kind === 'review'
          ? 'Review queue'
          : nav.name;

  return (
    <div className="app">
      <Sidebar
        tags={tags}
        views={views}
        spaces={spaces}
        inboxCount={inbox.length}
        reviewCount={reviewCount}
        nav={nav}
        onNav={(n) => {
          setNav(n);
          setSelected(null);
        }}
        onCapture={capture}
        email={email || 'you'}
        onSignOut={signOut}
      />

      <div className="main">
        <div className="topbar">
          {selected && (
            <button className="icon" title="Back" onClick={() => setSelected(null)}>
              ←
            </button>
          )}
          <div className="crumb">{crumb}</div>
          <div className="spacer" />
          {selected && <ApplyTagMenu blockId={selected} />}
          <button className="ghost" onClick={capture}>
            ✎ Capture
          </button>
          <NotificationsBell onOpenBlock={(id) => setSelected(id)} />
          <button className="icon" title="Toggle theme" onClick={() => setTheme(toggleTheme())}>
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </div>

        {selected ? (
          <div className="content">
            <div className="pane">
              <div className="pane-narrow">
                <Editor blockId={selected} />
              </div>
            </div>
            <RightRail blockId={selected} onOpen={(id) => setSelected(id)} />
          </div>
        ) : (
          <div className="content no-rail">
            <div className="pane">
              <div className="pane-narrow">
                {nav.kind === 'inbox' && (
                  <InboxPane blocks={inbox} onOpen={(id) => setSelected(id)} />
                )}
                {nav.kind === 'review' && <ReviewQueue onChange={refresh} />}
                {nav.kind === 'view' && (
                  <ViewPane viewId={nav.id} onOpen={(id) => setSelected(id)} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
