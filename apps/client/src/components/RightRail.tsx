import { useEffect, useState } from 'react';
import { api, type BacklinkResult, type RelatedResult } from '../lib/api';
import { blockTitle } from '../lib/blocks';

/**
 * Contextual right rail for the open block: live "Related" (soft connections, §8.4) and
 * backlinks (hard edges). Both are permission-scoped server-side.
 */
export function RightRail({ blockId, onOpen }: { blockId: string; onOpen: (id: string) => void }) {
  const [related, setRelated] = useState<RelatedResult[] | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkResult[] | null>(null);

  useEffect(() => {
    let live = true;
    setRelated(null);
    setBacklinks(null);
    api
      .related(blockId)
      .then((r) => live && setRelated(r))
      .catch(() => live && setRelated([]));
    api
      .backlinks(blockId)
      .then((b) => live && setBacklinks(b))
      .catch(() => live && setBacklinks([]));
    return () => {
      live = false;
    };
  }, [blockId]);

  return (
    <div className="rail">
      <h3>Related</h3>
      {related === null && <div className="spinner" />}
      {related?.length === 0 && (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: '4px' }}>
          Nothing similar yet.
        </p>
      )}
      {related?.map((r) => (
        <div
          key={r.blockId}
          className="card clickable"
          style={{ marginBottom: 8 }}
          onClick={() => onOpen(r.blockId)}
        >
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.preview || 'Untitled'}</div>
          <div
            className="meta"
            style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <span className="badge">
              <span className="dot" />
              {(1 - r.distance).toFixed(2)} match
            </span>
          </div>
        </div>
      ))}

      <h3>Backlinks</h3>
      {backlinks === null && <div className="spinner" />}
      {backlinks?.length === 0 && (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: '4px' }}>No backlinks.</p>
      )}
      {backlinks?.map((b) => (
        <div
          key={b.block.id}
          className="card clickable"
          style={{ marginBottom: 8 }}
          onClick={() => onOpen(b.block.id)}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>{blockTitle(b.block)}</div>
          <div className="meta" style={{ marginTop: 4 }}>
            <span className="source-pill">{b.kind}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
