/**
 * A tiny spreadsheet engine (§4) powering the custom `spreadsheet` block: A1-style cell
 * references, ranges, arithmetic, and a handful of aggregate functions. Pure and deterministic so
 * the evaluation + reference logic is unit-testable without the editor. Cells store a raw string;
 * a leading `=` marks a formula (Excel-style). Everything else is a literal value.
 */

export interface CondFormatRule {
  /** Comparison of the cell's numeric result against `value`. */
  op: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne';
  value: number;
  /** CSS color applied to the cell background when the rule matches. */
  color: string;
}

export interface SheetData {
  rows: number;
  cols: number;
  /** Sparse map of `A1` → raw cell string (a value, or a `=formula`). */
  cells: Record<string, string>;
  /** Conditional-formatting rules, applied in order (last match wins). */
  cf?: CondFormatRule[];
}

export function emptySheet(rows = 4, cols = 3): SheetData {
  return { rows, cols, cells: {}, cf: [] };
}

/** Column index (0-based) → letters: 0→A, 25→Z, 26→AA. */
export function indexToCol(i: number): string {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Column letters → 0-based index: A→0, Z→25, AA→26. */
export function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** `A1` → `{ col, row }` (both 0-based), or null if not a cell ref. */
export function parseRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!m) return null;
  return { col: colToIndex(m[1]), row: Number(m[2]) - 1 };
}

export function cellKey(col: number, row: number): string {
  return `${indexToCol(col)}${row + 1}`;
}

/** Parse a loose number out of a string (tolerates currency/units, EU "1.234,56"). null if none. */
export function toNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const cleaned = s.replace(/[^0-9,.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const eu = cleaned.includes(',') && cleaned.includes('.');
  const n = eu
    ? parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
    : parseFloat(cleaned.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const FUNCS = new Set(['SUM', 'AVG', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'PRODUCT']);

type Tok = { t: 'num' | 'ref' | 'range' | 'func' | 'op' | 'paren' | 'comma'; v: string };

function tokenize(expr: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === ' ') {
      i++;
      continue;
    }
    if ('+-*/'.includes(c)) {
      toks.push({ t: 'op', v: c });
      i++;
    } else if (c === '(' || c === ')') {
      toks.push({ t: 'paren', v: c });
      i++;
    } else if (c === ',') {
      toks.push({ t: 'comma', v: c });
      i++;
    } else if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      toks.push({ t: 'num', v: expr.slice(i, j) });
      i = j;
    } else if (/[A-Za-z]/.test(c)) {
      let j = i;
      while (j < expr.length && /[A-Za-z0-9]/.test(expr[j])) j++;
      let word = expr.slice(i, j);
      i = j;
      // Range like A1:B3
      if (expr[i] === ':') {
        let k = i + 1;
        while (k < expr.length && /[A-Za-z0-9]/.test(expr[k])) k++;
        word = `${word}:${expr.slice(i + 1, k)}`;
        i = k;
        toks.push({ t: 'range', v: word });
      } else if (FUNCS.has(word.toUpperCase()) && expr[i] === '(') {
        toks.push({ t: 'func', v: word.toUpperCase() });
      } else {
        toks.push({ t: 'ref', v: word });
      }
    } else {
      i++; // skip unknown char
    }
  }
  return toks;
}

/** Expand a range token (`A1:B3`) into the list of cell keys it covers. */
export function expandRange(range: string): string[] {
  const [a, b] = range.split(':');
  const pa = parseRef(a);
  const pb = parseRef(b);
  if (!pa || !pb) return [];
  const keys: string[] = [];
  for (let r = Math.min(pa.row, pb.row); r <= Math.max(pa.row, pb.row); r++) {
    for (let c = Math.min(pa.col, pb.col); c <= Math.max(pa.col, pb.col); c++) {
      keys.push(cellKey(c, r));
    }
  }
  return keys;
}

/** Result of evaluating a cell: a number, or an error/string. */
export interface CellResult {
  value: number | string;
  error: boolean;
}

/**
 * Evaluate a cell to its displayed result. Formulas (`=…`) are computed; other cells return their
 * literal string (numeric when parseable). Circular references yield `#CYCLE`.
 */
