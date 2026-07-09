import { useEffect, useMemo, useState } from 'react';
import { addMonths, monthGrid } from '@zettra/shared';
import { api, type Agenda, type AgendaItem } from '../lib/api';
import { clickable } from '../lib/a11y';
import { useT } from '../i18n';
import { EmptyState } from '../ui';

const DAY_MS = 86_400_000;
const MONDAY = Date.UTC(2024, 0, 1);

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
function longDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale(), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * The calendar surface (§3): a month grid over the permission-scoped agenda (reminders + date
 * fields), with per-day markers, conflict highlighting (days already carrying appointments), and a
 * day detail list. Selecting a day shows everything scheduled on it; clicking an item opens its
 * block. The month range is fetched from the server so nothing is materialized client-side.
 *
 * `previewAgenda` seeds the agenda without a backend (for `?shell=` previews and tests); when it
 * is supplied the live fetch is skipped.
 */
export function CalendarPane({
  onOpen,
  previewAgenda,
}: {
  onOpen: (id: string) => void;
  previewAgenda?: Agenda;
}) {
  const t = useT();
  const today = todayIso();
  const [view, setView] = useState({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  });
  const [selected, setSelected] = useState<string>(today);
  const [agenda, setAgenda] = useState<Agenda>(previewAgenda ?? { days: [], conflicts: [] });

  const grid = monthGrid(view.year, view.month);
  const range = useMemo(() => ({ from: grid[0][0].iso, to: grid[5][6].iso }), [grid]);

  useEffect(() => {
    if (previewAgenda) return;
    let live = true;
    api
      .calendarAgenda(range.from, range.to)
      .then((a) => live && setAgenda(a))
      .catch(() => live && setAgenda({ days: [], conflicts: [] }));
    return () => {
      live = false;
    };
  }, [range.from, range.to, previewAgenda]);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const d of agenda.days) map.set(d.iso, d.items);
    return map;
  }, [agenda]);
  const conflicts = useMemo(() => new Set(agenda.conflicts), [agenda]);

  const dayItems = byDay.get(selected) ?? [];

  return (
    <div className="calendar">
      <div className="cal-head">
        <button
          className="icon-sm"
          aria-label={t('date.prevMonth')}
          onClick={() => setView(addMonths(view.year, view.month, -1))}
        >
          ‹
        </button>
        <span className="cal-title">{monthLabel(view.year, view.month)}</span>
        <button
          className="icon-sm"
          aria-label={t('date.nextMonth')}
          onClick={() => setView(addMonths(view.year, view.month, 1))}
        >
          ›
        </button>
        <div className="spacer" />
        <button
          className="ghost"
          onClick={() => {
            setView({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) - 1 });
            setSelected(today);
          }}
        >
          {t('date.today')}
        </button>
      </div>

      <div className="cal-grid">
        {weekdays().map((w, i) => (
          <div key={i} className="cal-wd">
            {w}
          </div>
        ))}
        {grid.flat().map((c) => {
          const items = byDay.get(c.iso) ?? [];
          return (
            <button
              key={c.iso}
              type="button"
              className={
                'cal-day' +
                (c.inMonth ? '' : ' out') +
                (c.iso === selected ? ' sel' : '') +
                (c.iso === today ? ' today' : '') +
                (conflicts.has(c.iso) ? ' conflict' : '')
              }
              onClick={() => setSelected(c.iso)}
              aria-label={`${c.iso}${items.length ? ` · ${items.length}` : ''}`}
            >
              <span className="cal-daynum">{c.day}</span>
              {items.length > 0 && (
                <span className="cal-dots">
                  {items.slice(0, 3).map((it, i) => (
                    <span key={i} className={`cal-dot ${it.kind}`} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="cal-day-detail">
        <div className="cal-day-title">
          {longDay(selected)}
          {conflicts.has(selected) && (
            <span className="cal-conflict-tag">{t('calendar.busy')}</span>
          )}
        </div>
        {dayItems.length === 0 ? (
          <EmptyState glyph="🗓️" title={t('calendar.emptyDay')} />
        ) : (
          dayItems.map((it, i) => (
            <div
              key={`${it.blockId}:${i}`}
              className="card cal-item"
              {...clickable(() => onOpen(it.blockId))}
            >
              <span className={`cal-item-icon ${it.kind}`}>
                {it.kind === 'reminder' ? '🔔' : '📌'}
              </span>
              <div style={{ flex: 1 }}>
                <div className="cal-item-title">{it.title}</div>
                {it.label && <div className="cal-item-label">{it.label}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
