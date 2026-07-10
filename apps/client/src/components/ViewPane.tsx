import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ViewData } from '../lib/api';
import { api } from '../lib/api';
import { useT } from '../i18n';
import { blockTitle } from '../lib/blocks';

/**
 * Renders a saved view (§8.2) as table / board / list from the server's view-data payload
 * (rows + typed field values). groupBy drives board columns.
 */
export function ViewPane({ viewId, onOpen }: { viewId: string; onOpen: (id: string) => void }) {
  const t = useT();
  const [data, setData] = useState<ViewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    api
      .viewData(viewId)
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [viewId]);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    api
      .viewData(viewId)
      .then((d) => live && setData(d))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [viewId]);

  /** Kanban card moved to another column → persist the new group-field value, then reconcile. */
  const move = useCallback(
    async (blockId: string, value: string) => {
      const groupBy = data?.view.groupBy;
      if (!groupBy) return;
      // Optimistic: re-bucket the card immediately so the drag feels instant.
      setData((d) =>
        d
          ? {
              ...d,
              rows: d.rows.map((r) =>
                r.block.id === blockId ? { ...r, values: { ...r.values, [groupBy]: value } } : r,
              ),
            }
          : d,
      );
      try {
        await api.setField(blockId, groupBy, value);
      } finally {
        reload();
      }
    },
    [data?.view.groupBy, reload],
  );

  /** Persist a layout/groupBy change (board switch, group-field pick), then reconcile. */
  const applyView = useCallback(
    async (patch: { layout?: string; groupBy?: string | null }) => {
      setData((d) => (d ? { ...d, view: { ...d.view, ...patch } } : d));
      try {
        await api.updateView(viewId, patch);
      } finally {
        reload();
      }
    },
    [viewId, reload],
  );

  if (error)
    return (
      <div className="empty">
        {t('view.loadError')}: {error}
      </div>
    );
  if (!data)
    return (
      <div className="empty">
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );

  const layout = data.view.layout;
  const body =
    data.rows.length === 0 ? (
      <div className="empty">
        <div className="big">🗂️</div>
        {t('view.empty')}
      </div>
    ) : layout === 'board' && data.view.groupBy ? (
      <Board data={data} onOpen={onOpen} onMove={move} />
    ) : layout === 'list' ? (
      <List data={data} onOpen={onOpen} />
    ) : layout === 'gallery' ? (
      <Gallery data={data} onOpen={onOpen} />
    ) : layout === 'calendar' ? (
      <Calendar data={data} onOpen={onOpen} />
    ) : (
      <Table data={data} onOpen={onOpen} />
    );

  return (
    <div className="view-pane">
      <ViewToolbar data={data} onApply={applyView} />
      {body}
    </div>
  );
}

