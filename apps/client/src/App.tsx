import { useCallback, useEffect, useState } from 'react';
import type { BlockDto } from '@zettra/shared';
import { api, getToken, setToken, type Space, type Tag, type View } from './lib/api';
import { IconButton } from './ui';
import { setMode } from './lib/theme';
import { setAccent } from './lib/accent';
import { useI18n } from './i18n';
import { Auth } from './components/Auth';
import { SettingsDialog } from './components/SettingsDialog';
import { SupertagDialog } from './components/SupertagDialog';
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
  const [displayName, setDisplayName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
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
  const [navOpen, setNavOpen] = useState(false);
  // null = closed; { tag: null } = create; { tag } = edit.
  const [tagEdit, setTagEdit] = useState<{ tag: Tag | null } | null>(null);
  const toast = useToast();
  const { t, setLang } = useI18n();

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
      if (meRes.email) setEmail(meRes.email);
      if (meRes.displayName) setDisplayName(meRes.displayName);
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
    // Apply the user's server-side theme + accent preferences after sign-in.
    if (!authed) return;
    api
      .getSettings()
      .then((s) => {
        if (s.themeMode) setMode(s.themeMode);
        if (s.accent) setAccent(s.accent);
        if (s.language) setLang(s.language);
      })
      .catch(() => undefined);
  }, [authed, setLang]);

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
      ? t('top.note')
      : nav.kind === 'inbox'
        ? t('nav.briefkasten')
        : nav.kind === 'review'
          ? t('nav.connections')
          : nav.kind === 'forReview'
            ? t('nav.forReview')
            : nav.name;

  return (
    <div className={`app${navOpen ? ' nav-open' : ''}`}>
      <div className="mobile-backdrop" onClick={() => setNavOpen(false)} />
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
          setNavOpen(false);
        }}
        onReparentTag={reparentTag}
        onCreateTag={() => setTagEdit({ tag: null })}
        onEditTag={(t) => setTagEdit({ tag: t })}
        onCapture={capture}
        email={email || 'you'}
        onSignOut={signOut}
      />

      <div className="main">
        <div className="topbar">
          <button
            className="icon mobile-toggle"
            title={t('top.openMenu')}
            aria-label={t('top.openMenu')}
            onClick={() => setNavOpen(true)}
          >
            ☰
          </button>
          {selected && (
            <button
              className="icon"
              title={t('top.back')}
              aria-label={t('top.back')}
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
            {capturing ? t('top.capturing') : `✎ ${t('top.capture')}`}
          </button>
          <NotificationsBell onOpenBlock={(id) => setSelected(id)} />
          <IconButton label={t('top.settings')} onClick={() => setShowSettings(true)}>
            ⚙
          </IconButton>
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

      {showSettings && (
        <SettingsDialog
          email={email}
          displayName={displayName}
          onClose={() => setShowSettings(false)}
          onProfileSaved={(p) => {
            setEmail(p.email);
            setDisplayName(p.displayName ?? '');
          }}
        />
      )}

      {tagEdit && (
        <SupertagDialog
          tag={tagEdit.tag}
          tags={tags}
          onClose={() => setTagEdit(null)}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}
