import { describe, expect, it } from 'vitest';
import { MentionLinkerService } from './mention-linker.service';
import type { DocBlock } from '@zettra/shared';

const linker = new MentionLinkerService();

describe('MentionLinkerService.annotate', () => {
  it('replaces a known alias in text with a reference node', () => {
    const doc: DocBlock[] = [{ type: 'paragraph', content: [{ type: 'text', text: 'Met with Jane Doe today' }] }];
    const out = linker.annotate(doc, [{ blockId: 'p1', alias: 'Jane Doe' }]);
    const content = out[0]!.content!;
    expect(content).toEqual([
      { type: 'text', text: 'Met with ' },
      { type: 'reference', props: { blockId: 'p1', label: 'Jane Doe' } },
      { type: 'text', text: ' today' },
    ]);
  });

  it('prefers the longest alias (Jane Doe over Jane)', () => {
    const doc: DocBlock[] = [{ content: [{ type: 'text', text: 'Jane Doe called' }] }];
    const out = linker.annotate(doc, [
      { blockId: 'short', alias: 'Jane' },
      { blockId: 'long', alias: 'Jane Doe' },
    ]);
    const ref = out[0]!.content!.find((n) => n.type === 'reference');
    expect(ref?.props?.blockId).toBe('long');
  });

  it('links multiple mentions in one run', () => {
    const doc: DocBlock[] = [{ content: [{ type: 'text', text: 'Alice and Bob' }] }];
    const out = linker.annotate(doc, [
      { blockId: 'a', alias: 'Alice' },
      { blockId: 'b', alias: 'Bob' },
    ]);
    const refs = out[0]!.content!.filter((n) => n.type === 'reference');
    expect(refs.map((r) => r.props?.blockId).sort()).toEqual(['a', 'b']);
  });

  it('is a no-op with no aliases', () => {
    const doc: DocBlock[] = [{ content: [{ type: 'text', text: 'nothing here' }] }];
    expect(linker.annotate(doc, [])).toBe(doc);
  });
});
