import type { Space, Tag, View } from '../lib/api';
import { clickable } from '../lib/a11y';
import { TagTree } from './TagTree';

export type Nav =
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
  onCapture: () => void;
  email: string;
  onSignOut: () => void;
}) {
  const { tags, views, nav } = props;
  const isActive = (n: Nav) =>
    (n.kind === nav.kind && n.kind !== 'view') ||
    (n.kind === 'view' && nav.kind === 'view' && n.id === nav.id);

  const activeViewId = nav.kind === 'view' ? nav.id : null;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logo">Z</span> Zettra
      </div>

      <div style={{ padding: '0 12px 8px' }}>
        <button className="primary" style={{ width: '100%' }} onClick={props.onCapture}>
          ✎ &nbsp;Quick capture
        </button>
      </div>

      <div className="sidebar-scroll">
        <div className="nav-section">
          <div
            className={`nav-item ${isActive({ kind: 'inbox' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'inbox' }))}
          >
            <span className="emoji">📥</span> Briefkasten
            {props.inboxCount > 0 && <span className="count">{props.inboxCount}</span>}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'forReview' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'forReview' }))}
          >
            <span className="emoji">🗂️</span> For Review
            {props.forReviewCount > 0 && <span className="count">{props.forReviewCount}</span>}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'review' }) ? 'active' : ''}`}
            {...clickable(() => props.onNav({ kind: 'review' }))}
          >
            <span className="emoji">✨</span> Connections
            {props.reviewCount > 0 && <span className="count">{props.reviewCount}</span>}
          </div>
        </div>

        <div className="nav-section">
          <div className="label">Tags</div>
          <TagTree
            tags={tags}
            views={views}
            activeViewId={activeViewId}
            onOpenView={(v) => props.onNav({ kind: 'view', id: v.id, name: v.name })}
            onReparent={props.onReparentTag}
          />
        </div>

        <div className="nav-section">
          <div className="label">Spaces</div>
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
        <button className="icon" title="Sign out" aria-label="Sign out" onClick={props.onSignOut}>
          ⏻
        </button>
      </div>
    </aside>
  );
}
