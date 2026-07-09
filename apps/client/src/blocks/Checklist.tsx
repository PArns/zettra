import { useState } from 'react';
import { cx } from '../ui';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** Interactive task checklist with a live progress bar. */
export function Checklist({ initial }: { initial: ChecklistItem[] }) {
  const [items, setItems] = useState(initial);
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-faint">
          {done}/{items.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-hover">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() =>
                  setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)))
                }
                className="h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span className={cx('text-sm text-text', item.done && 'text-faint line-through')}>
                {item.text}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
