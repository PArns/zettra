/**
 * A tiny, safe spreadsheet formula engine for the formula-table block. No eval(): a hand-written
 * tokenizer + recursive-descent parser evaluates a small grammar over a cell grid.
 *
 * Supported:
 *   - numbers, + - * / and parentheses, unary minus
 *   - cell references (A1, B2 …) — column letters + 1-based row
 *   - ranges (A1:A9) inside functions
 *   - functions SUM, AVG, MIN, MAX, COUNT, PRODUCT
 *   - a formula begins with '=' ; anything else is treated as a literal cell value
 *
 * Circular references resolve to an error rather than looping forever.
 */

export type Grid = string[][];

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
  | { t: 'ref'; col: number; row: number }
  | { t: 'range'; c1: number; r1: number; c2: number; r2: number }
  | { t: 'fn'; name: string }
  | { t: 'op'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'comma' };

const REF = /^([A-Za-z]+)(\d+)/;

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') {
      i++;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      toks.push({ t: 'num', v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      const rest = src.slice(i);
      const m = REF.exec(rest);
      // Function name? letters immediately followed by '('.
      const nameMatch = /^([A-Za-z]+)\s*\(/.exec(rest);
      if (nameMatch && (!m || nameMatch[1].length >= m[0].length)) {
        toks.push({ t: 'fn', name: nameMatch[1].toUpperCase() });
        i += nameMatch[1].length;
        continue;
      }
      if (m) {
        const c1 = columnToIndex(m[1]);
        const r1 = Number(m[2]) - 1;
        let consumed = m[0].length;
        const after = rest.slice(consumed);
        const range = /^:([A-Za-z]+)(\d+)/.exec(after);
        if (range) {
          toks.push({
            t: 'range',
            c1,
            r1,
            c2: columnToIndex(range[1]),
            r2: Number(range[2]) - 1,
          });
          consumed += range[0].length;
        } else {
          toks.push({ t: 'ref', col: c1, row: r1 });
        }
        i += consumed;
        continue;
      }
      throw new Error(`Unexpected token near "${rest.slice(0, 4)}"`);
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

/** Evaluate the whole grid, returning a parallel grid of results. */
export function evaluateGrid(grid: Grid): CellResult[][] {
  const memo = new Map<string, number>();
  const active = new Set<string>();

  const cellNumber = (col: number, row: number): number => {
    const key = `${col}:${row}`;
    if (memo.has(key)) return memo.get(key)!;
    if (active.has(key)) throw new Error('Circular reference');
    const raw = grid[row]?.[col] ?? '';
    let result: number;
    if (raw.startsWith('=')) {
      active.add(key);
      result = evalFormula(raw.slice(1));
      active.delete(key);
    } else {
      const n = Number(raw);
      result = raw.trim() !== '' && Number.isFinite(n) ? n : 0;
    }
    memo.set(key, result);
    return result;
  };

  const refValues = (t: Tok): number[] => {
    if (t.t === 'ref') return [cellNumber(t.col, t.row)];
    if (t.t === 'range') {
      const out: number[] = [];
      const [rLo, rHi] = [Math.min(t.r1, t.r2), Math.max(t.r1, t.r2)];
      const [cLo, cHi] = [Math.min(t.c1, t.c2), Math.max(t.c1, t.c2)];
      for (let r = rLo; r <= rHi; r++) for (let c = cLo; c <= cHi; c++) out.push(cellNumber(c, r));
      return out;
    }
    return [];
  };

  function evalFormula(src: string): number {
    const toks = tokenize(src);
    let pos = 0;
    const peek = () => toks[pos];
    const next = () => toks[pos++];

    // expr := term (('+'|'-') term)*
    function expr(): number {
      let v = term();
      while (peek()?.t === 'op' && (peek() as { v: string }).v.match(/[+-]/)) {
        const op = (next() as { v: string }).v;
        const r = term();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    // term := factor (('*'|'/') factor)*
    function term(): number {
      let v = factor();
      while (peek()?.t === 'op' && (peek() as { v: string }).v.match(/[*/]/)) {
        const op = (next() as { v: string }).v;
        const r = factor();
        v = op === '*' ? v * r : v / r;
      }
      return v;
    }
    // factor := number | ref | fn(args) | '(' expr ')' | '-' factor
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
        return cellNumber(t.col, t.row);
      }
      if (t.t === 'fn') {
        next();
        if (next()?.t !== 'lp') throw new Error('Expected (');
        const args: number[] = [];
        if (peek()?.t !== 'rp') {
          for (;;) {
            const p = peek();
            if (p?.t === 'range') {
              next();
              args.push(...refValues(p));
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

    const v = expr();
    if (pos !== toks.length) throw new Error('Trailing input');
    return v;
  }

  return grid.map((row, r) =>
    row.map((raw, c) => {
      if (!raw.startsWith('=')) {
        const n = Number(raw);
        const isNum = raw.trim() !== '' && Number.isFinite(n);
        return { display: raw, value: isNum ? n : null };
      }
      try {
        const v = cellNumber(c, r);
        const display = Number.isInteger(v) ? String(v) : v.toFixed(2);
        return { display, value: v };
      } catch (err) {
        return { display: '#ERR', value: null, error: (err as Error).message };
      }
    }),
  );
}
