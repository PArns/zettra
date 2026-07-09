/**
 * A tiny, safe spreadsheet formula engine for the formula-table block. No eval(): a hand-written
 * tokenizer + recursive-descent parser evaluates a small grammar over one or more named grids.
 *
 * Supported:
 *   - numbers, + - * / and parentheses, unary minus
 *   - cell references (A1, B2 …) — column letters + 1-based row
 *   - cross-sheet references (Sheet!A1, Sheet!A1:B3) — a formula in one table can read another
 *   - ranges (A1:A9) inside functions
 *   - functions SUM, AVG, MIN, MAX, COUNT, PRODUCT
 *   - ROLLUP("Tag", "field", "sum"|…) — aggregate a field across linked entities via an injected
 *     resolver (the app supplies live data; the demo supplies a stub). Cross-reference beyond the
 *     spreadsheet.
 *   - a formula begins with '=' ; anything else is treated as a literal cell value
 *
 * Circular references (within or across sheets) resolve to an error rather than looping forever.
 */

export type Grid = string[][];
export type Sheets = Record<string, Grid>;

/** Aggregations a ROLLUP can request over the resolved values of a linked field. */
export type RollupAgg = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface EvalOptions {
  /** Resolve ROLLUP(name, field, agg) → a number (or null if unavailable). */
  rollup?: (name: string, field: string, agg: RollupAgg) => number | null;
}

export interface CellResult {
  /** Rendered display value (number formatted, or the raw literal, or an error marker). */
  display: string;
  /** Numeric value when the cell resolves to a number, else null. */
  value: number | null;
  error?: string;
}

/** Convert a column letter sequence (A, B, …, Z, AA) to a 0-based index. */
export function columnToIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Convert a 0-based column index back to letters (0 → A). */
export function indexToColumn(index: number): string {
  let s = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'ref'; sheet: string | null; col: number; row: number }
  | { t: 'range'; sheet: string | null; c1: number; r1: number; c2: number; r2: number }
  | { t: 'fn'; name: string }
  | { t: 'op'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'comma' };

