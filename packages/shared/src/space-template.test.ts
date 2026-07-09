import { describe, expect, it } from 'vitest';
import { welcomeDoc } from './space-template';
import { extractPlainText } from './text';

describe('welcomeDoc', () => {
  it('greets with the space name and lists getting-started steps', () => {
    const doc = welcomeDoc('Work');
    const text = extractPlainText(doc);
    expect(text).toContain('Welcome to Work');
    expect(text).toContain('First steps');
    expect(doc.filter((b) => b.type === 'checkListItem')).toHaveLength(4);
  });

  it('falls back to a neutral name for blank input', () => {
    expect(extractPlainText(welcomeDoc('   '))).toContain('Welcome to your space');
  });

  it('produces settled BlockNote JSON (blocks with inline text content)', () => {
    for (const block of welcomeDoc('X')) {
      expect(typeof block.type).toBe('string');
      expect(Array.isArray(block.content)).toBe(true);
    }
  });
});
