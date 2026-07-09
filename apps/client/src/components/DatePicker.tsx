import { useState } from 'react';
import { addMonths, monthGrid } from '@zettra/shared';
import { useT } from '../i18n';

const DAY_MS = 86_400_000;
const MONDAY = Date.UTC(2024, 0, 1); // a known Monday, for weekday labels

function locale(): string {
  return (typeof document !== 'undefined' && document.documentElement.lang) || 'en';
}
function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString(locale(), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
function weekdays(): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(MONDAY + i * DAY_MS).toLocaleDateString(locale(), {
      weekday: 'short',
      timeZone: 'UTC',
    }),
  );
}
function todayIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

/** A reusable month-grid date picker. Value + onChange are ISO date strings (`YYYY-MM-DD`). */
export function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const t = useT();
  const today = todayIso();
  const start = value || today;
  const [view, setView] = useState({
    year: Number(start.slice(0, 4)),
    month: Number(start.slice(5, 7)) - 1,
  });
  const grid = monthGrid(view.year, view.month);

  return (
    <div className="datepicker">
      <div className="dp-head">
        <button
          className="icon-sm"
          aria-label={t('date.prevMonth')}
          onClick={() => setView(addMonths(view.year, view.month, -1))}
        >
          ‹
        </button>
        <span className="dp-title">{monthLabel(view.year, view.month)}</span>
        <button
          className="icon-sm"
          aria-label={t('date.nextMonth')}
          onClick={() => setView(addMonths(view.year, view.month, 1))}
        >
          ›
        </button>
      </div>
      <div className="dp-grid">
        {weekdays().map((w, i) => (
          <div key={i} className="dp-wd">
            {w}
          </div>
        ))}
        {grid.flat().map((c) => (
          <button
            key={c.iso}
            type="button"
            className={
              'dp-day' +
              (c.inMonth ? '' : ' out') +
              (c.iso === value ? ' sel' : '') +
              (c.iso === today ? ' today' : '')
            }
            onClick={() => onChange(c.iso)}
          >
            {c.day}
          </button>
        ))}
      </div>
      <div className="dp-foot">
        <button className="ghost" onClick={() => onChange(today)}>
          {t('date.today')}
        </button>
        {value && (
          <button className="ghost" onClick={() => onChange('')}>
            {t('date.clear')}
          </button>
        )}
      </div>
    </div>
  );
}
