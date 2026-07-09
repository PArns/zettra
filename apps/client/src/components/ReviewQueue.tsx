import { useEffect, useState } from 'react';
import { api, type ReviewEdge } from '../lib/api';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import { useToast } from './Toast';

/**
 * The suggested-link review queue (§8.5). Confirm/dismiss feed the dismiss-rate-per-bucket
 * calibration signal (§11). Shows note titles (not ids) and disables buttons while acting.
 */
export function ReviewQueue({ onChange }: { onChange: () => void }) {
  const [edges, setEdges] = useState<ReviewEdge[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const t = useT();

  const load = () =>
    api
      .review()
      .then(setEdges)
      .catch(() => setEdges([]));
  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, confirm: boolean) {
    if (busy) return;
    setBusy(id);
    try {
      if (confirm) await api.confirmReview(id);
      else await api.dismissReview(id);
      await load();
      onChange();
    } catch (err) {
      toast.error(`Could not update: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
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
        {t('queue.emptyTitle')}
        <div className="hint">{t('queue.emptyHint')}</div>
      </div>
    );
  }

  return (
    <div className="inbox-list">
      {edges.map((e) => (
        <div key={e.id} className="card">
          <div className="review-pair">
            <span className="review-node">{e.source.title}</span>
            <span className="review-arrow">→</span>
            <span className="review-node">{e.target.title}</span>
          </div>
          <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
            <span className="badge" title={t('queue.confidenceTitle')}>
              <span className="dot" />
              {e.confidence !== null ? t(confidenceLabelKey(e.confidence)) : t('queue.unrated')}
            </span>
            <div className="row">
              <button className="ghost" disabled={busy === e.id} onClick={() => act(e.id, false)}>
                {t('queue.dismiss')}
              </button>
              <button className="primary" disabled={busy === e.id} onClick={() => act(e.id, true)}>
                {busy === e.id ? '…' : t('queue.confirm')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function confidenceLabelKey(c: number): StringKey {
  if (c >= 0.85) return 'rail.strongMatch';
  if (c >= 0.6) return 'queue.likelyMatch';
  return 'queue.possibleMatch';
}
