import { describe, expect, it } from 'vitest';
import { extractPlainText } from './text';
import { DocBlock } from './editor';

describe('extractPlainText', () => {
  it('joins inline text and reference labels across nested blocks', () => {
    const doc: DocBlock[] = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'hello' } as never, { type: 'reference', props: { blockId: 'x', label: 'Alice' } }],
        children: [{ type: 'paragraph', content: [{ type: 'text', text: 'world' } as never] }],
      },
    ];
    expect(extractPlainText(doc)).toBe('hello Alice world');
  });

  it('extracts table cell text without throwing (non-array content)', () => {
    const doc = [
      {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [
            { cells: [[{ type: 'text', text: 'Name' }], [{ type: 'text', text: 'Rolle' }]] },
            { cells: [[{ type: 'text', text: 'Patrick' }], [{ type: 'text', text: 'Admin' }]] },
          ],
        },
      },
    ] as unknown as DocBlock[];
    expect(() => extractPlainText(doc)).not.toThrow();
    expect(extractPlainText(doc)).toBe('Name Rolle Patrick Admin');
  });

  it('tolerates content:none / undefined content', () => {
    const doc = [{ type: 'image' }, { type: 'divider', content: undefined }] as unknown as DocBlock[];
    expect(extractPlainText(doc)).toBe('');
  });
});
