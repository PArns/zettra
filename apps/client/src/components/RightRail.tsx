import { useEffect, useState } from 'react';
import { api, type BacklinkResult, type RelatedResult, type RelationBacklink } from '../lib/api';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import { blockTitle } from '../lib/blocks';
import { clickable } from '../lib/a11y';
import { FieldsPanel } from './FieldsPanel';

function matchLabel(distance: number, t: (key: StringKey) => string): string {
  const score = 1 - distance;
  if (score >= 0.85) return t('rail.strongMatch');
  if (score >= 0.6) return t('rail.relatedMatch');
  return t('rail.looselyRelated');
}

/**
 * Contextual right rail for the open block: live "Related" (soft connections, §8.4) and
 * backlinks (hard edges). Both are permission-scoped server-side.
 */
export function RightRail({ blockId, onOpen }: { blockId: string; onOpen: (id: string) => void }) {
  const t = useT();
  const [related, setRelated] = useState<RelatedResult[] | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkResult[] | null>(null);
  const [refBy, setRefBy] = useState<RelationBacklink[] | null>(null);

  useEffect(() => {
    let live = true;
    setRelated(null);
    setBacklinks(null);
    setRefBy(null);
    api
      .related(blockId)
      .then((r) => live && setRelated(r))
      .catch(() => live && setRelated([]));
    api
      .backlinks(blockId)
      .then((b) => live && setBacklinks(b))
      .catch(() => live && setBacklinks([]));
    api
      .relationBacklinks(blockId)
      .then((r) => live && setRefBy(r))
      .catch(() => live && setRefBy([]));
    return () => {
      live = false;
    };
  }, [blockId]);

  return (
    <div className="rail">
      <FieldsPanel blockId={blockId} />
      <h3>{t('rail.related')}</h3>
      {related === null && <div className="spinner" />}
      {related?.length === 0 && (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: '4px' }}>
          {t('rail.nothingSimilar')}
        </p>
      )}
      {related?.map((r) => (
        <div
          key={r.blockId}
          className="card clickable"
          style={{ marginBottom: 8 }}
          {...clickable(() => onOpen(r.blockId))}
        >
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {r.preview || t('common.untitled')}
          </div>
          <div
            className="meta"
            style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <span className="badge" title={`cosine distance ${r.distance.toFixed(3)}`}>
              <span className="dot" />
              {matchLabel(r.distance, t)}
            </span>
          </div>
        </div>
      ))}

      <h3>{t('rail.backlinks')}</h3>
      {backlinks === null && <div className="spinner" />}
      {backlinks?.length === 0 && (
        <p style={{ color: 'var(--text-faint)', fontSize: 13, margin: '4px' }}>
          {t('rail.noBacklinks')}
        </p>
      )}
      {backlinks?.map((b) => (
        <div
          key={b.block.id}
          className="card clickable"
          style={{ marginBottom: 8 }}
          {...clickable(() => onOpen(b.block.id))}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>{blockTitle(b.block)}</div>
          <div className="meta" style={{ marginTop: 4 }}>
            <span className="source-pill">{b.kind}</span>
          </div>
        </div>
      ))}

      {refBy && refBy.length > 0 && (
        <>
          <h3>{t('rail.referencedBy')}</h3>
          {refBy.map((r) => (
            <div
              key={`${r.block.id}:${r.fieldId}`}
              className="card clickable"
              style={{ marginBottom: 8 }}
              {...clickable(() => onOpen(r.block.id))}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{blockTitle(r.block)}</div>
              <div className="meta" style={{ marginTop: 4 }}>
                <span className="source-pill">{r.fieldName}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
