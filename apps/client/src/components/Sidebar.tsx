import type { Space, Tag, View } from '../lib/api';

export type Nav =
  { kind: 'inbox' } | { kind: 'review' } | { kind: 'view'; id: string; name: string };

export function Sidebar(props: {
  tags: Tag[];
  views: View[];
  spaces: Space[];
  inboxCount: number;
  reviewCount: number;
  nav: Nav;
  onNav: (n: Nav) => void;
  onCapture: () => void;
  email: string;
  onSignOut: () => void;
}) {
  const { tags, views, nav } = props;
  const isActive = (n: Nav) =>
    (n.kind === nav.kind && n.kind !== 'view') ||
    (n.kind === 'view' && nav.kind === 'view' && n.id === nav.id);

  const tagFor = (v: View) => tags.find((t) => t.id === v.tagId);

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
            onClick={() => props.onNav({ kind: 'inbox' })}
          >
            <span className="emoji">📥</span> Briefkasten
            {props.inboxCount > 0 && <span className="count">{props.inboxCount}</span>}
          </div>
          <div
            className={`nav-item ${isActive({ kind: 'review' }) ? 'active' : ''}`}
            onClick={() => props.onNav({ kind: 'review' })}
          >
            <span className="emoji">✨</span> Review queue
            {props.reviewCount > 0 && <span className="count">{props.reviewCount}</span>}
          </div>
        </div>

        <div className="nav-section">
          <div className="label">Supertags</div>
          {views
            .filter((v) => v.tagId)
            .map((v) => {
              const tag = tagFor(v);
              return (
                <div
                  key={v.id}
                  className={`nav-item ${isActive({ kind: 'view', id: v.id, name: v.name }) ? 'active' : ''}`}
                  onClick={() => props.onNav({ kind: 'view', id: v.id, name: v.name })}
                >
                  <span className="emoji">{tag?.icon ?? '#'}</span> {v.name}
                </div>
              );
            })}
          {views.filter((v) => v.tagId).length === 0 && (
            <div className="nav-item" style={{ opacity: 0.6 }}>
              No views yet
            </div>
          )}
        </div>

        <div className="nav-section">
          <div className="label">Spaces</div>
          {props.spaces.map((s) => (
            <div key={s.id} className="nav-item">
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
        <button className="icon" title="Sign out" onClick={props.onSignOut}>
          ⏻
        </button>
      </div>
    </aside>
  );
}
