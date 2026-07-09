/**
 * Tag hierarchy (folder/tree). `tag.parentId` is an *organizational* parent — distinct from
 * `tag.extendsId`, which is supertag field inheritance (§8.1). A tag can extend one supertag
 * for its fields while living anywhere in the folder tree.
 *
 * `buildTagTree` is a pure, cycle-safe projection of the flat tag list into a nested tree,
 * used by the sidebar. A tag whose parent is missing or would form a cycle is treated as a
 * root, so a corrupt `parentId` never hides a tag or loops forever.
 */

export interface TagNodeInput {
  id: string;
  name: string;
  parentId: string | null;
  icon?: string | null;
  color?: string | null;
}

/** Minimal shape the cycle check needs — an id and a self-referential parent pointer. */
export interface CycleNode {
  id: string;
  parentId: string | null;
}

export interface TagTreeNode<T extends TagNodeInput = TagNodeInput> {
  tag: T;
  children: TagTreeNode<T>[];
  depth: number;
}

/**
 * Would setting `parentId` as `tagId`'s parent create a cycle (or self-parent)? Works on any
 * self-referential pointer (the folder `parentId` tree or the `extendsId` inheritance chain),
 * so it guards both without duplication.
 */
export function wouldCycle<T extends CycleNode>(
  tags: T[],
  tagId: string,
  parentId: string | null,
): boolean {
  if (!parentId) return false;
  if (parentId === tagId) return true;
  const byId = new Map(tags.map((t) => [t.id, t]));
  const seen = new Set<string>();
  let cur: string | null = parentId;
  while (cur) {
    if (cur === tagId) return true; // parent chain leads back to the tag → cycle
    if (seen.has(cur)) return false; // pre-existing cycle elsewhere; not our concern
    seen.add(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

/** Does following `parentId` from `tag` eventually revisit `tag` (a pre-existing cycle)? */
function inCycle<T extends TagNodeInput>(byId: Map<string, T>, tag: T): boolean {
  const seen = new Set<string>([tag.id]);
  let cur = tag.parentId;
  while (cur) {
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

export function buildTagTree<T extends TagNodeInput>(tags: T[]): TagTreeNode<T>[] {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const nodes = new Map<string, TagTreeNode<T>>(
    tags.map((t) => [t.id, { tag: t, children: [], depth: 0 }]),
  );
  const roots: TagTreeNode<T>[] = [];

  for (const t of tags) {
    const node = nodes.get(t.id)!;
    const parent = t.parentId ? nodes.get(t.parentId) : undefined;
    // Attach to parent only when the parent exists and no cycle is involved.
    if (parent && t.parentId && byId.has(t.parentId) && !inCycle(byId, t)) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const byName = (a: TagTreeNode<T>, b: TagTreeNode<T>) => a.tag.name.localeCompare(b.tag.name);
  const assignDepth = (node: TagTreeNode<T>, depth: number): void => {
    node.depth = depth;
    node.children.sort(byName);
    for (const c of node.children) assignDepth(c, depth + 1);
  };
  roots.sort(byName);
  for (const r of roots) assignDepth(r, 0);
  return roots;
}
