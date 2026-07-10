import { useEffect, useState } from 'react';
import type { BlockDto } from '@zettra/shared';
import { api } from '../lib/api';
import { blockPreview, blockTitle } from '../lib/blocks';
import { absoluteTime, relativeTime } from '../lib/time';
import { clickable } from '../lib/a11y';
import { noteDragProps } from '../lib/dnd';
import { useT } from '../i18n';

/**
 * A folder's contents (§8.2): the notes filed into it. Notes stay draggable so they can be
 * moved to another folder, un-filed (drop on the Briefkasten), or removed from this folder.
 */
export function FolderPane({
  folderId,
  refreshKey,
  onOpen,
  onDelete,
  onRemoveFromFolder,
}: {
  folderId: string;
  /** Bump to force a re-fetch after a note is filed in / removed elsewhere. */
  refreshKey: number;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRemoveFromFolder: (id: string) => void;
}) {
  const t = useT();
  const [blocks, setBlocks] = useState<BlockDto[] | null>(null);

  useEffect(() => {
    let alive = true;
    setBlocks(null);
    api
      .folderNotes(folderId)
      .then((b) => alive && setBlocks(b))
      .catch(() => alive && setBlocks([]));
    return () => {
      alive = false;
    };
  }, [folderId, refreshKey]);

  if (blocks === null) return <div className="empty">…</div>;
  if (blocks.length === 0) {
    return (
      <div className="empty">
        <div className="big">📁</div>
        {t('folder.emptyPane')}
      </div>
    );
  }
  return (
    <div className="inbox-list">
      {blocks.map((b) => (
        <div
          key={b.id}
          className="card clickable inbox-item"
          {...noteDragProps(b.id)}
          {...clickable(() => onOpen(b.id))}
        >
          <div className="title">{blockTitle(b)}</div>
          <div className="preview">{blockPreview(b) || t('inbox.emptyNote')}</div>
          <div className="meta">
            <span className="source-pill">{b.source}</span>
            <span>·</span>
            <span title={absoluteTime(b.createdAt)}>{relativeTime(b.createdAt)}</span>
          </div>
          <button
            className="card-delete"
            aria-label={t('folder.removeFromFolder')}
            title={t('folder.removeFromFolder')}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFromFolder(b.id);
            }}
          >
            ⤴
          </button>
          <button
            className="card-delete"
            aria-label={t('note.delete')}
            title={t('note.delete')}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(b.id);
            }}
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}
