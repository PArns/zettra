import { useState } from 'react';
import { Sidebar, type Nav } from './components/Sidebar';
import { SupertagDialog } from './components/SupertagDialog';
import { CalendarPane } from './components/CalendarPane';
import { Badge, IconButton } from './ui';
import type { Agenda, Space, Tag, View } from './lib/api';

/** A backend-free agenda anchored to the current month, for the `?shell=1&pane=calendar` preview. */
function mockAgenda(): Agenda {
  const now = new Date();
  const day = (n: number): string =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), n)).toISOString().slice(0, 10);
  return {
    days: [
      {
        iso: day(9),
        items: [
          {
            blockId: 'a',
            title: 'Rechnung fällig',
            date: day(9),
            kind: 'reminder',
            label: 'in 3 Tagen',
          },
        ],
      },
      {
        iso: day(14),
        items: [
          { blockId: 'b', title: 'Launch review', date: day(14), kind: 'field', label: 'Due date' },
          {
            blockId: 'c',
            title: 'Call with Alex',
            date: day(14),
            kind: 'reminder',
            label: 'Termin in 2 Wochen',
          },
        ],
      },
      {
        iso: day(22),
        items: [
          {
            blockId: 'd',
            title: 'Quarterly report',
            date: day(22),
            kind: 'field',
            label: 'Deadline',
          },
        ],
      },
    ],
    conflicts: [day(14)],
  };
}

/**
 * Static, backend-free preview of the Tana-style app shell (`?shell=1`) — the real Sidebar plus
 * a mocked page (breadcrumb, big title, tag pills, right-rail cards). Lets the layout be
 * reviewed and captured without a running server.
 */

const TAGS: Tag[] = [
  {
    id: 'day',
    name: 'Day',
    icon: '📅',
    color: null,
    parentId: null,
    extendsId: null,
    defaultViewId: 'v-day',
  },
  {
    id: 'proj',
    name: 'Projects',
    icon: '📁',
    color: null,
    parentId: null,
    extendsId: null,
    defaultViewId: null,
  },
  {
    id: 'proj-web',
    name: 'Website',
    icon: '🌐',
    color: null,
    parentId: 'proj',
    extendsId: null,
    defaultViewId: 'v-web',
  },
  {
    id: 'proj-app',
    name: 'Mobile app',
    icon: '📱',
    color: null,
    parentId: 'proj',
    extendsId: null,
    defaultViewId: null,
  },
  {
    id: 'task',
    name: 'Tasks',
    icon: '✅',
    color: null,
    parentId: null,
    extendsId: null,
    defaultViewId: 'v-task',
  },
  {
    id: 'people',
    name: 'People',
    icon: '👤',
    color: null,
    parentId: null,
    extendsId: null,
    defaultViewId: 'v-ppl',
  },
];
const VIEWS: View[] = [
  { id: 'v-day', name: 'Daily notes', tagId: 'day', layout: 'list', groupBy: null },
  { id: 'v-web', name: 'Website', tagId: 'proj-web', layout: 'board', groupBy: null },
  { id: 'v-task', name: 'Tasks', tagId: 'task', layout: 'table', groupBy: null },
  { id: 'v-ppl', name: 'People', tagId: 'people', layout: 'gallery', groupBy: null },
];
const SPACES: Space[] = [
  { id: 's1', name: 'Private', aiPolicy: 'local_only' },
  { id: 's2', name: 'Work', aiPolicy: 'default' },
];

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-strong rounded-xl border border-border p-3.5 shadow-sm">
      <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-faint">
        {title}
      </div>
      {children}
    </div>
  );
}

