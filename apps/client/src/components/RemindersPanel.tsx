import { useEffect, useRef, useState } from 'react';
import { api, type ReminderView } from '../lib/api';
import { useT } from '../i18n';
import { DatePicker } from './DatePicker';
import { useToast } from './Toast';

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(document.documentElement.lang || 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Reminders / Wiedervorlage for the open block (§4): list, add (date + note), done/dismiss. */
export function RemindersPanel({ blockId }: { blockId: string }) {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<ReminderView[]>([]);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');
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
      await api.createReminder({ blockId, remindAt: iso, note: note.trim() || undefined });
      setAdding(false);
      setNote('');
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
          {r.note && <span className="reminder-note">{r.note}</span>}
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
            <DatePicker value="" onChange={add} />
          </div>
        )}
      </div>
    </div>
  );
}
