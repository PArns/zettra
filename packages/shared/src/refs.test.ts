import { describe, expect, it } from 'vitest';
import { extractRefs } from './refs';
import { DocBlock } from './editor';

describe('extractRefs', () => {
  it('collects reference and tag ids across nested inline + child blocks', () => {
    const doc: DocBlock[] = [
      {
        type: 'paragraph',
        content: [
          { type: 'text' },
          { type: 'reference', props: { blockId: 'ref-1', label: 'Alice' } },
          { type: 'tag', props: { blockId: 'tag-1', label: 'task' } },
        ],
        children: [
          {
            type: 'paragraph',
            content: [{ type: 'reference', props: { blockId: 'ref-2', label: 'Bob' } }],
          },
        ],
      },
    ];

    const { referenceIds, tagIds } = extractRefs(doc);
    expect([...referenceIds].sort()).toEqual(['ref-1', 'ref-2']);
    expect([...tagIds]).toEqual(['tag-1']);
  });

  it('ignores nodes without a blockId and unknown node types', () => {
    const doc: DocBlock[] = [
      {
        content: [
          { type: 'reference' },
          { type: 'mystery', props: { blockId: 'x', label: 'y' } },
          {
            type: 'text',
            content: [{ type: 'tag', props: { blockId: 'nested-tag', label: 't' } }],
          },
        ],
      },
    ];
    const { referenceIds, tagIds } = extractRefs(doc);
    expect(referenceIds.size).toBe(0);
    expect([...tagIds]).toEqual(['nested-tag']);
  });

  it('dedupes repeated references', () => {
    const doc: DocBlock[] = [
      { content: [{ type: 'reference', props: { blockId: 'a', label: 'A' } }] },
      { content: [{ type: 'reference', props: { blockId: 'a', label: 'A again' } }] },
    ];
    expect(extractRefs(doc).referenceIds.size).toBe(1);
  });

  it('tolerates non-array block content without throwing (table/image/math blocks)', () => {
    // Regression: a document that mixes a table block (content is an object), a `content: 'none'`
    // block (content undefined), and a normal paragraph must NOT throw — otherwise the whole
    // persist 500s and the note is lost. References in the normal blocks are still collected.
    const doc = [
      { type: 'table', content: { type: 'tableContent', rows: [] } },
      { type: 'math', content: undefined },
      { type: 'image' },
      { type: 'paragraph', content: [{ type: 'reference', props: { blockId: 'keep', label: 'K' } }] },
    ] as unknown as DocBlock[];
    let refs!: ReturnType<typeof extractRefs>;
    expect(() => (refs = extractRefs(doc))).not.toThrow();
    expect([...refs.referenceIds]).toEqual(['keep']);
  });
});
