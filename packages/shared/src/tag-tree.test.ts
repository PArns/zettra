import { describe, expect, it } from 'vitest';
import { buildTagTree, wouldCycle, type TagNodeInput } from './tag-tree';

const t = (id: string, parentId: string | null, name = id): TagNodeInput => ({
  id,
  parentId,
  name,
});

describe('buildTagTree', () => {
  it('nests children under parents and sorts alphabetically', () => {
    const tree = buildTagTree([t('b', null, 'Beta'), t('a', null, 'Alpha'), t('a1', 'a', 'Child')]);
    expect(tree.map((n) => n.tag.id)).toEqual(['a', 'b']); // sorted by name
    expect(tree[0].children.map((n) => n.tag.id)).toEqual(['a1']);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[0].depth).toBe(1);
  });

  it('treats a tag with a missing parent as a root', () => {
    const tree = buildTagTree([t('x', 'ghost')]);
    expect(tree.map((n) => n.tag.id)).toEqual(['x']);
  });

  it('does not loop on a cycle — cyclic tags fall back to roots', () => {
    // a → b → a. buildTagTree must terminate and surface both.
    const tree = buildTagTree([t('a', 'b'), t('b', 'a')]);
    const ids = tree.map((n) => n.tag.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('handles a deep chain', () => {
    const tree = buildTagTree([t('a', null), t('b', 'a'), t('c', 'b'), t('d', 'c')]);
    let node = tree[0];
    for (let depth = 0; depth < 4; depth++) {
      expect(node.depth).toBe(depth);
      node = node.children[0];
    }
  });
});

describe('wouldCycle', () => {
  const tags = [t('a', null), t('b', 'a'), t('c', 'b')];

  it('rejects self-parenting', () => {
    expect(wouldCycle(tags, 'a', 'a')).toBe(true);
  });

  it('rejects moving a tag under its own descendant', () => {
    // Making a a child of c (c → b → a) would loop.
    expect(wouldCycle(tags, 'a', 'c')).toBe(true);
  });

  it('allows a safe re-parent', () => {
    expect(wouldCycle(tags, 'c', 'a')).toBe(false);
    expect(wouldCycle(tags, 'b', null)).toBe(false);
  });
});
