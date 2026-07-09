import { describe, expect, it } from 'vitest';
import { csvToTableDoc, parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsv('name,note\n"Smith, Jr.","say ""hi"""')).toEqual([
      ['name', 'note'],
      ['Smith, Jr.', 'say "hi"'],
    ]);
  });

  it('handles CRLF and trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('csvToTableDoc', () => {
  it('builds a table block matching BlockNote tableContent', () => {
    const [block] = csvToTableDoc('a,b\n1,2') as unknown as Array<{
      type: string;
      content: { type: string; columnWidths: unknown[]; rows: { cells: unknown[][] }[] };
    }>;
    expect(block.type).toBe('table');
    expect(block.content.type).toBe('tableContent');
    expect(block.content.columnWidths).toHaveLength(2);
    expect(block.content.rows).toHaveLength(2);
    expect(block.content.rows[0].cells[0]).toEqual([{ type: 'text', text: 'a', styles: {} }]);
  });

  it('pads ragged rows to the widest', () => {
    const [block] = csvToTableDoc('a,b,c\n1') as unknown as Array<{
      content: { rows: { cells: unknown[][] }[] };
    }>;
    expect(block.content.rows[1].cells).toHaveLength(3);
  });

  it('empty input yields an empty paragraph', () => {
    expect(csvToTableDoc('')).toEqual([{ type: 'paragraph', content: [] }]);
  });
});
