import { useEffect, useRef, useState } from 'react';
import { api, type Notification } from '../lib/api';

const LABEL: Record<Notification['kind'], string> = {
  mention: 'mentioned you',
  task_assignment: 'assigned you a task',
  review_request: 'suggested a connection to review',
};

/** Topbar notification bell with unread count + dropdown (§15.6). Polls periodically. */
export function NotificationsBell({ onOpenBlock }: { onOpenBlock: (id: string) => void }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = () =>
    api
      .notifications()
      .then(setItems)
      .catch(() => undefined);
  useEffect(() => {
    void load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = items.filter((i) => !i.read).length;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await api.markNotificationsRead().catch(() => undefined);
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    }
  }

  return (
    <div className="bell menu" ref={ref}>
      <button className="icon" title="Notifications" onClick={toggle}>
        🔔{unread > 0 && <span className="badge-count">{unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="head">
            Notifications
            <span style={{ color: 'var(--text-faint)', fontWeight: 400, fontSize: 12 }}>
              {items.length}
            </span>
          </div>
          {items.length === 0 && (
            <div className="n-item" style={{ color: 'var(--text-faint)' }}>
              You're all caught up.
            </div>
          )}
          {items.slice(0, 20).map((n) => (
            <div
              key={n.id}
              className={`n-item ${n.read ? '' : 'unread'}`}
              onClick={() => n.sourceBlockId && onOpenBlock(n.sourceBlockId)}
            >
              Someone {LABEL[n.kind]}
              <div style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 2 }}>
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
