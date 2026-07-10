import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorContentOrSelectionChange } from '@blocknote/react';
import { api } from '../lib/api';

/** Structural view of BlockNote's table content (0.25.2 — supports headerRows/headerCols). */
interface TableCellObj {
  type: 'tableCell';
  content?: Array<{ type: string; text?: string }>;
}
type Cell = Array<{ type: string; text?: string }> | TableCellObj;
interface TableContent {
  type: 'tableContent';
  columnWidths: (number | undefined)[];
  headerRows?: number;
  headerCols?: number;
  rows: { cells: Cell[] }[];
}
interface TableBlock {
  id: string;
  type: string;
  content: TableContent;
}

type Agg = 'sum' | 'avg' | 'min' | 'max' | 'count';
const AGGS: { key: Agg; label: string }[] = [
  { key: 'sum', label: 'Summe (Σ)' },
  { key: 'avg', label: 'Durchschnitt (⌀)' },
  { key: 'min', label: 'Minimum' },
  { key: 'max', label: 'Maximum' },
  { key: 'count', label: 'Anzahl' },
];

/** Read a cell's plain text, whether cells are inline-arrays or `tableCell` objects. */
function cellText(cell: Cell | undefined): string {
  if (!cell) return '';
  const inline = Array.isArray(cell) ? cell : (cell.content ?? []);
  return inline.map((n) => (n && typeof n.text === 'string' ? n.text : '')).join('');
}

