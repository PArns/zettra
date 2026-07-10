import { useEffect, useRef, useState } from 'react';
import type { BlockDto } from '@zettra/shared';
import { api } from '../lib/api';
import { useToast } from './Toast';
import { useT } from '../i18n';

/** BlockNote content for an uploaded file, chosen by mime type. */
function fileContent(url: string, file: File): unknown {
  if (file.type.startsWith('image/')) return [{ type: 'image', props: { url } }];
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name))
    return [{ type: 'pdf', props: { url, name: file.name } }];
  if (file.type.startsWith('audio/')) return [{ type: 'audio', props: { url } }];
  if (file.type.startsWith('video/')) return [{ type: 'video', props: { url } }];
  return [{ type: 'file', props: { url, name: file.name } }];
}

/** A drag carrying OS files (not just text/HTML) — the only kind we intercept. */
function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

/**
 * App-wide file drop (§8.3). Dropping files INTO an open note is handled by the editor
 * (BlockNote inserts at the cursor, and calls `preventDefault`). This layer covers everywhere
 * ELSE in the window — sidebar, lists, title bar, empty space — where the browser's default is
 * to navigate away and open the raw file. It:
 *   1. `preventDefault`s drags/drops so the browser never leaves the app, and
 *   2. captures files dropped outside the editor into the Briefkasten.
 * A full-window overlay makes "drop anywhere" discoverable. Drops the editor already handled
 * (`e.defaultPrevented`) are ignored so a note drop is never double-captured.
 */
export function GlobalDropLayer({
  spaceId,
  onCaptured,
}: {
  spaceId: string | undefined;
  onCaptured: (block: BlockDto) => void;
}) {
  const toast = useToast();
  const t = useT();
  const [over, setOver] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // Enables the drop AND stops the browser opening the file.
    };
    const onDragEnter = (e: DragEvent) => {
      if (hasFiles(e)) setOver(true);
    };
    const onDragLeave = (e: DragEvent) => {
      // relatedTarget null ⇒ the pointer left the window entirely.
      if (e.relatedTarget === null) setOver(false);
    };
    const onDrop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      setOver(false);
      // The editor (or the inline DropZone) already claimed this drop on itself.
      if (e.defaultPrevented) return;
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length || busyRef.current) return;
      if (!spaceId) {
        toast.error('No space available to capture into.');
        return;
      }
      busyRef.current = true;
      let count = 0;
      try {
        for (const file of files) {
          const url = await api.upload(file);
          const block = await api.createBlock({
            spaceId,
            content: fileContent(url, file),
            source: 'upload',
            sourceRef: url,
          });
          onCaptured(block);
          count++;
        }
        if (count) toast.success(`Captured ${count} file${count > 1 ? 's' : ''} — auto-tagging…`);
      } catch (err) {
        toast.error(`Upload failed: ${(err as Error).message}`);
      } finally {
        busyRef.current = false;
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [spaceId, onCaptured, toast]);

  if (!over) return null;
  // pointer-events:none so the drop still reaches the real target underneath (e.g. the editor).
  return (
    <div className="global-drop-overlay" aria-hidden>
      <div className="global-drop-card">
        <div className="global-drop-glyph">📎</div>
        <div className="global-drop-title">{t('drop.title')}</div>
        <div className="global-drop-hint">{t('drop.hint')}</div>
      </div>
    </div>
  );
}
