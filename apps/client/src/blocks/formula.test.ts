import { describe, expect, it } from 'vitest';
import {
  columnToIndex,
  evaluateGrid,
  evaluateWorkbook,
  indexToColumn,
  type Grid,
  type Sheets,
} from './formula';

describe('column <-> index', () => {
  it('maps letters to zero-based indices and back', () => {
    expect(columnToIndex('A')).toBe(0);
    expect(columnToIndex('Z')).toBe(25);
    expect(columnToIndex('AA')).toBe(26);
    expect(indexToColumn(0)).toBe('A');
    expect(indexToColumn(25)).toBe('Z');
    expect(indexToColumn(26)).toBe('AA');
  });
});

describe('evaluateGrid', () => {
  it('passes through literals and parses numbers', () => {
    const g: Grid = [['hello', '42']];
    const r = evaluateGrid(g);
    expect(r[0][0]).toEqual({ display: 'hello', value: null });
    expect(r[0][1]).toEqual({ display: '42', value: 42 });
  });

  it('evaluates arithmetic with precedence and parentheses', () => {
    const g: Grid = [['=1+2*3', '=(1+2)*3', '=-4 + 10/2']];
    const r = evaluateGrid(g);
    expect(r[0][0].value).toBe(7);
    expect(r[0][1].value).toBe(9);
    expect(r[0][2].value).toBe(1);
  });

  it('resolves cell references and chained references', () => {
    const g: Grid = [
      ['10', '20'],
      ['=A1+B1', '=A2*2'],
    ];
    const r = evaluateGrid(g);
    expect(r[1][0].value).toBe(30);
    expect(r[1][1].value).toBe(60);
  });

  it('supports SUM/AVG/MIN/MAX/COUNT over ranges', () => {
    const g: Grid = [['1'], ['2'], ['3'], ['4'], ['=SUM(A1:A4)'], ['=AVG(A1:A4)'], ['=MAX(A1:A4)']];
    const r = evaluateGrid(g);
    expect(r[4][0].value).toBe(10);
    expect(r[5][0].value).toBe(2.5);
    expect(r[6][0].value).toBe(4);
  });

  it('formats integers plainly and decimals to 2 places', () => {
    const g: Grid = [['=10/4', '=8/2']];
    const r = evaluateGrid(g);
    expect(r[0][0].display).toBe('2.50');
    expect(r[0][1].display).toBe('4');
  });

  it('flags circular references instead of hanging', () => {
    const g: Grid = [['=B1', '=A1']];
    const r = evaluateGrid(g);
    expect(r[0][0].display).toBe('#ERR');
    expect(r[0][0].error).toMatch(/circular/i);
  });

  it('reports unknown functions as errors', () => {
    const g: Grid = [['=BOGUS(1,2)']];
    const r = evaluateGrid(g);
    expect(r[0][0].display).toBe('#ERR');
  });
});

describe('cross-sheet references', () => {
  it('reads a cell from another sheet with Sheet!A1', () => {
    const sheets: Sheets = {
      Sales: [['100'], ['200'], ['=SUM(A1:A2)']],
      Summary: [['=Sales!A3', '=Sales!A3 * 1.2']],
    };
    const r = evaluateWorkbook(sheets);
    expect(r.Sales[2][0].value).toBe(300);
    expect(r.Summary[0][0].value).toBe(300);
    expect(r.Summary[0][1].value).toBeCloseTo(360);
  });

  it('supports cross-sheet ranges inside functions', () => {
    const sheets: Sheets = {
      Data: [['1'], ['2'], ['3']],
      Roll: [['=SUM(Data!A1:A3)']],
    };
    expect(evaluateWorkbook(sheets).Roll[0][0].value).toBe(6);
  });

  it('detects cross-sheet circular references', () => {
    const sheets: Sheets = { A: [['=B!A1']], B: [['=A!A1']] };
    const r = evaluateWorkbook(sheets);
    expect(r.A[0][0].display).toBe('#ERR');
    expect(r.A[0][0].error).toMatch(/circular/i);
  });
});

describe('ROLLUP', () => {
  it('aggregates a linked field via the injected resolver', () => {
    const sheets: Sheets = { S: [['=ROLLUP("Task", "amount", "sum")']] };
    const r = evaluateWorkbook(sheets, {
      rollup: (name, field, agg) =>
        name === 'Task' && field === 'amount' && agg === 'sum' ? 42 : null,
    });
    expect(r.S[0][0].value).toBe(42);
  });

  it('errors when no resolver is supplied', () => {
    const sheets: Sheets = { S: [['=ROLLUP("Task", "amount")']] };
    expect(evaluateWorkbook(sheets).S[0][0].display).toBe('#ERR');
  });
});
