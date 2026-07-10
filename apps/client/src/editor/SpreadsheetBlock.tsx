import { useMemo, useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import {
  BLOCK_TYPES,
  cellKey,
  condFormatColor,
  emptySheet,
  evalCell,
  indexToCol,
  spreadsheetPropSchema,
  type CondFormatRule,
  type SheetData,
} from '@zettra/shared';

function parseData(raw: string): SheetData {
  if (!raw) return emptySheet();
  try {
    const d = JSON.parse(raw) as SheetData;
    return { rows: d.rows ?? 4, cols: d.cols ?? 3, cells: d.cells ?? {}, cf: d.cf ?? [] };
  } catch {
    return emptySheet();
  }
}

const CF_OPS: { op: CondFormatRule['op']; label: string }[] = [
  { op: 'gt', label: '>' },
  { op: 'gte', label: '≥' },
  { op: 'lt', label: '<' },
  { op: 'lte', label: '≤' },
  { op: 'eq', label: '=' },
  { op: 'ne', label: '≠' },
];
const CF_COLORS = ['#16a34a', '#dc2626', '#d97706', '#2563eb', '#7c3aed'];

/**
 * Editable spreadsheet grid (§4). Cells hold a value or an Excel-style `=formula`; the grid shows
 * the computed value but reveals the formula when a cell is focused (click to edit). Supports A1
 * references, ranges, SUM/AVG/MIN/MAX/COUNT/PRODUCT + arithmetic, and conditional formatting rules
 * on formula results. The whole sheet round-trips as JSON in the block's `data` prop.
 */
function Sheet({
  data,
  onChange,
}: {
  data: SheetData;
  onChange: (next: SheetData) => void;
}) {
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const [menu, setMenu] = useState<null | 'cf' | 'help'>(null);
  const [cfDraft, setCfDraft] = useState<{ op: CondFormatRule['op']; value: string; color: string }>(
    { op: 'gt', value: '', color: CF_COLORS[0] },
  );

  const results = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evalCell>>();
    for (let r = 0; r < data.rows; r++) {
      for (let c = 0; c < data.cols; c++) {
        const k = cellKey(c, r);
        map.set(k, evalCell(data, k));
      }
    }
    return map;
  }, [data]);

  const commit = (key: string, value: string) => {
    const cells = { ...data.cells };
    if (value.trim() === '') delete cells[key];
    else cells[key] = value;
    onChange({ ...data, cells });
    setEditing(null);
  };

  const addRule = () => {
    const v = Number(cfDraft.value);
    if (!Number.isFinite(v)) return;
    onChange({ ...data, cf: [...(data.cf ?? []), { op: cfDraft.op, value: v, color: cfDraft.color }] });
    setCfDraft({ op: 'gt', value: '', color: CF_COLORS[0] });
  };

  return (
    <div className="zx-sheet" contentEditable={false}>
      <div className="zx-sheet-bar">
        <button onClick={() => onChange({ ...data, rows: data.rows + 1 })}>+ Zeile</button>
        <button onClick={() => onChange({ ...data, cols: data.cols + 1 })}>+ Spalte</button>
        <span className="zx-sheet-sep" />
        <div className="zx-sheet-menuwrap">
          <button className={menu === 'cf' ? 'on' : ''} onClick={() => setMenu(menu === 'cf' ? null : 'cf')}>
            🎨 Bedingte Formatierung
          </button>
          {menu === 'cf' && (
            <div className="zx-sheet-menu">
              <div className="zx-sheet-menu-head">Regel: Wert …</div>
              <div className="zx-cf-row">
                <select
                  value={cfDraft.op}
                  onChange={(e) => setCfDraft({ ...cfDraft, op: e.target.value as CondFormatRule['op'] })}
                >
                  {CF_OPS.map((o) => (
                    <option key={o.op} value={o.op}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="100"
                  value={cfDraft.value}
                  onChange={(e) => setCfDraft({ ...cfDraft, value: e.target.value })}
                />
                <div className="zx-cf-colors">
                  {CF_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`zx-cf-color ${cfDraft.color === c ? 'on' : ''}`}
                      style={{ background: c }}
                      onClick={() => setCfDraft({ ...cfDraft, color: c })}
                    />
                  ))}
                </div>
                <button className="zx-cf-add" onClick={addRule}>
                  +
                </button>
              </div>
              {(data.cf ?? []).map((rule, i) => (
                <div key={i} className="zx-cf-rule">
                  <span className="zx-cf-swatch" style={{ background: rule.color }} />
                  Wert {CF_OPS.find((o) => o.op === rule.op)?.label} {rule.value}
                  <button
                    className="zx-cf-del"
                    onClick={() =>
                      onChange({ ...data, cf: (data.cf ?? []).filter((_, j) => j !== i) })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="zx-sheet-menuwrap">
          <button className={menu === 'help' ? 'on' : ''} onClick={() => setMenu(menu === 'help' ? null : 'help')}>
            ? Formeln
          </button>
          {menu === 'help' && (
            <div className="zx-sheet-menu zx-sheet-help">
              <p>
                Beginne eine Zelle mit <code>=</code> für eine Formel. Zellbezüge wie{' '}
                <code>A1</code>, Bereiche wie <code>A1:A5</code>.
              </p>
              <p>
                <b>Funktionen:</b> <code>SUM</code>, <code>AVG</code>, <code>MIN</code>,{' '}
                <code>MAX</code>, <code>COUNT</code>, <code>PRODUCT</code>. Rechnen mit{' '}
                <code>+ - * / ( )</code>.
              </p>
              <p>
                Beispiel: <code>=SUM(B1:B4)*1.19</code>. Klick auf eine berechnete Zelle zeigt die
                Formel.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="zx-sheet-scroll">
        <table className="zx-sheet-table">
          <thead>
            <tr>
              <th className="zx-sheet-corner" />
              {Array.from({ length: data.cols }, (_, c) => (
                <th key={c}>{indexToCol(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: data.rows }, (_, r) => (
              <tr key={r}>
                <th className="zx-sheet-rowhead">{r + 1}</th>
                {Array.from({ length: data.cols }, (_, c) => {
                  const key = cellKey(c, r);
                  const res = results.get(key)!;
                  const isEditing = editing?.key === key;
                  const color = condFormatColor(data, res);
                  return (
                    <td
                      key={c}
                      className={res.error ? 'zx-sheet-err' : ''}
                      style={color ? { background: color, color: '#fff' } : undefined}
                      onClick={() => {
                        if (!isEditing) setEditing({ key, value: data.cells[key] ?? '' });
                      }}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          className="zx-sheet-input"
                          value={editing.value}
                          onChange={(e) => setEditing({ key, value: e.target.value })}
                          onBlur={() => commit(key, editing.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commit(key, editing.value);
                            if (e.key === 'Escape') setEditing(null);
                          }}
                        />
                      ) : (
                        <span className="zx-sheet-val">
                          {typeof res.value === 'number' ? fmtNum(res.value) : res.value}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export const SpreadsheetBlock = createReactBlockSpec(
  { type: BLOCK_TYPES.spreadsheet, propSchema: spreadsheetPropSchema, content: 'none' } as const,
  {
    render: ({ block, editor }) => {
      const data = parseData(block.props.data);
      return (
        <Sheet
          data={data}
          onChange={(next) =>
            editor.updateBlock(block, { props: { data: JSON.stringify(next) } })
          }
        />
      );
    },
  },
);
