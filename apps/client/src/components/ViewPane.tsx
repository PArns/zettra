import { useEffect, useState } from 'react';
import type { ViewData } from '../lib/api';
import { api } from '../lib/api';
import { blockTitle } from '../lib/blocks';

/**
 * Renders a saved view (§8.2) as table / board / list from the server's view-data payload
 * (rows + typed field values). groupBy drives board columns.
 */
export function ViewPane({ viewId, onOpen }: { viewId: string; onOpen: (id: string) => void }) {
  const [data, setData] = useState<ViewData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <div className="empty">Could not load view: {error}</div>;
  if (!data)
    return (
      <div className="empty">
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  if (data.rows.length === 0) {
    return (
      <div className="empty">
        <div className="big">🗂️</div>
        No items with this supertag yet.
      </div>
    );
  }

  const layout = data.view.layout;
  if (layout === 'board' && data.view.groupBy) return <Board data={data} onOpen={onOpen} />;
  if (layout === 'list') return <List data={data} onOpen={onOpen} />;
  if (layout === 'gallery') return <Gallery data={data} onOpen={onOpen} />;
  if (layout === 'calendar') return <Calendar data={data} onOpen={onOpen} />;
  return <Table data={data} onOpen={onOpen} />;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? '✓' : '—';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function Table({ data, onOpen }: { data: ViewData; onOpen: (id: string) => void }) {
  return (
    <div className="table-wrap">
      <table className="zx">
        <thead>
          <tr>
            <th>Name</th>
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

function Board({ data, onOpen }: { data: ViewData; onOpen: (id: string) => void }) {
  const groupField = data.fields.find((f) => f.id === data.view.groupBy);
  const options =
    (groupField?.config?.options as string[] | undefined) ?? uniqueValues(data, data.view.groupBy!);
  return (
    <div className="board">
      {options.map((opt) => {
        const rows = data.rows.filter((r) => fmt(r.values[data.view.groupBy!]) === opt);
        return (
          <div className="board-col" key={opt}>
            <div className="head">
              <span>{opt}</span>
              <span>{rows.length}</span>
            </div>
            {rows.map((r) => (
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
        );
      })}
    </div>
  );
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
