import type { BlockDto } from '@zettra/shared';
import { api } from '../lib/api';
import { blockPreview, blockTitle } from '../lib/blocks';
import { absoluteTime, relativeTime } from '../lib/time';
import { clickable } from '../lib/a11y';
import { ApplyTagMenu } from './ApplyTagMenu';
import { EmptyState, Button } from '../ui';
import { useToast } from './Toast';

/**
 * The "For Review" bucket (§8.3): captures the auto-tagger couldn't confidently classify.
 * Triage each one by applying a supertag (which resolves it) or marking it reviewed as-is.
 */
export function ForReviewPane({
  blocks,
  onOpen,
  onResolved,
}: {
  blocks: BlockDto[];
  onOpen: (id: string) => void;
  onResolved: () => void;
}) {
  const toast = useToast();

  async function markReviewed(id: string) {
    try {
      await api.markReviewed(id);
      onResolved();
    } catch (err) {
      toast.error(`Could not update: ${(err as Error).message}`);
    }
  }

  if (blocks.length === 0) {
    return (
      <EmptyState
        glyph="🗂️"
        title="Nothing to review"
        hint="Captures the AI couldn't confidently tag land here for a quick human decision."
      />
    );
  }

  return (
    <div className="inbox-list">
      {blocks.map((b) => (
        <div key={b.id} className="card review-card">
          <div {...clickable(() => onOpen(b.id))} style={{ cursor: 'pointer' }}>
            <div className="title">{blockTitle(b)}</div>
            <div className="preview">{blockPreview(b) || 'Empty note'}</div>
            <div className="meta">
              <span className="source-pill">{b.source}</span>
              <span>·</span>
              <span title={absoluteTime(b.createdAt)}>{relativeTime(b.createdAt)}</span>
            </div>
          </div>
          <div className="review-card-actions">
            <ApplyTagMenu blockId={b.id} onApplied={onResolved} />
            <Button variant="ghost" size="sm" onClick={() => markReviewed(b.id)}>
              ✓ Mark reviewed
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
