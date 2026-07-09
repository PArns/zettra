import { useEffect, useRef, useState } from 'react';
import { api, type Tag } from '../lib/api';
import { useT } from '../i18n';
import { useToast } from './Toast';
import { clickable } from '../lib/a11y';

/** Apply a supertag to the open block (§8.1). Applying enqueues field backfill server-side. */
export function ApplyTagMenu({ blockId, onApplied }: { blockId: string; onApplied?: () => void }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const t = useT();

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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  async function apply(tag: Tag) {
    setOpen(false);
    try {
      await api.applyTag(tag.id, blockId);
      toast.success(`Tagged as #${tag.name}`);
      onApplied?.();
    } catch (err) {
      toast.error(`Could not apply #${tag.name}: ${(err as Error).message}`);
    }
  }

  return (
    <div className="menu" ref={ref}>
      <button className="ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        🏷️ {t('review.addSupertag')}
      </button>
      {open && (
        <div className="menu-list">
          {tags.map((tag) => (
            <div key={tag.id} className="m-item" {...clickable(() => apply(tag))}>
              <span>{tag.icon ?? '#'}</span> {tag.name}
            </div>
          ))}
          {tags.length === 0 && <div className="m-item">{t('review.noSupertags')}</div>}
        </div>
      )}
    </div>
  );
}
