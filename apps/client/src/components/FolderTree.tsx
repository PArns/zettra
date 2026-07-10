import { useState, type DragEvent } from 'react';
import { buildTagTree, type FolderDto, type TagTreeNode } from '@zettra/shared';
import { clickable } from '../lib/a11y';
import { NOTE_DND_TYPE } from '../lib/dnd';
import { useT } from '../i18n';

/**
 * The note-organization folder tree (§8.2). Renders `folder.parentId` as a collapsible tree.
 * Two drop interactions share the tree:
 *   • drag a folder onto another folder → re-parent (server rejects cycles), or onto the header
 *     → move to the root;
 *   • drag a NOTE (from a list) onto a folder → file it there so it leaves the Briefkasten.
 * Clicking a folder opens its contents. Hover reveals add-subfolder / rename / delete.
 */
export function FolderTree({
  folders,
  activeFolderId,
  onOpen,
  onReparent,
  onFileNote,
  onCreateChild,
  onRename,
  onDelete,
}: {
  folders: FolderDto[];
  activeFolderId: string | null;
  onOpen: (folder: FolderDto) => void;
  onReparent: (folderId: string, parentId: string | null) => void;
  onFileNote: (blockId: string, folderId: string | null) => void;
  onCreateChild: (parentId: string) => void;
  onRename: (folder: FolderDto) => void;
  onDelete: (folder: FolderDto) => void;
}) {
  const tree = buildTagTree(folders);
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

  const drop = (e: DragEvent, folderId: string | null) => {
    const noteId = e.dataTransfer.getData(NOTE_DND_TYPE);
    if (noteId) onFileNote(noteId, folderId);
    else if (dragId && dragId !== folderId) onReparent(dragId, folderId);
    setDragId(null);
    setOverId(null);
  };

  const renderNode = (node: TagTreeNode<FolderDto>) => {
    const folder = node.tag;
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(folder.id);
    const isActive = folder.id === activeFolderId;
    return (
      <div key={folder.id}>
        <div
          className={`nav-item tag-node ${isActive ? 'active' : ''} ${overId === folder.id ? 'drop-target' : ''}`}
          style={{ paddingLeft: 10 + node.depth * 14 }}
          draggable
          onDragStart={(e) => {
            setDragId(folder.id);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverId(folder.id);
          }}
          onDragLeave={() => setOverId((o) => (o === folder.id ? null : o))}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            drop(e, folder.id);
          }}
          {...clickable(() => {
            if (hasChildren) toggle(folder.id);
            onOpen(folder);
          })}
        >
          <button
            className="tag-caret"
            aria-label={isCollapsed ? t('common.expand') : t('common.collapse')}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
            onClick={(e) => {
              e.stopPropagation();
              toggle(folder.id);
            }}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
          <span className="emoji">📁</span>
          <span className="tag-name">{folder.name}</span>
          <button
            className="tag-edit"
            aria-label={t('folder.addChild')}
            title={t('folder.addChild')}
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(folder.id);
            }}
          >
            +
          </button>
          <button
            className="tag-edit"
            aria-label={`${t('common.edit')} ${folder.name}`}
            title={t('common.edit')}
            onClick={(e) => {
              e.stopPropagation();
              onRename(folder);
            }}
          >
            ✎
          </button>
          <button
            className="tag-edit"
            aria-label={`${t('common.delete')} ${folder.name}`}
            title={t('common.delete')}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(folder);
            }}
          >
            🗑
          </button>
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
      onDrop={(e) => drop(e, null)}
    >
      {tree.length === 0 && (
        <div className="nav-item" style={{ opacity: 0.6, paddingLeft: 10 }}>
          {t('folder.empty')}
        </div>
      )}
      {tree.map(renderNode)}
    </div>
  );
}
