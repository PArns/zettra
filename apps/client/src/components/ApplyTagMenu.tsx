import { useEffect, useRef, useState } from 'react';
import { api, type Tag } from '../lib/api';

/** Apply a supertag to the open block (§8.1). Applying enqueues field backfill server-side. */
export function ApplyTagMenu({ blockId, onApplied }: { blockId: string; onApplied?: () => void }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .tags()
      .then(setTags)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function apply(tag: Tag) {
    setOpen(false);
    await api.applyTag(tag.id, blockId).catch(() => undefined);
    onApplied?.();
  }

  return (
    <div className="menu" ref={ref}>
      <button className="ghost" onClick={() => setOpen((o) => !o)}>
        🏷️ Add supertag
      </button>
      {open && (
        <div className="menu-list">
          {tags.map((t) => (
            <div key={t.id} className="m-item" onClick={() => apply(t)}>
              <span>{t.icon ?? '#'}</span> {t.name}
            </div>
          ))}
          {tags.length === 0 && <div className="m-item">No supertags</div>}
        </div>
      )}
    </div>
  );
}