function Task({ text, tag }: { text: string; tag?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-hover">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
      <span className="text-sm text-text">
        {text} {tag && <span className="text-accent">#{tag}</span>}
      </span>
    </label>
  );
}

export function ShellPreview() {
  const params = new URLSearchParams(window.location.search);
  const previewCalendar = params.get('pane') === 'calendar';
  const [nav, setNav] = useState<Nav>(
    previewCalendar ? { kind: 'calendar' } : { kind: 'view', id: 'v-day', name: 'Daily notes' },
  );
  const [navOpen, setNavOpen] = useState(false);
  const [tagEdit, setTagEdit] = useState<{ tag: Tag | null } | null>(
    params.get('dialog') === 'supertag' ? { tag: null } : null,
  );

  return (
    <div className={`app${navOpen ? ' nav-open' : ''}`}>
      <div className="mobile-backdrop" onClick={() => setNavOpen(false)} />
      <Sidebar
        tags={TAGS}
        views={VIEWS}
        spaces={SPACES}
        inboxCount={3}
        reviewCount={2}
        forReviewCount={4}
        nav={nav}
        onNav={setNav}
        onReparentTag={() => undefined}
        onCreateTag={() => setTagEdit({ tag: null })}
        onEditTag={(t) => setTagEdit({ tag: t })}
        onCapture={() => undefined}
        email="patrick@zettra.app"
        onSignOut={() => undefined}
      />

      <div className="main">
        <div className="topbar">
          <button
            className="icon mobile-toggle"
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
          >
            ☰
          </button>
          <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
            <span className="grid h-5 w-5 place-items-center rounded bg-surface-2 text-[11px]">
              📓
            </span>
            <span className="truncate">Daily notes</span>
            <span className="text-faint">/</span>
            <span>2026</span>
            <span className="text-faint">/</span>
            <span className="text-text">Week 28</span>
          </nav>
          <div className="spacer" />
          <IconButton label="Ask AI">✦</IconButton>
          <IconButton label="More">⋯</IconButton>
        </div>

        {previewCalendar ? (
          <div className="content no-rail">
            <div className="pane">
              <div className="pane-narrow animate-fade-up">
                <CalendarPane onOpen={() => undefined} previewAgenda={mockAgenda()} />
              </div>
            </div>
          </div>
        ) : (
          <div className="content">
            <div className="pane">
              <div className="pane-narrow animate-fade-up">
                <h1 className="text-3xl font-bold tracking-tight text-text">Today, Wed, Jul 8</h1>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone="accent">
                    <span className="opacity-70">#</span>&nbsp;Day
                  </Badge>
                  <span className="text-xs text-faint">Week 28 · 2026</span>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <button className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-sm text-muted hover:bg-hover">
                    ‹
                  </button>
                  <button className="rounded-lg border border-border bg-surface-2 px-3 py-1 text-sm font-medium text-text hover:bg-hover">
                    Today
                  </button>
                  <button className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-sm text-muted hover:bg-hover">
                    ›
                  </button>
                </div>

                <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-text">
                  <p className="text-muted">
                    Type <span className="font-mono text-accent">/</span> for blocks,{' '}
                    <span className="font-mono text-accent">#</span> to tag,{' '}
                    <span className="font-mono text-accent">[[</span> to link.
                  </p>
                  <div className="zx-callout" style={{ ['--ck' as string]: 'var(--accent)' }}>
                    <span className="zx-callout-glyph">💡</span>
                    <div className="zx-callout-body text-sm text-muted">
                      Standup at 10:00 — review the launch checklist with{' '}
                      <span className="text-accent">[[Alex]]</span>.
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {[
                      'Draft the release notes',
                      'Merge the theme switcher',
                      'Reply to design review',
                    ].map((t, i) => (
                      <li key={t} className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          defaultChecked={i === 1}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <span className={i === 1 ? 'text-faint line-through' : ''}>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <aside className="rail space-y-3">
              <RailCard title="Open tasks">
                <div className="flex flex-col">
                  <Task text="Rename attractions modal" tag="Website" />
                  <Task text="Ship formula cross-refs" tag="Tasks" />
                  <Task text="Invite the team" tag="People" />
                </div>
              </RailCard>
              <RailCard title="Related">
                <div className="space-y-2">
                  {[
                    { t: 'Launch plan', s: 'strong match' },
                    { t: 'Q3 roadmap', s: 'likely match' },
                  ].map((r) => (
                    <div
                      key={r.t}
                      className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2"
                    >
                      <span className="text-sm text-text">{r.t}</span>
                      <span className="text-xs text-faint">{r.s}</span>
                    </div>
                  ))}
                </div>
              </RailCard>
            </aside>
          </div>
        )}
      </div>

      {tagEdit && (
        <SupertagDialog
          tag={tagEdit.tag}
          tags={TAGS}
          onClose={() => setTagEdit(null)}
          onSaved={() => setTagEdit(null)}
        />
      )}
    </div>
  );
}
