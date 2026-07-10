import { useCallback, useEffect, useState } from 'react';
import type { BlockDto } from '@zettra/shared';
import { api, getToken, setToken, type Space, type Tag, type View } from './lib/api';
import { clearSessions } from './lib/session';
import { IconButton } from './ui';
import { setMode } from './lib/theme';
import { setAccent } from './lib/accent';
import { useI18n } from './i18n';
import { Auth } from './components/Auth';
import { SettingsDialog } from './components/SettingsDialog';
import { AdminConsole } from './components/AdminConsole';
import { SupertagDialog } from './components/SupertagDialog';
import { Sidebar, type Nav } from './components/Sidebar';
import { InboxPane } from './components/InboxPane';
import { TodayPane } from './components/TodayPane';
import { CalendarPane } from './components/CalendarPane';
import { AiChatPanel } from './components/AiChatPanel';
import { WelcomePane } from './components/WelcomePane';
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
  // Adding another workspace: shows the auth screen again while keeping current sessions.
  const [addingWorkspace, setAddingWorkspace] = useState(false);
  // Live title of the open note (its first line), for the topbar crumb.
  const [noteTitle, setNoteTitle] = useState('');
  // Open notes as tabs (ids) + their last-known titles, so several notes stay open at once.
  const [tabs, setTabs] = useState<string[]>([]);
  const [tabTitles, setTabTitles] = useState<Record<string, string>>({});

  const openNote = useCallback((id: string) => {
    setSelected(id);
    setTabs((t) => (t.includes(id) ? t : [...t, id]));
  }, []);

  const closeTab = (id: string) => {
    setTabs((t) => {
      const next = t.filter((x) => x !== id);
      setSelected((cur) => (cur === id ? (next[next.length - 1] ?? null) : cur));
      return next;
    });
    setTabTitles((m) => {
      const rest = { ...m };
      delete rest[id];
      return rest;
    });
  };
  const [me, setMe] = useState<{
    tenantId: string;
    spaces: string[];
    userId?: string | null;
  } | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('member');
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showChat, setShowChat] = useState(false);
  // Question handed to the chat by the "Ask AI" search affordance (auto-asked on open).
  const [chatQuestion, setChatQuestion] = useState<string | undefined>(undefined);
  // When set, we're impersonating another user; holds the admin's own token to restore.
  const [impersonatorToken, setImpersonatorToken] = useState<string | null>(null);
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
      setRole(meRes.role ?? 'member');
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
      openNote(block.id);
    } catch (err) {
      toast.error(`Capture failed: ${(err as Error).message}`);
    } finally {
      setCapturing(false);
    }
  }

  function signOut() {
    clearSessions();
    setImpersonatorToken(null);
    setAuthed(false);
    setSelected(null);
  }

  function startImpersonation(token: string) {
    setImpersonatorToken(getToken());
    setToken(token);
    setShowAdmin(false);
    setSelected(null);
    setNav({ kind: 'inbox' });
    void refresh();
  }

  function exitImpersonation() {
    if (!impersonatorToken) return;
    setToken(impersonatorToken);
    setImpersonatorToken(null);
    setSelected(null);
    void refresh();
  }

  if (!authed) return <Auth onAuthed={() => setAuthed(true)} />;
  // Adding a workspace reuses the auth screen; on success reload so data re-inits under the new one.
  if (addingWorkspace) return <Auth onAuthed={() => window.location.reload()} />;

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
      ? noteTitle || t('top.note')
      : nav.kind === 'today'
        ? t('nav.today')
        : nav.kind === 'calendar'
          ? t('nav.calendar')
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
        onAddWorkspace={() => setAddingWorkspace(true)}
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
          <SearchBox
            onOpen={openNote}
            onAskAi={(question) => {
              setChatQuestion(question);
              setShowChat(true);
            }}
          />
          {selected && (
            <ApplyTagMenu blockId={selected} onApplied={() => setRailRefresh((n) => n + 1)} />
          )}
          <button className="ghost" onClick={capture} disabled={capturing}>
            {capturing ? t('top.capturing') : `✎ ${t('top.capture')}`}
          </button>
          <IconButton
            label={t('chat.title')}
            onClick={() => {
              setChatQuestion(undefined);
              setShowChat((v) => !v);
            }}
          >
            ✦
          </IconButton>
          <NotificationsBell onOpenBlock={openNote} />
          {role === 'admin' && !impersonatorToken && (
            <IconButton label={t('admin.open')} onClick={() => setShowAdmin(true)}>
              🛡️
            </IconButton>
          )}
          <IconButton label={t('top.settings')} onClick={() => setShowSettings(true)}>
            ⚙
          </IconButton>
        </div>

        {tabs.length > 0 && (
          <div className="tab-bar" role="tablist">
            {tabs.map((id) => (
              <div
                key={id}
                role="tab"
                aria-selected={id === selected}
                className={`tab ${id === selected ? 'active' : ''}`}
                onClick={() => setSelected(id)}
              >
                <span className="tab-title">{tabTitles[id] || t('top.note')}</span>
                <button
                  type="button"
                  className="tab-close"
                  aria-label={t('top.back')}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {selected ? (
          <div className="content">
            <div className="pane">
              <div className="pane-narrow">
                <Editor
                  blockId={selected}
                  userName={email || 'You'}
                  onTitle={(tt) => {
                    setNoteTitle(tt);
                    setTabTitles((m) => ({ ...m, [selected]: tt }));
                  }}
                />
              </div>
            </div>
            <RightRail
              key={`${selected}:${railRefresh}`}
              blockId={selected}
              onOpen={openNote}
            />
          </div>
        ) : (
          <div className="content no-rail">
            <div className="pane">
              <div className="pane-narrow">
                {nav.kind === 'today' && (
                  <TodayPane onOpen={openNote} />
                )}
                {nav.kind === 'calendar' && <CalendarPane onOpen={openNote} />}
                {nav.kind === 'inbox' && (
                  <>
                    {inbox.length === 0 && tags.length === 0 && (
                      <WelcomePane
                        onCapture={capture}
                        onCreateTag={() => setTagEdit({ tag: null })}
                      />
                    )}
                    <DropZone
                      spaceId={spaces[0]?.id ?? me?.spaces[0]}
                      onCaptured={(b) => {
                        setInbox((prev) => [b, ...prev]);
                        // The item may auto-tag out of the inbox; reconcile shortly after.
                        window.setTimeout(() => void refresh(), 1500);
                      }}
                    />
                    <InboxPane blocks={inbox} onOpen={openNote} />
                  </>
                )}
                {nav.kind === 'forReview' && (
                  <ForReviewPane
                    blocks={forReview}
                    onOpen={openNote}
                    onResolved={refresh}
                  />
                )}
                {nav.kind === 'review' && <ReviewQueue onChange={refresh} />}
                {nav.kind === 'view' && (
                  <ViewPane viewId={nav.id} onOpen={openNote} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showChat && (
        <AiChatPanel
          key={chatQuestion ?? '__manual__'}
          initialQuestion={chatQuestion}
          onClose={() => setShowChat(false)}
          onOpenBlock={(id) => {
            openNote(id);
            setShowChat(false);
          }}
        />
      )}

      {impersonatorToken && (
        <div className="impersonation-banner">
          <span>
            {t('admin.impersonating')} <strong>{displayName || email}</strong>
          </span>
          <button className="ghost" onClick={exitImpersonation}>
            {t('admin.exitImpersonation')}
          </button>
        </div>
      )}

      {showAdmin && (
        <AdminConsole
          currentUserId={me?.userId ?? null}
          onClose={() => setShowAdmin(false)}
          onImpersonate={startImpersonation}
        />
      )}

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