/** Layout switcher + (for boards) a group-field picker — turns any view into a kanban (§8.2). */
function ViewToolbar({
  data,
  onApply,
}: {
  data: ViewData;
  onApply: (patch: { layout?: string; groupBy?: string | null }) => void;
}) {
  const t = useT();
  const selectFields = data.fields.filter((f) => f.type === 'select');
  const layout = data.view.layout;

  const setLayout = (next: string) => {
    if (next === layout) return;
    // Switching to board needs a group field; default to the first select field.
    if (next === 'board' && !data.view.groupBy) {
      const first = selectFields[0]?.id;
      if (!first) return; // no select field to group by — board would be a single column
      onApply({ layout: 'board', groupBy: first });
    } else {
      onApply({ layout: next });
    }
  };

  return (
    <div className="view-toolbar">
      <div className="seg">
        <button className={layout !== 'board' ? 'active' : ''} onClick={() => setLayout('table')}>
          {t('view.table')}
        </button>
        <button
          className={layout === 'board' ? 'active' : ''}
          onClick={() => setLayout('board')}
          disabled={selectFields.length === 0}
          title={selectFields.length === 0 ? t('view.boardNeedsSelect') : undefined}
        >
          {t('view.board')}
        </button>
      </div>
      {layout === 'board' && selectFields.length > 0 && (
        <label className="view-groupby">
          {t('view.groupBy')}
          <select
            value={data.view.groupBy ?? ''}
            onChange={(e) => onApply({ groupBy: e.target.value })}
          >
            {selectFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '—';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function Table({ data, onOpen }: { data: ViewData; onOpen: (id: string) => void }) {
  const t = useT();
  return (
    <div className="table-wrap">
      <table className="zx">
        <thead>
          <tr>
            <th>{t('common.name')}</th>
            {data.fields.map((f) => (
              <th key={f.id}>{f.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr
              key={row.block.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onOpen(row.block.id)}
            >
              <td style={{ fontWeight: 600 }}>{blockTitle(row.block)}</td>
              {data.fields.map((f) => (
                <td key={f.id}>{fmt(row.values[f.id])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function List({ data, onOpen }: { data: ViewData; onOpen: (id: string) => void }) {
  return (
    <div className="inbox-list">
      {data.rows.map((row) => (
        <div
          key={row.block.id}
          className="card clickable inbox-item"
          onClick={() => onOpen(row.block.id)}
        >
          <div className="title">{blockTitle(row.block)}</div>
          <div className="meta">
            {data.fields.slice(0, 3).map((f) => (
              <span key={f.id} className="badge">
                {f.name}: {fmt(row.values[f.id])}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Kanban board: rows bucketed into columns by the view's `groupBy` (select) field. Dragging a
 * card to another column persists the new value via `onMove`, so the board is a live editor of
 * that field — not just a read-only projection. The dragged id lives in a ref (not state) so
 * the drop handler reads it synchronously, without waiting on a React re-render.
 */
function Board({
  data,
  onOpen,
  onMove,
}: {
  data: ViewData;
  onOpen: (id: string) => void;
  onMove: (blockId: string, value: string) => void;
}) {
  const groupBy = data.view.groupBy!;
  const groupField = data.fields.find((f) => f.id === groupBy);
  const options =
    (groupField?.config?.options as string[] | undefined) ?? uniqueValues(data, groupBy);
  // Secondary select fields (e.g. priority) shown as badges on each card — not the group field.
  const badgeFields = data.fields.filter((f) => f.id !== groupBy && f.type === 'select');
  const dragRef = useRef<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  return (
    <div className="board">
      {options.map((opt) => {
        const rows = data.rows.filter((r) => fmt(r.values[groupBy]) === opt);
        return (
          <div
            className={'board-col' + (overCol === opt ? ' drop-target' : '')}
            key={opt}
            onDragOver={(e) => {
              if (!dragRef.current) return;
              e.preventDefault();
              setOverCol(opt);
            }}
            onDragLeave={() => setOverCol((o) => (o === opt ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              const id = dragRef.current;
              if (id && fmt(data.rows.find((r) => r.block.id === id)?.values[groupBy]) !== opt) {
                onMove(id, opt);
              }
              dragRef.current = null;
              setOverCol(null);
            }}
          >
            <div className="head" style={{ '--col-accent': hueFor(opt) } as CSSProperties}>
              <span className="board-col-title">
                <span className="board-col-dot" />
                {opt}
              </span>
              <span className="board-col-count">{rows.length}</span>
            </div>
            <div className="board-col-body">
              {rows.map((r) => (
                <div
                  key={r.block.id}
                  className="card board-card"
                  draggable
                  onDragStart={(e) => {
                    dragRef.current = r.block.id;
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    dragRef.current = null;
                    setOverCol(null);
                  }}
                  onClick={() => onOpen(r.block.id)}
                >
                  <div className="board-card-title">{blockTitle(r.block)}</div>
                  {badgeFields.some((f) => r.values[f.id] != null) && (
                    <div className="board-card-badges">
                      {badgeFields.map((f) =>
                        r.values[f.id] != null ? (
                          <span key={f.id} className="badge board-badge">
                            {fmt(r.values[f.id])}
                          </span>
                        ) : null,
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Deterministic accent hue for a column, so each status column reads as its own lane. */
function hueFor(option: string): string {
  let h = 0;
  for (let i = 0; i < option.length; i++) h = (h * 31 + option.charCodeAt(i)) % 360;
  return `${h}`;
}

function uniqueValues(data: ViewData, fieldId: string): string[] {
  return [...new Set(data.rows.map((r) => fmt(r.values[fieldId])))];
}

function Gallery({ data, onOpen }: { data: ViewData; onOpen: (id: string) => void }) {
  return (
    <div className="gallery">
      {data.rows.map((row) => (
        <div key={row.block.id} className="card clickable" onClick={() => onOpen(row.block.id)}>
          <div className="gallery-thumb">{blockTitle(row.block).slice(0, 1).toUpperCase()}</div>
          <div style={{ fontWeight: 600, marginTop: 10 }}>{blockTitle(row.block)}</div>
          <div className="meta" style={{ marginTop: 6 }}>
            {data.fields.slice(0, 2).map((f) => (
              <span key={f.id} className="badge">
                {fmt(row.values[f.id])}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Calendar buckets rows by their groupBy date field (or the first date field). */
function Calendar({ data, onOpen }: { data: ViewData; onOpen: (id: string) => void }) {
  const dateField =
    data.fields.find((f) => f.id === data.view.groupBy && f.type === 'date') ??
    data.fields.find((f) => f.type === 'date');
  if (!dateField) return <Table data={data} onOpen={onOpen} />;

  const byDay = new Map<string, typeof data.rows>();
  for (const row of data.rows) {
    const raw = row.values[dateField.id];
    const day = raw ? new Date(String(raw)).toISOString().slice(0, 10) : 'No date';
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }
  const days = [...byDay.keys()].sort();

  return (
    <div className="board">
      {days.map((day) => (
        <div className="board-col" key={day}>
          <div className="head">
            <span>
              {day === 'No date'
                ? day
                : new Date(day).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
            </span>
            <span>{byDay.get(day)!.length}</span>
          </div>
          {byDay.get(day)!.map((r) => (
            <div
              key={r.block.id}
              className="card clickable"
              style={{ marginBottom: 8 }}
              onClick={() => onOpen(r.block.id)}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{blockTitle(r.block)}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
