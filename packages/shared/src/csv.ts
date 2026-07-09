import { DocBlock } from './editor';

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes (`""`), and CRLF/LF.
 * Pure and unit-tested. Good enough to turn a dropped `.csv` into a table block.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty trailing rows.
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

/**
 * Convert CSV text into a BlockNote table block (§4). The shape matches BlockNote's `tableContent`
 * so the collab server's blocksToYDoc rebuilds it into an editable table. Ragged rows are padded
 * to the widest row. Empty input yields an empty paragraph.
 */
export function csvToTableDoc(text: string): DocBlock[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [{ type: 'paragraph', content: [] }];
  const cols = Math.max(...rows.map((r) => r.length));
  const table = {
    type: 'table',
    content: {
      type: 'tableContent',
      columnWidths: Array.from({ length: cols }, () => undefined),
      rows: rows.map((cells) => ({
        cells: Array.from({ length: cols }, (_, j) => [
          { type: 'text', text: cells[j] ?? '', styles: {} },
        ]),
      })),
    },
  };
  return [table as unknown as DocBlock];
}
