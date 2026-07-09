/**
 * Conditional formatting for the formula table. Pure rule evaluation: given a resolved cell and
 * a set of rules, pick the tone of the first matching rule. Kept separate from rendering so the
 * matching logic is unit-testable.
 */
import type { CellResult } from './formula';

export type CondOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'between';
export type CondTone = 'green' | 'amber' | 'red' | 'blue' | 'accent';

export interface CondRule {
  op: CondOp;
  /** Comparison operand — a number for numeric ops, a string for `contains`/`eq` on text. */
  value: number | string;
  /** Upper bound for `between` (inclusive). */
  value2?: number;
  /** Restrict the rule to one column (0-based). Omit to apply to every column. */
  column?: number;
  tone: CondTone;
}

function num(v: number | string): number {
  return typeof v === 'number' ? v : Number(v);
}

/** Does a rule match a resolved cell? Numeric ops need a numeric cell; text ops use the display. */
export function matchesRule(cell: CellResult, rule: CondRule): boolean {
  if (cell.error) return false;
  if (rule.op === 'contains') {
    return cell.display.toLowerCase().includes(String(rule.value).toLowerCase());
  }
  if (rule.op === 'eq' && typeof rule.value === 'string') {
    return cell.display.toLowerCase() === rule.value.toLowerCase();
  }
  if (cell.value == null) return false;
  const v = cell.value;
  switch (rule.op) {
    case 'gt':
      return v > num(rule.value);
    case 'gte':
      return v >= num(rule.value);
    case 'lt':
      return v < num(rule.value);
    case 'lte':
      return v <= num(rule.value);
    case 'eq':
      return v === num(rule.value);
    case 'neq':
      return v !== num(rule.value);
    case 'between':
      return v >= num(rule.value) && v <= (rule.value2 ?? num(rule.value));
    default:
      return false;
  }
}

/** The tone for a cell: the first matching rule scoped to this column (or all columns), else null. */
export function cellTone(cell: CellResult, colIndex: number, rules: CondRule[]): CondTone | null {
  for (const rule of rules) {
    if (rule.column != null && rule.column !== colIndex) continue;
    if (matchesRule(cell, rule)) return rule.tone;
  }
  return null;
}
