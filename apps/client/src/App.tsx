import { useCallback, useEffect, useState } from 'react';
import type { BlockDto } from '@zettra/shared';
import { api, getToken, setToken, type Space, type Tag, type View } from './lib/api';
import { ThemeSwitcher } from './ui';
import { Auth } from './components/Auth';
import { Sidebar, type Nav } from './components/Sidebar';
import { InboxPane } from './components/InboxPane';
import { DropZone } from './components/DropZone';
import { ForReviewPane } from './components/ForReviewPane';
import { ViewPane } from './components/ViewPane';
import { ReviewQueue } from './components/ReviewQueue';
import { RightRail } from './components/RightRail';
import { NotificationsBell } from './components/NotificationsBell';
import { ApplyTagMenu } from './components/ApplyTagMenu';
import { SearchBox } from './components/SearchBox';
import { useToast } from './components/Toast';
import { Editor } from './editor/Editor';

export function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [me, setMe] = useState<{ tenantId: string; spaces: string[] } | null>(null);
  const [email, setEmail] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [inbox, setInbox] = useState<BlockDto[]>([]);
  const [forReview, setForReview] = useState<BlockDto[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [nav, setNav] = useState<Nav>({ kind: 'inbox' });
  const [selected, setSelected] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [railRefresh, setRailRefresh] = useState(0);
  const toast = useToast();

  const refresh = useCallback(async () => {
    try {
      const [meRes, t, v, s, i, fr, r] = await Promise.all([
        api.me(),
        api.tags(),
        api.views(),
        api.spaces(),
        api.inbox(),
        api.forReview().catch(() => []),
        api.review().catch(() => []),
      ]);
      setMe(meRes);
      setTags(t);
      setViews(v);
      setSpaces(s);
      setInbox(i);
      setForReview(fr);
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
    if (capturing) return;
    const spaceId = spaces[0]?.id ?? me?.spaces[0];
    if (!spaceId) {
      toast.error('No space available to capture into.');
      return;
    }
    setCapturing(true);
    try {
      const block = await api.createBlock({ spaceId });
      setInbox((prev) => [block, ...prev]);
      setSelected(block.id);
    } catch (err) {
      toast.error(`Capture failed: ${(err as Error).message}`);
    } finally {
      setCapturing(false);
    }
  }

  function signOut() {
    setToken(null);
    setAuthed(false);
    setSelected(null);
  }

  if (!authed) return <Auth onAuthed={() => setAuthed(true)} />;

  async function reparentTag(tagId: string, parentId: string | null) {
    try {
      await api.setTagParent(tagId, parentId);
      setTags(await api.tags());
    } catch (err) {
      toast.error(`Could not move tag: ${(err as Error).message}`);
    }
  }

  const crumb =
    selected != null
      ? 'Note'
      : nav.kind === 'inbox'
        ? 'Briefkasten'
        : nav.kind === 'review'
          ? 'Connections'
          : nav.kind === 'forReview'
            ? 'For Review'
            : nav.name;

  return (
    <div className="app">
      <Sidebar
        tags={tags}
        views={views}
        spaces={spaces}
        inboxCount={inbox.length}
        reviewCount={reviewCount}
        forReviewCount={forReview.length}
        nav={nav}
        onNav={(n) => {
          setNav(n);
          setSelected(null);
        }}
        onReparentTag={reparentTag}
        onCapture={capture}
        email={email || 'you'}
        onSignOut={signOut}
      />

      <div className="main">
        <div className="topbar">
          {selected && (
            <button
              className="icon"
              title="Back"
              aria-label="Back"
              onClick={() => setSelected(null)}
            >
              ←
            </button>
          )}
          <div className="crumb">{crumb}</div>
          <div className="spacer" />
          <SearchBox onOpen={(id) => setSelected(id)} />
          {selected && (
            <ApplyTagMenu blockId={selected} onApplied={() => setRailRefresh((n) => n + 1)} />
          )}
          <button className="ghost" onClick={capture} disabled={capturing}>
            {capturing ? 'Capturing…' : '✎ Capture'}
          </button>
          <NotificationsBell onOpenBlock={(id) => setSelected(id)} />
          <ThemeSwitcher />
        </div>

        {selected ? (
          <div className="content">
            <div className="pane">
              <div className="pane-narrow">
                <Editor blockId={selected} userName={email || 'You'} />
              </div>
            </div>
            <RightRail
              key={`${selected}:${railRefresh}`}
              blockId={selected}
              onOpen={(id) => setSelected(id)}
            />
          </div>
        ) : (
          <div className="content no-rail">
            <div className="pane">
              <div className="pane-narrow">
                {nav.kind === 'inbox' && (
                  <>
                    <DropZone
                      spaceId={spaces[0]?.id ?? me?.spaces[0]}
                      onCaptured={(b) => {
                        setInbox((prev) => [b, ...prev]);
                        // The item may auto-tag out of the inbox; reconcile shortly after.
                        window.setTimeout(() => void refresh(), 1500);
                      }}
                    />
                    <InboxPane blocks={inbox} onOpen={(id) => setSelected(id)} />
                  </>
                )}
                {nav.kind === 'forReview' && (
                  <ForReviewPane
                    blocks={forReview}
                    onOpen={(id) => setSelected(id)}
                    onResolved={refresh}
                  />
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
