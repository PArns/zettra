import { useMemo, useState } from 'react';
import { cx } from '../ui';
import { evaluateGrid, indexToColumn, type Grid } from './formula';

/**
 * Editable table with live spreadsheet formulas. Cells starting with '=' are evaluated by the
 * pure engine in ./formula. Click a cell to edit its raw source; blur re-evaluates the grid.
 */
export function FormulaTable({ headers, initial }: { headers: string[]; initial: Grid }) {
  const [grid, setGrid] = useState<Grid>(initial);
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const results = useMemo(() => evaluateGrid(grid), [grid]);

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
                return (
                  <td
                    key={c}
                    onClick={() => setEditing({ r, c })}
                    className={cx(
                      'cursor-text border-b border-l border-border px-3 py-1.5',
                      res.error && 'text-red',
                      !res.error && res.value !== null && 'text-right tabular-nums',
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
                        {res.display || ' '}
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
