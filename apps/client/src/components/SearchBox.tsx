import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { clickable } from '../lib/a11y';

interface Hit {
  blockId: string;
  score: number;
  preview: string;
}

/** Topbar hybrid-search box (§11): debounced query → dense+FTS results dropdown. */
export function SearchBox({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setHits(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          setHits(r);
          setOpen(true);
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
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
        aria-label="Search all notes"
        placeholder="Search everything…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits && setOpen(true)}
      />
      {open && (
        <div className="menu-list" style={{ width: 360, left: 'auto', right: 0 }}>
          {loading && <div className="m-item">Searching…</div>}
          {!loading && hits && hits.length === 0 && <div className="m-item">No matches.</div>}
          {!loading &&
            hits?.map((h) => (
              <div key={h.blockId} className="m-item" {...clickable(() => select(h.blockId))}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {h.preview || 'Untitled'}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
