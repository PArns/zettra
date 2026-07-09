import { useMemo, useState } from 'react';
import { cx } from '../ui';
import {
  evaluateWorkbook,
  indexToColumn,
  type EvalOptions,
  type Grid,
  type Sheets,
} from './formula';
import { cellTone, type CondRule, type CondTone } from './conditional-format';

const TONE_VAR: Record<CondTone, string> = {
  green: '--green',
  amber: '--amber',
  red: '--red',
  blue: '--blue',
  accent: '--accent',
};

function toneStyle(tone: CondTone): React.CSSProperties {
  const v = `var(${TONE_VAR[tone]})`;
  return { background: `color-mix(in srgb, ${v} 15%, transparent)`, color: v };
}

/**
 * Editable table with live spreadsheet formulas. Cells starting with '=' are evaluated by the
 * pure engine in ./formula. Supports cross-sheet references (`Sheet!A1`) via `context`, entity
 * rollups via `rollup`, and conditional formatting via `rules`. Click a cell to edit its source.
 */
export function FormulaTable({
  headers,
  initial,
  sheetName = 'Sheet1',
  context = {},
  rules = [],
  rollup,
}: {
  headers: string[];
  initial: Grid;
  sheetName?: string;
  context?: Sheets;
  rules?: CondRule[];
  rollup?: EvalOptions['rollup'];
}) {
  const [grid, setGrid] = useState<Grid>(initial);
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const results = useMemo(
    () => evaluateWorkbook({ [sheetName]: grid, ...context }, { rollup })[sheetName],
    [grid, sheetName, context, rollup],
  );

  function setCell(r: number, c: number, value: string) {
    setGrid((g) =>
      g.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row)),
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-9 border-b border-r border-border bg-surface-2 px-2 py-2 text-xs font-semibold text-faint" />
            {headers.map((h, c) => (
              <th
                key={c}
                className="border-b border-border bg-surface-2 px-3 py-2 text-left font-semibold text-muted"
              >
                {h}
                <span className="ml-1.5 text-xs font-normal text-faint">{indexToColumn(c)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, r) => (
            <tr key={r}>
              <td className="border-r border-border bg-surface-2 px-2 py-1.5 text-center text-xs text-faint">
                {r + 1}
              </td>
              {row.map((raw, c) => {
                const res = results[r][c];
                const isEditing = editing?.r === r && editing?.c === c;
                const isFormula = raw.startsWith('=');
                const tone = res ? cellTone(res, c, rules) : null;
                return (
                  <td
                    key={c}
                    onClick={() => setEditing({ r, c })}
                    style={tone && !isEditing ? toneStyle(tone) : undefined}
                    className={cx(
                      'cursor-text border-b border-l border-border px-3 py-1.5',
                      res.error && 'text-red',
                      !res.error && !tone && res.value !== null && 'text-right tabular-nums',
                      !res.error &&
                        tone &&
                        res.value !== null &&
                        'text-right font-medium tabular-nums',
                    )}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        defaultValue={raw}
                        onBlur={(e) => {
                          setCell(r, c, e.target.value);
                          setEditing(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                        className="w-full min-w-[3rem] bg-transparent font-mono text-[13px] text-text outline-none"
                      />
                    ) : (
                      <span
                        className={cx('block', isFormula && 'font-medium')}
                        title={isFormula ? raw : undefined}
                      >
                        {res.display || ' '}
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
  );
}