export function evalCell(
  data: SheetData,
  ref: string,
  seen: Set<string> = new Set(),
): CellResult {
  const key = ref.toUpperCase();
  const raw = data.cells[key];
  if (raw == null || raw === '') return { value: '', error: false };
  if (!raw.startsWith('=')) {
    const n = toNumber(raw);
    return { value: n !== null ? n : raw, error: false };
  }
  if (seen.has(key)) return { value: '#CYCLE', error: true };
  seen.add(key);
  try {
    const n = evalExpr(tokenize(raw.slice(1)), data, seen);
    seen.delete(key);
    return { value: Math.round(n * 1e6) / 1e6, error: false };
  } catch (e) {
    seen.delete(key);
    // Preserve a cycle diagnosis as it bubbles up through referencing formulas.
    const cyclic = (e as Error).message === '#CYCLE';
    return { value: cyclic ? '#CYCLE' : '#ERR', error: true };
  }
}

/** Numeric value of a single cell reference (used inside formulas; empty/text → 0). */
function refValue(data: SheetData, ref: string, seen: Set<string>): number {
  const res = evalCell(data, ref, seen);
  if (res.error) throw new Error(String(res.value));
  return typeof res.value === 'number' ? res.value : (toNumber(String(res.value)) ?? 0);
}

/** Numeric values of the cells a func argument covers (a range, a ref, or a literal number). */
function argValues(tok: Tok, data: SheetData, seen: Set<string>): number[] {
  if (tok.t === 'range') return expandRange(tok.v).map((k) => refValue(data, k, seen));
  if (tok.t === 'ref') return [refValue(data, tok.v, seen)];
  if (tok.t === 'num') return [Number(tok.v)];
  return [];
}

function applyFunc(name: string, vals: number[]): number {
  const nums = vals.filter((n) => Number.isFinite(n));
  switch (name) {
    case 'SUM':
      return nums.reduce((a, b) => a + b, 0);
    case 'AVG':
    case 'AVERAGE':
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case 'MIN':
      return nums.length ? Math.min(...nums) : 0;
    case 'MAX':
      return nums.length ? Math.max(...nums) : 0;
    case 'COUNT':
      return nums.length;
    case 'PRODUCT':
      return nums.reduce((a, b) => a * b, 1);
    default:
      throw new Error(`Unknown func ${name}`);
  }
}

// Recursive-descent arithmetic over the token stream, with function calls.
function evalExpr(toks: Tok[], data: SheetData, seen: Set<string>): number {
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      const rhs = parseTerm();
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = next().v;
      const rhs = parseFactor();
      v = op === '*' ? v * rhs : v / rhs;
    }
    return v;
  }
  function parseFactor(): number {
    const tok = peek();
    if (!tok) throw new Error('unexpected end');
    if (tok.t === 'op' && tok.v === '-') {
      next();
      return -parseFactor();
    }
    if (tok.t === 'num') {
      next();
      return Number(tok.v);
    }
    if (tok.t === 'ref') {
      next();
      return refValue(data, tok.v, seen);
    }
    if (tok.t === 'range') {
      // A bare range outside a function sums it (spreadsheet-friendly default).
      next();
      return applyFunc('SUM', argValues(tok, data, seen));
    }
    if (tok.t === 'func') {
      const name = next().v;
      if (!peek() || peek().v !== '(') throw new Error('expected (');
      next(); // (
      const args: number[] = [];
      while (peek() && peek().v !== ')') {
        const a = peek();
        if (a.t === 'range' || a.t === 'ref' || a.t === 'num') {
          args.push(...argValues(next(), data, seen));
        } else if (a.t === 'comma') {
          next();
        } else {
          // Nested arithmetic arg, e.g. SUM(A1*2, B1).
          args.push(parseExpr());
        }
      }
      if (!peek()) throw new Error('expected )');
      next(); // )
      return applyFunc(name, args);
    }
    if (tok.t === 'paren' && tok.v === '(') {
      next();
      const v = parseExpr();
      if (peek() && peek().v === ')') next();
      return v;
    }
    throw new Error(`unexpected token ${tok.v}`);
  }

  const result = parseExpr();
  return result;
}

/** The conditional-formatting color for a cell's numeric result, or null (last matching rule wins). */
export function condFormatColor(data: SheetData, result: CellResult): string | null {
  if (result.error || typeof result.value !== 'number' || !data.cf) return null;
  const n = result.value;
  let color: string | null = null;
  for (const rule of data.cf) {
    const hit =
      (rule.op === 'gt' && n > rule.value) ||
      (rule.op === 'lt' && n < rule.value) ||
      (rule.op === 'gte' && n >= rule.value) ||
      (rule.op === 'lte' && n <= rule.value) ||
      (rule.op === 'eq' && n === rule.value) ||
      (rule.op === 'ne' && n !== rule.value);
    if (hit) color = rule.color;
  }
  return color;
}
