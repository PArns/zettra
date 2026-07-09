import { useEffect, useState } from 'react';
import type { BlockDto } from '@zettra/shared';
import { api, type AgendaItem, type ReminderView } from '../lib/api';
import { blockTitle } from '../lib/blocks';
import { relativeTime } from '../lib/time';
import { clickable } from '../lib/a11y';
import { useT } from '../i18n';
import { EmptyState } from '../ui';
import { recurrenceLabel } from './RemindersPanel';
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
 * upcoming), date-field items scheduled today (pulled from the calendar agenda), and the freshest
 * captures. A calm daily start gathered from all sources.
 */
export function TodayPane({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const toast = useToast();
  const today = todayIso();
  const [reminders, setReminders] = useState<ReminderView[]>([]);
  const [scheduled, setScheduled] = useState<AgendaItem[]>([]);
  // Everything created OR updated today (not just fresh untagged captures).
  const [todayBlocks, setTodayBlocks] = useState<BlockDto[]>([]);

  const load = () =>
    api
      .remindersUpcoming()
      .then(setReminders)
      .catch(() => undefined);

  useEffect(() => {
    void load();
    // Date-field items due today, from the permission-scoped calendar agenda.
    api
      .calendarAgenda(today, today)
      .then((a) => setScheduled(a.days[0]?.items.filter((i) => i.kind === 'field') ?? []))
      .catch(() => undefined);
    api
      .todayItems()
      .then(setTodayBlocks)
      .catch(() => undefined);
  }, [today]);

  async function resolve(id: string, kind: 'done' | 'dismiss') {
    try {
      await (kind === 'done' ? api.reminderDone(id) : api.reminderDismiss(id));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const overdue = reminders.filter((r) => dayOf(r.remindAt) < today);
  const dueToday = reminders.filter((r) => dayOf(r.remindAt) === today);
  const upcoming = reminders.filter((r) => dayOf(r.remindAt) > today);
  const empty = reminders.length === 0 && scheduled.length === 0 && todayBlocks.length === 0;

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
                {r.recurrence ? ` · ↻ ${recurrenceLabel(t, r.recurrence)}` : ''}
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

      {scheduled.length > 0 && (
        <div className="today-group">
          <div className="today-group-head due">{t('today.scheduled')}</div>
          {scheduled.map((it, i) => (
            <div
              key={`${it.blockId}:${i}`}
              className="card today-item"
              {...clickable(() => onOpen(it.blockId))}
            >
              <div style={{ flex: 1 }}>
                <div className="today-title">📌 {it.title}</div>
                {it.label && <div className="today-meta">{it.label}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {todayBlocks.length > 0 && (
        <div className="today-group">
          <div className="today-group-head">{t('nav.today')}</div>
          {todayBlocks.map((b) => {
            const created = dayOf(b.createdAt) === today;
            return (
              <div key={b.id} className="card today-item" {...clickable(() => onOpen(b.id))}>
                <div style={{ flex: 1 }}>
                  <div className="today-title">{blockTitle(b)}</div>
                  <div className="today-meta">
                    <span className="source-pill">{b.source}</span> ·{' '}
                    {created ? t('today.created') : t('today.updated')} ·{' '}
                    {relativeTime(created ? b.createdAt : (b.updatedAt ?? b.createdAt))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
