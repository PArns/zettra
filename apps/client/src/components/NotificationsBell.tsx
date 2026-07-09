import { useEffect, useRef, useState } from 'react';
import { api, type Notification } from '../lib/api';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import { absoluteTime, relativeTime } from '../lib/time';
import { clickable } from '../lib/a11y';

function describe(n: Notification, t: (key: StringKey) => string): string {
  const who = n.actorName ?? t('notif.someone');
  switch (n.kind) {
    case 'mention':
      return `${who} ${t('notif.mentioned')}`;
    case 'task_assignment':
      return `${who} ${t('notif.assigned')}`;
    case 'review_request':
      return t('notif.reviewWaiting');
  }
}

/** Topbar notification bell with unread count + dropdown (§15.6). Polls periodically. */
export function NotificationsBell({ onOpenBlock }: { onOpenBlock: (id: string) => void }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  const load = () =>
    api
      .notifications()
      .then(setItems)
      .catch(() => undefined);
  useEffect(() => {
    void load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
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
      <button
        className="icon"
        title={t('notif.title')}
        aria-label={`${t('notif.title')}${unread > 0 ? `, ${unread} ${t('notif.unread')}` : ''}`}
        aria-expanded={open}
        onClick={toggle}
      >
        🔔{unread > 0 && <span className="badge-count">{unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="head">
            {t('notif.title')}
            <span style={{ color: 'var(--text-faint)', fontWeight: 400, fontSize: 12 }}>
              {items.length}
            </span>
          </div>
          {items.length === 0 && (
            <div className="n-item" style={{ color: 'var(--text-faint)' }}>
              {t('notif.caughtUp')}
            </div>
          )}
          {items.slice(0, 20).map((n) => {
            const openable = Boolean(n.sourceBlockId);
            return (
              <div
                key={n.id}
                className={`n-item ${n.read ? '' : 'unread'}`}
                style={openable ? undefined : { cursor: 'default' }}
                {...(openable ? clickable(() => onOpenBlock(n.sourceBlockId as string)) : {})}
              >
                {describe(n, t)}
                <div
                  style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 2 }}
                  title={absoluteTime(n.createdAt)}
                >
                  {relativeTime(n.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
