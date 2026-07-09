import type { BlockDto } from '@zettra/shared';
import { blockPreview, blockTitle } from '../lib/blocks';
import { absoluteTime, relativeTime } from '../lib/time';
import { clickable } from '../lib/a11y';
import { useT } from '../i18n';

/** The Briefkasten (§8.2): freshly captured, untagged, owned-by-me blocks. */
export function InboxPane({
  blocks,
  onOpen,
}: {
  blocks: BlockDto[];
  onOpen: (id: string) => void;
}) {
  const t = useT();
  if (blocks.length === 0) {
    return (
      <div className="empty">
        <div className="big">📥</div>
        {t('inbox.emptyTitle')}
        <div className="hint">{t('inbox.emptyHint')}</div>
      </div>
    );
  }
  return (
    <div className="inbox-list">
      {blocks.map((b) => (
        <div key={b.id} className="card clickable inbox-item" {...clickable(() => onOpen(b.id))}>
          <div className="title">{blockTitle(b)}</div>
          <div className="preview">{blockPreview(b) || t('inbox.emptyNote')}</div>
          <div className="meta">
            <span className="source-pill">{b.source}</span>
            <span>·</span>
            <span title={absoluteTime(b.createdAt)}>{relativeTime(b.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
