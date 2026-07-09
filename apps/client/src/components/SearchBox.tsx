import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../i18n';
import { clickable } from '../lib/a11y';

interface Hit {
  blockId: string;
  score: number;
  preview: string;
}

/** Topbar hybrid-search box (§11): debounced query → dense+FTS results dropdown, plus an
 *  "Ask AI" affordance that hands the query to the grounded chat (§1). */
export function SearchBox({
  onOpen,
  onAskAi,
}: {
  onOpen: (id: string) => void;
  onAskAi?: (question: string) => void;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (!q.trim()) {
      setHits(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          setHits(r);
          setOpen(true);
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function select(id: string) {
    setOpen(false);
    setQ('');
    setHits(null);
    onOpen(id);
  }

  return (
    <div className="menu search-box" ref={ref}>
      <input
        aria-label={t('search.aria')}
        placeholder={t('search.placeholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits && setOpen(true)}
      />
      {open && (
        <div className="menu-list" style={{ width: 360, left: 'auto', right: 0 }}>
          {onAskAi && q.trim() && (
            <div
              className="m-item search-askai"
              {...clickable(() => {
                const question = q.trim();
                setOpen(false);
                setQ('');
                setHits(null);
                onAskAi(question);
              })}
            >
              <span className="search-askai-glyph">✦</span>
              <span>
                {t('search.askAi')} <span className="search-askai-q">“{q.trim()}”</span>
              </span>
            </div>
          )}
          {loading && <div className="m-item">{t('search.searching')}</div>}
          {!loading && hits && hits.length === 0 && (
            <div className="m-item">{t('search.noMatches')}</div>
          )}
          {!loading &&
            hits?.map((h) => (
              <div key={h.blockId} className="m-item" {...clickable(() => select(h.blockId))}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {h.preview || t('common.untitled')}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
