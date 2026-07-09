import type { Space, Tag, View } from '../lib/api';
import { clickable } from '../lib/a11y';
import { useT } from '../i18n';
import { TagTree } from './TagTree';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

export type Nav =
  | { kind: 'today' }
  | { kind: 'calendar' }
  | { kind: 'inbox' }
  | { kind: 'review' }
  | { kind: 'forReview' }
  | { kind: 'view'; id: string; name: string };

export function Sidebar(props: {
  tags: Tag[];
  views: View[];
  spaces: Space[];
  inboxCount: number;
  reviewCount: number;
  forReviewCount: number;
  nav: Nav;
  onNav: (n: Nav) => void;
  onReparentTag: (tagId: string, parentId: string | null) => void;
  onCreateTag: () => void;
  onEditTag: (tag: Tag) => void;
  onCapture: () => void;
  email: string;
  onSignOut: () => void;
  onAddWorkspace: () => void;
}) {
  const { tags, views, nav } = props;
  const t = useT();
  const isActive = (n: Nav) =>
    (n.kind === nav.kind && n.kind !== 'view') ||
    (n.kind === 'view' && nav.kind === 'view' && n.id === nav.id);

  const activeViewId = nav.kind === 'view' ? nav.id : null;

  return (
    <aside className="sidebar">
      <WorkspaceSwitcher onAddWorkspace={props.onAddWorkspace} />

      <div className="side-actions">
        <button className="primary side-new" onClick={props.onCapture}>
          <span>✎</span> {t('nav.createNew')}
        </button>
        <button className="side-search" aria-label={t('nav.search')} title={t('nav.search')}>
          🔍
        </button>
      </div>

      <div className="sidebar-scroll">
        <div className="nav-section">
          <div
            className={`nav-item ${isActive({ kind: 'today' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'today' }))}
          >
            <span className="emoji">☀️</span> {t('nav.today')}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'calendar' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'calendar' }))}
          >
            <span className="emoji">🗓️</span> {t('nav.calendar')}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'inbox' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'inbox' }))}
          >
            <span className="emoji">📥</span> {t('nav.briefkasten')}
            {props.inboxCount > 0 && <span className="count">{props.inboxCount}</span>}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'forReview' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'forReview' }))}
          >
            <span className="emoji">🗂️</span> {t('nav.forReview')}
            {props.forReviewCount > 0 && <span className="count">{props.forReviewCount}</span>}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'review' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'review' }))}
          >
            <span className="emoji">✨</span> {t('nav.connections')}
            {props.reviewCount > 0 && <span className="count">{props.reviewCount}</span>}
          </div>
        </div>

        <div className="nav-section">
          <div className="label">
            <span>{t('nav.tags')}</span>
            <button
              className="label-add"
              aria-label={t('nav.newSupertag')}
              title={t('nav.newSupertag')}
              onClick={props.onCreateTag}
            >
              +
            </button>
          </div>
          <TagTree
            tags={tags}
            views={views}
            activeViewId={activeViewId}
            onOpenView={(v) => props.onNav({ kind: 'view', id: v.id, name: v.name })}
            onReparent={props.onReparentTag}
            onEdit={props.onEditTag}
          />
        </div>

        <div className="nav-section">
          <div className="label">{t('nav.spaces')}</div>
          {props.spaces.map((s) => (
            <div key={s.id} className="nav-item static" title={s.name}>
              <span className="emoji">{s.aiPolicy === 'local_only' ? '🔒' : '#'}</span> {s.name}
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <span className="avatar">{props.email.slice(0, 2).toUpperCase()}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {props.email}
          </div>
        </div>
        <button
          className="icon"
          title={t('nav.signOut')}
          aria-label={t('nav.signOut')}
          onClick={props.onSignOut}
        >
          ⏻
        </button>
      </div>
    </aside>
  );
}
