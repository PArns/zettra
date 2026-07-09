import { describe, expect, it } from 'vitest';
import { safeJobId } from './queue.service';

describe('safeJobId (BullMQ v5 forbids ":" in custom job ids)', () => {
  it('replaces every colon with an underscore', () => {
    expect(safeJobId('embed:abc')).toBe('embed_abc');
    expect(safeJobId('backfill:block1:tag2')).toBe('backfill_block1_tag2');
  });

  it('leaves colon-free keys untouched (debounce stays stable)', () => {
    expect(safeJobId('embed_abc')).toBe('embed_abc');
    expect(safeJobId('plainkey')).toBe('plainkey');
  });

  it('is deterministic — same key maps to the same id', () => {
    expect(safeJobId('embed:x')).toBe(safeJobId('embed:x'));
  });
});
