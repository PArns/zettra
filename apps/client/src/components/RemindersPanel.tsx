import { useEffect, useRef, useState } from 'react';
import { RECURRENCE_RULES } from '@zettra/shared';
import { api, type ReminderView } from '../lib/api';
import { useT, type TFn } from '../i18n';
import { IconCheck, IconX } from '../ui';
import { DatePicker } from './DatePicker';
import { useToast } from './Toast';

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(document.documentElement.lang || 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Localized label for a recurrence rule (`daily` → "reminder.recur.daily`), or empty for one-off. */
export function recurrenceLabel(t: TFn, recurrence: string | null): string {
  if (!recurrence) return '';
  const key = `reminder.recur.${recurrence}` as Parameters<TFn>[0];
  return t(key);
}

/** Reminders / Wiedervorlage for the open block (§4): list, add (date + note), done/dismiss. */
export function RemindersPanel({ blockId }: { blockId: string }) {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<ReminderView[]>([]);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const load = () =>
    api
      .blockReminders(blockId)
      .then((r) => setItems(r.filter((x) => x.status === 'pending')))
      .catch(() => undefined);

  useEffect(() => {
    void load();
    setAdding(false);
    setNote('');
    setRecurrence('');
  }, [blockId]);

  useEffect(() => {
    if (!adding) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAdding(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [adding]);

  async function add(iso: string) {
    if (!iso) return;
    try {
      await api.createReminder({
        blockId,
        remindAt: iso,
        note: note.trim() || undefined,
        recurrence: recurrence || undefined,
      });
      setAdding(false);
      setNote('');
      setRecurrence('');
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function resolve(id: string, kind: 'done' | 'dismiss') {
    try {
      await (kind === 'done' ? api.reminderDone(id) : api.reminderDismiss(id));
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="reminders">
      <h3>{t('reminder.title')}</h3>
      {items.map((r) => (
        <div key={r.id} className="reminder-row">
          <span className="reminder-when">🔔 {fmt(r.remindAt)}</span>
          {r.recurrence && (
            <span className="reminder-recur" title={recurrenceLabel(t, r.recurrence)}>
              ↻ {recurrenceLabel(t, r.recurrence)}
            </span>
          )}
          {r.note && <span className="reminder-note">{r.note}</span>}
          <div className="reminder-actions">
            <button
              className="icon-sm"
              aria-label={t('reminder.done')}
              onClick={() => resolve(r.id, 'done')}
            >
              <IconCheck />
            </button>
            <button
              className="icon-sm"
              aria-label={t('reminder.dismiss')}
              onClick={() => resolve(r.id, 'dismiss')}
            >
              <IconX />
            </button>
          </div>
        </div>
      ))}
      <div className="menu reminder-add" ref={ref}>
        <button className="ghost" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
          🔔 {t('reminder.add')}
        </button>
        {adding && (
          <div className="menu-list dp-pop">
            <input
              className="reminder-note-input"
              value={note}
              placeholder={t('reminder.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="reminder-recur-row">
              <span className="reminder-recur-label">↻ {t('reminder.repeat')}</span>
              <select
                className="reminder-recur-select"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
              >
                <option value="">{t('reminder.recur.none')}</option>
                {RECURRENCE_RULES.map((rule) => (
                  <option key={rule} value={rule}>
                    {t(`reminder.recur.${rule}`)}
                  </option>
                ))}
              </select>
            </div>
            <DatePicker value="" onChange={add} />
          </div>
        )}
      </div>
    </div>
  );
}
