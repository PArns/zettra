import { describe, it, expect } from 'vitest';
import {
  colToIndex,
  condFormatColor,
  emptySheet,
  evalCell,
  expandRange,
  indexToCol,
  parseRef,
  type SheetData,
} from './spreadsheet';

describe('spreadsheet references', () => {
  it('maps column indices to letters and back', () => {
    expect(indexToCol(0)).toBe('A');
    expect(indexToCol(25)).toBe('Z');
    expect(indexToCol(26)).toBe('AA');
    expect(colToIndex('A')).toBe(0);
    expect(colToIndex('Z')).toBe(25);
    expect(colToIndex('AA')).toBe(26);
  });

  it('parses A1 refs', () => {
    expect(parseRef('B3')).toEqual({ col: 1, row: 2 });
    expect(parseRef('nope')).toBeNull();
  });

  it('expands rectangular ranges', () => {
    expect(expandRange('A1:B2')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });
});

function sheet(cells: Record<string, string>): SheetData {
  return { ...emptySheet(5, 5), cells };
}

describe('formula evaluation', () => {
  it('returns literal values (numeric when parseable)', () => {
    expect(evalCell(sheet({ A1: '42' }), 'A1').value).toBe(42);
    expect(evalCell(sheet({ A1: 'hello' }), 'A1').value).toBe('hello');
    expect(evalCell(sheet({ A1: '149 EUR' }), 'A1').value).toBe(149);
  });

  it('evaluates SUM/AVG/MIN/MAX/COUNT over ranges', () => {
    const s = sheet({ A1: '10', A2: '20', A3: '30' });
    expect(evalCell(s, 'B1', new Set()).value).toBe('');
    expect(evalCell({ ...s, cells: { ...s.cells, B1: '=SUM(A1:A3)' } }, 'B1').value).toBe(60);
    expect(evalCell({ ...s, cells: { ...s.cells, B1: '=AVG(A1:A3)' } }, 'B1').value).toBe(20);
    expect(evalCell({ ...s, cells: { ...s.cells, B1: '=MIN(A1:A3)' } }, 'B1').value).toBe(10);
    expect(evalCell({ ...s, cells: { ...s.cells, B1: '=MAX(A1:A3)' } }, 'B1').value).toBe(30);
    expect(evalCell({ ...s, cells: { ...s.cells, B1: '=COUNT(A1:A3)' } }, 'B1').value).toBe(3);
  });

  it('evaluates arithmetic with cell refs and precedence', () => {
    const s = sheet({ A1: '2', A2: '3', A3: '=A1+A2*4' });
    expect(evalCell(s, 'A3').value).toBe(14);
  });

  it('chains formulas that reference other formulas', () => {
    const s = sheet({ A1: '5', A2: '=A1*2', A3: '=A2+1' });
    expect(evalCell(s, 'A3').value).toBe(11);
  });

  it('detects circular references', () => {
    const s = sheet({ A1: '=A2', A2: '=A1' });
    const res = evalCell(s, 'A1');
    expect(res.error).toBe(true);
    expect(res.value).toBe('#CYCLE');
  });
});

describe('conditional formatting', () => {
  it('applies the last matching rule', () => {
    const data: SheetData = {
      ...emptySheet(),
      cf: [
        { op: 'gt', value: 100, color: 'red' },
        { op: 'gt', value: 200, color: 'green' },
      ],
    };
    expect(condFormatColor(data, { value: 50, error: false })).toBeNull();
    expect(condFormatColor(data, { value: 150, error: false })).toBe('red');
    expect(condFormatColor(data, { value: 250, error: false })).toBe('green');
  });
});
