import { describe, expect, it } from 'vitest';
import { cleanOcrText, extractImageUrls, mergeSearchText, shouldOcr } from './ocr';
import type { DocBlock } from './editor';

describe('shouldOcr', () => {
  it('accepts raster images, rejects vectors/docs/unknowns', () => {
    expect(shouldOcr('a.png')).toBe(true);
    expect(shouldOcr('scan.JPEG')).toBe(true);
    expect(shouldOcr('/files/t/x.webp?sig=abc')).toBe(true);
    expect(shouldOcr('diagram.svg')).toBe(false);
    expect(shouldOcr('report.pdf')).toBe(false);
    expect(shouldOcr('note.txt')).toBe(false);
    expect(shouldOcr('no-extension')).toBe(false);
  });
});

describe('extractImageUrls', () => {
  it('collects raster image urls from blocks, children and inline, deduped', () => {
    const doc: DocBlock[] = [
      { type: 'image', props: { url: '/f/a.png?sig=1' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'hi' }] },
      {
        type: 'column',
        children: [
          { type: 'image', props: { url: '/f/b.jpg' } },
          { type: 'image', props: { url: '/f/a.png?sig=1' } }, // dup
          { type: 'file', props: { url: '/f/doc.pdf' } }, // not raster
        ],
      },
    ];
    expect(extractImageUrls(doc)).toEqual(['/f/a.png?sig=1', '/f/b.jpg']);
  });

  it('is empty for a doc without images', () => {
    expect(extractImageUrls([{ type: 'paragraph', content: [] }])).toEqual([]);
  });
});

describe('cleanOcrText', () => {
  it('collapses whitespace and drops noise-only lines', () => {
    const raw = 'Invoice   #42\n\n   \n|||\nDue: 2026-08-01  ';
    expect(cleanOcrText(raw)).toBe('Invoice #42\nDue: 2026-08-01');
  });
});

describe('mergeSearchText', () => {
  it('joins base and ocr texts, skipping empties', () => {
    expect(mergeSearchText('body', ['', 'from image', '  '])).toBe('body\n\nfrom image');
    expect(mergeSearchText('', ['only ocr'])).toBe('only ocr');
  });
});
