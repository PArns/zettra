import { describe, expect, it } from 'vitest';
import type { BlockDto } from '@zettra/shared';
import { BlockSource, BlockVisibility } from '@zettra/shared';
import { blockPreview, blockTitle } from './blocks';

function makeBlock(content: unknown): BlockDto {
  return {
    id: 'b1',
    tenantId: 't1',
    spaceId: 's1',
    parentId: null,
    position: 'a0',
    content,
    source: BlockSource.Manual,
    sourceRef: null,
    visibility: BlockVisibility.Space,
    ownerUserId: 'u1',
    createdBy: 'u1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tagIds: [],
  };
}

const doc = (text: string) => [{ type: 'paragraph', content: [{ type: 'text', text }] }];

describe('blockTitle', () => {
  it('uses the first line of extracted text', () => {
    expect(blockTitle(makeBlock(doc('Buy milk and eggs')))).toBe('Buy milk and eggs');
  });

  it('truncates long titles with an ellipsis', () => {
    const long = 'x'.repeat(200);
    const title = blockTitle(makeBlock(doc(long)));
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(81);
  });

  it('falls back to "Untitled" for empty content', () => {
    expect(blockTitle(makeBlock([]))).toBe('Untitled');
    expect(blockTitle(makeBlock({}))).toBe('Untitled');
  });

  it('includes reference/tag labels in the extracted text', () => {
    const content = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Meet ' },
          { type: 'reference', props: { blockId: 'p1', label: 'Jane' } },
        ],
      },
    ];
    expect(blockTitle(makeBlock(content))).toBe('Meet Jane');
  });
});

describe('blockPreview', () => {
  it('returns up to 200 chars of plaintext', () => {
    expect(blockPreview(makeBlock(doc('hello world')))).toBe('hello world');
    expect(blockPreview(makeBlock(doc('y'.repeat(500)))).length).toBe(200);
  });
});
