import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

interface Hit {
  blockId: string;
  score: number;
  preview: string;
}

/** Topbar hybrid-search box (§11): debounced query → dense+FTS results dropdown. */
export function SearchBox({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) {
      setHits(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          setHits(r);
          setOpen(true);
        })
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="menu search-box" ref={ref}>
      <input
        placeholder="Search everything…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits && setOpen(true)}
      />
      {open && hits && (
        <div className="menu-list" style={{ width: 360, left: 'auto', right: 0 }}>
          {hits.length === 0 && <div className="m-item">No matches.</div>}
          {hits.map((h) => (
            <div
              key={h.blockId}
              className="m-item"
              onClick={() => {
                setOpen(false);
                onOpen(h.blockId);
              }}
            >
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
