import { useEffect, useState } from 'react';
import { api, type ReviewEdge } from '../lib/api';

/**
 * The suggested-link review queue (§8.5). Confirm/dismiss feed the dismiss-rate-per-bucket
 * calibration signal (§11).
 */
export function ReviewQueue({ onChange }: { onChange: () => void }) {
  const [edges, setEdges] = useState<ReviewEdge[] | null>(null);

  const load = () =>
    api
      .review()
      .then(setEdges)
      .catch(() => setEdges([]));
  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, confirm: boolean) {
    if (confirm) await api.confirmReview(id);
    else await api.dismissReview(id);
    await load();
    onChange();
  }

  if (!edges)
    return (
      <div className="empty">
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  if (edges.length === 0) {
    return (
      <div className="empty">
        <div className="big">✨</div>
        No suggested connections to review.
        <div className="hint">As you capture notes, Zettra proposes typed relations here.</div>
      </div>
    );
  }

  return (
    <div className="inbox-list">
      {edges.map((e) => (
        <div key={e.id} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>
              {e.sourceId.slice(0, 8)} → {e.targetId.slice(0, 8)}
            </div>
            <span className="badge">
              <span className="dot" />
              {e.confidence !== null ? `${(e.confidence * 100).toFixed(0)}%` : 'n/a'}
            </span>
          </div>
          <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
            <button className="ghost" onClick={() => act(e.id, false)}>
              Dismiss
            </button>
            <button className="primary" onClick={() => act(e.id, true)}>
              Confirm
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