// Optional `Sheet!` qualifier, then a cell like `A1`.
const REF = /^(?:([A-Za-z_][A-Za-z0-9_ ]*?)!)?([A-Za-z]+)(\d+)/;

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) j++;
      if (j >= src.length) throw new Error('Unterminated string');
      toks.push({ t: 'str', v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      toks.push({ t: 'num', v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const rest = src.slice(i);
      // Function name? letters immediately followed by '(' (no sheet-qualifier involved).
      const nameMatch = /^([A-Za-z_]+)\s*\(/.exec(rest);
      const m = REF.exec(rest);
      if (nameMatch && (!m || nameMatch[1].length >= m[0].length)) {
        toks.push({ t: 'fn', name: nameMatch[1].toUpperCase() });
        i += nameMatch[1].length;
        continue;
      }
      if (m) {
        const sheet = m[1] ? m[1].trim() : null;
        const c1 = columnToIndex(m[2]);
        const r1 = Number(m[3]) - 1;
        let consumed = m[0].length;
        const after = rest.slice(consumed);
        const range = /^:([A-Za-z]+)(\d+)/.exec(after);
        if (range) {
          toks.push({
            t: 'range',
            sheet,
            c1,
            r1,
            c2: columnToIndex(range[1]),
            r2: Number(range[2]) - 1,
          });
          consumed += range[0].length;
        } else {
          toks.push({ t: 'ref', sheet, col: c1, row: r1 });
        }
        i += consumed;
        continue;
      }
      throw new Error(`Unexpected token near "${rest.slice(0, 6)}"`);
    }
    if ('+-*/'.includes(ch)) {
      toks.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    if (ch === '(') {
      toks.push({ t: 'lp' });
      i++;
      continue;
    }
    if (ch === ')') {
      toks.push({ t: 'rp' });
      i++;
      continue;
    }
    if (ch === ',') {
      toks.push({ t: 'comma' });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${ch}"`);
  }
  return toks;
}

const FUNCS: Record<string, (xs: number[]) => number> = {
  SUM: (xs) => xs.reduce((a, b) => a + b, 0),
  PRODUCT: (xs) => xs.reduce((a, b) => a * b, 1),
  AVG: (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0),
  MIN: (xs) => (xs.length ? Math.min(...xs) : 0),
  MAX: (xs) => (xs.length ? Math.max(...xs) : 0),
  COUNT: (xs) => xs.length,
};

const ROLLUP_AGGS: RollupAgg[] = ['sum', 'avg', 'min', 'max', 'count'];

/** Evaluate a workbook of named sheets, returning a parallel result grid per sheet. */
export function evaluateWorkbook(
  sheets: Sheets,
  options: EvalOptions = {},
): Record<string, CellResult[][]> {
  const names = Object.keys(sheets);
  const primary = names[0] ?? 'Sheet1';
  const memo = new Map<string, number>();
  const active = new Set<string>();

  const key = (sheet: string, col: number, row: number) => `${sheet}:${col}:${row}`;

  const cellNumber = (sheet: string, col: number, row: number): number => {
    const k = key(sheet, col, row);
    if (memo.has(k)) return memo.get(k)!;
    if (active.has(k)) throw new Error('Circular reference');
    const raw = sheets[sheet]?.[row]?.[col] ?? '';
    let result: number;
    if (raw.startsWith('=')) {
      active.add(k);
      result = evalFormula(raw.slice(1), sheet);
      active.delete(k);
    } else {
      const n = Number(raw);
      result = raw.trim() !== '' && Number.isFinite(n) ? n : 0;
    }
    memo.set(k, result);
    return result;
  };

  const rangeValues = (t: Extract<Tok, { t: 'ref' | 'range' }>, home: string): number[] => {
    const sheet = t.sheet ?? home;
    if (t.t === 'ref') return [cellNumber(sheet, t.col, t.row)];
    const [rLo, rHi] = [Math.min(t.r1, t.r2), Math.max(t.r1, t.r2)];
    const [cLo, cHi] = [Math.min(t.c1, t.c2), Math.max(t.c1, t.c2)];
    const out: number[] = [];
    for (let r = rLo; r <= rHi; r++)
      for (let c = cLo; c <= cHi; c++) out.push(cellNumber(sheet, c, r));
    return out;
  };

  function evalFormula(src: string, home: string): number {
    const toks = tokenize(src);
    let pos = 0;
    const peek = () => toks[pos];
    const next = () => toks[pos++];

    function expr(): number {
      let v = term();
      while (peek()?.t === 'op' && (peek() as { v: string }).v.match(/[+-]/)) {
        const op = (next() as { v: string }).v;
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    function term(): number {
      let v = factor();
      while (peek()?.t === 'op' && (peek() as { v: string }).v.match(/[*/]/)) {
        const op = (next() as { v: string }).v;
        const r = factor();
        v = op === '*' ? v * r : v / r;
      }
      return v;
    }
    function factor(): number {
      const t = peek();
      if (!t) throw new Error('Unexpected end of formula');
      if (t.t === 'op' && t.v === '-') {
        next();
        return -factor();
      }
      if (t.t === 'num') {
        next();
        return t.v;
      }
      if (t.t === 'ref') {
        next();
        return cellNumber(t.sheet ?? home, t.col, t.row);
      }
      if (t.t === 'fn') {
        next();
        if (t.name === 'ROLLUP') return rollupCall();
        if (next()?.t !== 'lp') throw new Error('Expected (');
        const args: number[] = [];
        if (peek()?.t !== 'rp') {
          for (;;) {
            const p = peek();
            if (p?.t === 'range') {
              next();
              args.push(...rangeValues(p, home));
            } else {
              args.push(expr());
            }
            if (peek()?.t === 'comma') {
              next();
              continue;
            }
            break;
          }
        }
        if (next()?.t !== 'rp') throw new Error('Expected )');
        const fn = FUNCS[t.name];
        if (!fn) throw new Error(`Unknown function ${t.name}`);
        return fn(args);
      }
      if (t.t === 'lp') {
        next();
        const v = expr();
        if (next()?.t !== 'rp') throw new Error('Expected )');
        return v;
      }
      throw new Error('Unexpected token');
    }

    // ROLLUP("Tag", "field", "sum") — string args resolved by the injected resolver.
    function rollupCall(): number {
      if (next()?.t !== 'lp') throw new Error('Expected (');
      const strs: string[] = [];
      while (peek()?.t === 'str') {
        strs.push((next() as { v: string }).v);
        if (peek()?.t === 'comma') next();
      }
      if (next()?.t !== 'rp') throw new Error('Expected )');
      const [name, field, aggRaw] = strs;
      const agg = (aggRaw?.toLowerCase() ?? 'sum') as RollupAgg;
      if (!name || !field) throw new Error('ROLLUP needs a tag and a field');
      if (!ROLLUP_AGGS.includes(agg)) throw new Error(`Unknown rollup ${aggRaw}`);
      if (!options.rollup) throw new Error('ROLLUP unavailable');
      const v = options.rollup(name, field, agg);
      if (v == null || !Number.isFinite(v)) throw new Error('ROLLUP has no value');
      return v;
    }

    const v = expr();
    if (pos !== toks.length) throw new Error('Trailing input');
    return v;
  }

  const out: Record<string, CellResult[][]> = {};
  for (const name of names) {
    out[name] = sheets[name].map((row, r) =>
      row.map((raw, c) => {
        if (!raw.startsWith('=')) {
          const n = Number(raw);
          const isNum = raw.trim() !== '' && Number.isFinite(n);
          return { display: raw, value: isNum ? n : null };
        }
        try {
          const v = cellNumber(name, c, r);
          const display = Number.isInteger(v) ? String(v) : v.toFixed(2);
          return { display, value: v };
        } catch (err) {
          return { display: '#ERR', value: null, error: (err as Error).message };
        }
      }),
    );
  }
  void primary;
  return out;
}

/** Convenience: evaluate a single unnamed grid (wraps {@link evaluateWorkbook}). */
export function evaluateGrid(grid: Grid, options: EvalOptions = {}): CellResult[][] {
  return evaluateWorkbook({ Sheet1: grid }, options).Sheet1;
}
