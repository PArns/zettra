import { useEffect, useState } from 'react';
import { api, type TodoItem } from '../lib/api';
import { clickable } from '../lib/a11y';
import { useT, type StringKey } from '../i18n';
import { EmptyState, IconCheck, IconPlus } from '../ui';
import { useToast } from './Toast';

function todayIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}
function plusDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(document.documentElement.lang || 'en', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'done';
const ORDER: Bucket[] = ['overdue', 'today', 'week', 'later', 'done'];
const HEAD: Record<Bucket, StringKey> = {
  overdue: 'todo.overdue',
  today: 'todo.today',
  week: 'todo.week',
  later: 'todo.later',
  done: 'todo.done',
};

function bucketOf(item: TodoItem, today: string, weekEnd: string): Bucket {
  if (item.done) return 'done';
  if (!item.due) return 'later';
  if (item.due < today) return 'overdue';
  if (item.due === today) return 'today';
  if (item.due <= weekEnd) return 'week';
  return 'later';
}

/**
 * The global to-do list (§4): every #todo note grouped by when it's due — Overdue / Today / This
 * week / Later / Done. A checkbox flips the note's status; due date and follow-up (Wiedervorlage)
 * show as badges. Clicking a row opens the note.
 */
export function TodoPane({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<TodoItem[] | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () =>
    api
      .todos()
      .then(setItems)
      .catch(() => setItems([]));

  useEffect(() => {
    void load();
  }, []);

  const addTodo = async () => {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const created = await api.createTodo(title);
      setDraft('');
      setItems((prev) => (prev ? [created, ...prev] : [created]));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdding(false);
      void load();
    }
  };

  const toggle = async (item: TodoItem) => {
    const next = item.done ? 'open' : 'done';
    setItems((prev) =>
      prev
        ? prev.map((x) =>
            x.blockId === item.blockId ? { ...x, done: !x.done, status: next } : x,
          )
        : prev,
    );
    try {
      await api.setTodoStatus(item.blockId, next);
    } finally {
      void load();
    }
  };

  if (items === null) return <div className="empty">…</div>;

  const today = todayIso();
  const weekEnd = plusDaysIso(today, 7);
  const groups = new Map<Bucket, TodoItem[]>();
  for (const it of items) {
    const b = bucketOf(it, today, weekEnd);
    groups.set(b, [...(groups.get(b) ?? []), it]);
  }

  return (
    <div className="todo-list">
      <div className="todo-quickadd">
        <span className="todo-quickadd-ico" aria-hidden>
          <IconPlus size={16} />
        </span>
        <input
          className="todo-quickadd-input"
          value={draft}
          placeholder={t('todo.quickAdd')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addTodo();
          }}
        />
        {draft.trim() && (
          <button
            className="todo-quickadd-btn"
            onClick={() => void addTodo()}
            disabled={adding}
          >
            {adding ? '…' : t('common.add')}
          </button>
        )}
      </div>

      {items.length === 0 && <EmptyState glyph="☑️" title={t('todo.empty')} />}

      {ORDER.filter((b) => groups.get(b)?.length).map((b) => (
        <div key={b} className="todo-group">
          <div className={`todo-group-head ${b}`}>{t(HEAD[b])}</div>
          {groups.get(b)!.map((item) => (
            <div key={item.blockId} className={`card todo-item ${item.done ? 'is-done' : ''}`}>
              <button
                className={`todo-check ${item.done ? 'on' : ''}`}
                aria-label={item.done ? t('common.done') : t('todo.done')}
                onClick={() => void toggle(item)}
              >
                {item.done && <IconCheck size={13} />}
              </button>
              <div className="todo-main" {...clickable(() => onOpen(item.blockId))}>
                <div className="todo-title">{item.title}</div>
                <div className="todo-meta">
                  {item.due && (
                    <span className={`todo-due ${!item.done && item.due < today ? 'overdue' : ''}`}>
                      📅 {fmtDate(item.due)}
                    </span>
                  )}
                  {item.followUp && (
                    <span className="todo-followup">
                      ↻ {t('todo.followUp')}: {fmtDate(item.followUp)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