/** Parse a number out of a cell (tolerates currency/units and EU "1.234,56" formatting). */
function parseNum(s: string): number | null {
  const cleaned = s.replace(/[^0-9,.\-]/g, '');
  if (!cleaned) return null;
  const eu = cleaned.includes(',') && cleaned.includes('.');
  const n = eu ? parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) : parseFloat(cleaned.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function aggregate(nums: number[], agg: Agg): number {
  if (agg === 'count') return nums.length;
  if (!nums.length) return 0;
  if (agg === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (agg === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (agg === 'min') return Math.min(...nums);
  return Math.max(...nums);
}

/** Round to at most 2 decimals without trailing zeros. */
function fmtNum(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Floating table toolbar (§4). Appears above the table the cursor is in, offering: mark a header
 * row / header column (BlockNote `headerRows`/`headerCols` — the header also sticks on scroll,
 * "frozen header"), a formula menu that appends a summary row aggregating each numeric column
 * (sum/avg/min/max/count), and a cross-reference picker that inserts a `[[note]]` into the focused
 * cell. Everything mutates the Yjs doc through the editor, so it round-trips like any edit.
 */
export function TableToolbar({ editor }: { editor: EditorLike }) {
  const [table, setTable] = useState<TableBlock | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [menu, setMenu] = useState<null | 'formula' | 'xref' | 'help'>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const locate = useMemo(
    () => () => {
      // Only while the table is actually being worked in — the editor (or this toolbar) holds
      // focus. Otherwise the bar would linger on load and over other UI even when nothing's
      // selected. Text formatting is BlockNote's own toolbar on cell selection; this bar is only
      // the structural/formula controls.
      const active = document.activeElement as HTMLElement | null;
      const focused = !!active?.closest?.('.bn-editor, .table-toolbar');
      const block = editor.getTextCursorPosition?.()?.block as TableBlock | undefined;
      if (!focused || !block || block.type !== 'table') {
        setTable(null);
        setPos(null);
        setMenu(null);
        return;
      }
      setTable(block);
      const node = document.querySelector<HTMLElement>(`.bn-editor [data-id="${block.id}"]`);
      const r = node?.getBoundingClientRect();
      // Sit just above the table, but never behind the app topbar (~48px).
      if (r) setPos({ top: Math.max(54, r.top - 42), left: r.left });
    },
    [editor],
  );

  useEditorContentOrSelectionChange(() => locate(), editor as never);

  // Show/hide as focus enters or leaves the editor (locate() gates on focus). Deferred so
  // document.activeElement reflects the *new* focus target before we read it.
  useEffect(() => {
    const onFocus = () => setTimeout(locate, 0);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onFocus);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onFocus);
    };
  }, [locate]);

  // Keep the toolbar pinned to the table while the page scrolls / resizes.
  useEffect(() => {
    if (!table) return;
    const onScroll = () => locate();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [table, locate]);

  if (!table || !pos) return null;
  const content = table.content;
  const hasHeaderRow = (content.headerRows ?? 0) > 0;
  const hasHeaderCol = (content.headerCols ?? 0) > 0;

  const update = (patch: Partial<TableContent>) => {
    (editor.updateBlock as (b: string, u: unknown) => void)(table.id, {
      content: { ...content, ...patch },
    });
    // Re-read after the change so button states reflect it.
    setTimeout(locate, 0);
  };

  const addSummary = (agg: Agg) => {
    const numCols = content.columnWidths.length;
    const cells: Cell[] = [];
    for (let j = 0; j < numCols; j++) {
      const nums = content.rows
        .map((row) => parseNum(cellText(row.cells[j])))
        .filter((n): n is number => n != null);
      const text = j === 0 ? agg.toUpperCase() : nums.length ? fmtNum(aggregate(nums, agg)) : '';
      cells.push([{ type: 'text', text, styles: {} } as { type: string; text: string }]);
    }
    update({ rows: [...content.rows, { cells }] });
    setMenu(null);
  };

  return (
    <div
      ref={barRef}
      className="table-toolbar"
      style={{ top: pos.top, left: pos.left }}
      // Keep the editor's text cursor (so inserts land in the focused cell).
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        className={`tt-btn ${hasHeaderRow ? 'on' : ''}`}
        title="Kopfzeile markieren (bleibt beim Scrollen sichtbar)"
        onClick={() => update({ headerRows: hasHeaderRow ? 0 : 1 })}
      >
        ⊤ Kopfzeile
      </button>
      <button
        className={`tt-btn ${hasHeaderCol ? 'on' : ''}`}
        title="Kopfspalte markieren"
        onClick={() => update({ headerCols: hasHeaderCol ? 0 : 1 })}
      >
        ⊢ Kopfspalte
      </button>
      <span className="tt-sep" />
      <div className="tt-menuwrap">
        <button
          className={`tt-btn ${menu === 'formula' ? 'on' : ''}`}
          title="Formel: Zusammenfassungszeile einfügen"
          onClick={() => setMenu(menu === 'formula' ? null : 'formula')}
        >
          Σ Formel
        </button>
        {menu === 'formula' && (
          <div className="tt-menu">
            <div className="tt-menu-head">Zusammenfassungszeile</div>
            {AGGS.map((a) => (
              <button key={a.key} className="tt-menu-item" onClick={() => addSummary(a.key)}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="tt-menuwrap">
        <button
          className={`tt-btn ${menu === 'xref' ? 'on' : ''}`}
          title="Querverweis in die Zelle einfügen"
          onClick={() => setMenu(menu === 'xref' ? null : 'xref')}
        >
          🔗 Querverweis
        </button>
        {menu === 'xref' && (
          <XrefPicker
            onPick={(blockId, label) => {
              (editor.insertInlineContent as (c: unknown) => void)([
                { type: 'reference', props: { blockId, label } },
                ' ',
              ]);
              setMenu(null);
            }}
          />
        )}
      </div>
      <span className="tt-sep" />
      <div className="tt-menuwrap">
        <button
          className={`tt-btn ${menu === 'help' ? 'on' : ''}`}
          title="Hilfe"
          onClick={() => setMenu(menu === 'help' ? null : 'help')}
        >
          ?
        </button>
        {menu === 'help' && (
          <div className="tt-menu tt-help">
            <div className="tt-menu-head">Tabellen-Tools</div>
            <p>
              <b>Kopfzeile / Kopfspalte</b> heben die erste Zeile bzw. Spalte hervor. Eine Kopfzeile
              bleibt beim Scrollen oben sichtbar (frozen header).
            </p>
            <p>
              <b>Σ Formel</b> hängt eine Zeile an, die jede numerische Spalte zusammenfasst (Summe,
              Durchschnitt, Min, Max, Anzahl). Beträge wie „149 EUR“ werden erkannt.
            </p>
            <p>
              <b>Querverweis</b> fügt eine Verknüpfung zu einer anderen Notiz in die aktuelle Zelle
              ein — genau wie <code>[[…]]</code> im Fließtext.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Minimal entity search for inserting a cross-reference into a table cell. */
function XrefPicker({ onPick }: { onPick: (blockId: string, label: string) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ blockId: string; alias: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    let live = true;
    if (!q.trim()) {
      setHits([]);
      return;
    }
    api
      .searchEntities(q)
      .then((r) => live && setHits(r.slice(0, 6)))
      .catch(() => live && setHits([]));
    return () => {
      live = false;
    };
  }, [q]);

  return (
    <div className="tt-menu tt-xref">
      <input
        ref={inputRef}
        className="tt-xref-input"
        value={q}
        placeholder="Notiz suchen…"
        onChange={(e) => setQ(e.target.value)}
      />
      {hits.map((h) => (
        <button key={h.blockId} className="tt-menu-item" onClick={() => onPick(h.blockId, h.alias)}>
          {h.alias}
        </button>
      ))}
      {q.trim() && hits.length === 0 && <div className="tt-menu-empty">Keine Treffer</div>}
    </div>
  );
}

/** The subset of the BlockNote editor API this toolbar uses (kept loose to avoid schema gymnastics). */
export interface EditorLike {
  getTextCursorPosition?: () => { block?: { id: string; type: string; content: TableContent } };
  updateBlock: (block: string, update: unknown) => void;
  insertInlineContent: (content: unknown) => void;
}
