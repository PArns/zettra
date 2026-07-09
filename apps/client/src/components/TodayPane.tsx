import { useEffect, useState } from 'react';
import type { BlockDto } from '@zettra/shared';
import { api, type ReminderView } from '../lib/api';
import { blockTitle } from '../lib/blocks';
import { relativeTime } from '../lib/time';
import { clickable } from '../lib/a11y';
import { useT } from '../i18n';
import { EmptyState } from '../ui';
import { useToast } from './Toast';

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}
function todayIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}
function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(document.documentElement.lang || 'en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The Today briefing (§6): a single-column agenda unifying due reminders (overdue / today /
 * upcoming) and the freshest captures. A calm daily start; grows to add calendar + mail sources.
 */
export function TodayPane({
  captures,
  onOpen,
}: {
  captures: BlockDto[];
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const toast = useToast();
  const [reminders, setReminders] = useState<ReminderView[]>([]);

  const load = () =>
    api
      .remindersUpcoming()
      .then(setReminders)
      .catch(() => undefined);

  useEffect(() => {
    void load();
  }, []);

  async function resolve(id: string, kind: 'done' | 'dismiss') {
    try {
      await (kind === 'done' ? api.reminderDone(id) : api.reminderDismiss(id));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const today = todayIso();
  const overdue = reminders.filter((r) => dayOf(r.remindAt) < today);
  const dueToday = reminders.filter((r) => dayOf(r.remindAt) === today);
  const upcoming = reminders.filter((r) => dayOf(r.remindAt) > today);
  const empty = reminders.length === 0 && captures.length === 0;

  const reminderGroup = (title: string, list: ReminderView[], tone: string) =>
    list.length > 0 && (
      <div className="today-group">
        <div className={`today-group-head ${tone}`}>{title}</div>
        {list.map((r) => (
          <div key={r.id} className="card today-item">
            <div {...clickable(() => onOpen(r.blockId))} style={{ cursor: 'pointer', flex: 1 }}>
              <div className="today-title">🔔 {r.title}</div>
              <div className="today-meta">
                {fmt(r.remindAt)}
                {r.note ? ` · ${r.note}` : ''}
              </div>
            </div>
            <div className="reminder-actions">
              <button
                className="icon-sm"
                aria-label={t('reminder.done')}
                onClick={() => resolve(r.id, 'done')}
              >
                ✓
              </button>
              <button
                className="icon-sm"
                aria-label={t('reminder.dismiss')}
                onClick={() => resolve(r.id, 'dismiss')}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    );

  if (empty) {
    return <EmptyState glyph="☀️" title={t('today.emptyTitle')} hint={t('today.emptyHint')} />;
  }

  return (
    <div className="today">
      {reminderGroup(t('today.overdue'), overdue, 'overdue')}
      {reminderGroup(t('today.dueToday'), dueToday, 'due')}
      {reminderGroup(t('today.upcoming'), upcoming, 'upcoming')}

      {captures.length > 0 && (
        <div className="today-group">
          <div className="today-group-head">{t('today.captures')}</div>
          {captures.slice(0, 8).map((b) => (
            <div key={b.id} className="card today-item" {...clickable(() => onOpen(b.id))}>
              <div style={{ flex: 1 }}>
                <div className="today-title">{blockTitle(b)}</div>
                <div className="today-meta">
                  <span className="source-pill">{b.source}</span> · {relativeTime(b.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
