import { useState } from 'react';
import { buildTagTree, type TagTreeNode } from '@zettra/shared';
import type { Tag, View } from '../lib/api';
import { clickable } from '../lib/a11y';
import { useT } from '../i18n';

/**
 * Hierarchical tag/folder tree (§8.1). Renders `tag.parentId` as a collapsible tree; clicking a
 * tag opens its saved view when one exists. Tags can be dragged onto one another to re-parent
 * (or onto the section header to move to the root) — the server rejects cycles.
 */
export function TagTree({
  tags,
  views,
  activeViewId,
  onOpenView,
  onReparent,
  onEdit,
}: {
  tags: Tag[];
  views: View[];
  activeViewId: string | null;
  onOpenView: (view: View) => void;
  onReparent: (tagId: string, parentId: string | null) => void;
  onEdit?: (tag: Tag) => void;
}) {
  const tree = buildTagTree(tags);
  const t = useT();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const drop = (parentId: string | null) => {
    if (dragId && dragId !== parentId) onReparent(dragId, parentId);
    setDragId(null);
    setOverId(null);
  };

  const renderNode = (node: TagTreeNode<Tag>) => {
    const tag = node.tag;
    const view = views.find((v) => v.tagId === tag.id);
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(tag.id);
    const isActive = view != null && view.id === activeViewId;
    return (
      <div key={tag.id}>
        <div
          className={`nav-item tag-node ${isActive ? 'active' : ''} ${overId === tag.id ? 'drop-target' : ''}`}
          style={{ paddingLeft: 10 + node.depth * 14 }}
          draggable
          onDragStart={() => setDragId(tag.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverId(tag.id);
          }}
          onDragLeave={() => setOverId((o) => (o === tag.id ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            drop(tag.id);
          }}
          {...clickable(() => {
            if (view) onOpenView(view);
            else if (hasChildren) toggle(tag.id);
          })}
        >
          <button
            className="tag-caret"
            aria-label={isCollapsed ? t('common.expand') : t('common.collapse')}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
            onClick={(e) => {
              e.stopPropagation();
              toggle(tag.id);
            }}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
          <span className="emoji">{tag.icon ?? '#'}</span>
          <span className="tag-name">{tag.name}</span>
          {onEdit && (
            <button
              className="tag-edit"
              aria-label={`${t('common.edit')} ${tag.name}`}
              title={t('supertag.editTitle')}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(tag);
              }}
            >
              ✎
            </button>
          )}
        </div>
        {hasChildren && !isCollapsed && node.children.map(renderNode)}
      </div>
    );
  };

  return (
    <div
      className={`tag-tree ${overId === '__root__' ? 'drop-target' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOverId('__root__');
      }}
      onDrop={() => drop(null)}
    >
      {tree.length === 0 && (
        <div className="nav-item" style={{ opacity: 0.6 }}>
          {t('nav.noTags')}
        </div>
      )}
      {tree.map(renderNode)}
    </div>
  );
}
