import { useRef, useState } from 'react';
import type { BlockDto } from '@zettra/shared';
import { api } from '../lib/api';
import { useT } from '../i18n';
import { useToast } from './Toast';

/** BlockNote content for an uploaded file, by mime type. */
function fileContent(url: string, file: File): unknown {
  if (file.type.startsWith('image/')) return [{ type: 'image', props: { url } }];
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name))
    return [{ type: 'pdf', props: { url, name: file.name } }];
  if (file.type.startsWith('audio/')) return [{ type: 'audio', props: { url } }];
  if (file.type.startsWith('video/')) return [{ type: 'video', props: { url } }];
  return [{ type: 'file', props: { url, name: file.name } }];
}

const URL_RE = /^https?:\/\/\S+$/i;

/**
 * The drop area (§8.3): drag audio, images, files, text, or a URL here. Uploads land as
 * `source: upload` blocks and URLs/text as captures — both run the auto-tag pipeline, so
 * confident items get tagged and the rest surface in "For Review".
 */
export function DropZone({
  spaceId,
  onCaptured,
}: {
  spaceId: string | undefined;
  onCaptured: (block: BlockDto) => void;
}) {
  const toast = useToast();
  const t = useT();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ingestFile(file: File): Promise<void> {
    const url = await api.upload(file);
    const block = await api.createBlock({
      spaceId: spaceId!,
      content: fileContent(url, file),
      source: 'upload',
      sourceRef: url,
    });
    onCaptured(block);
  }

  async function ingest(items: { files: File[]; text: string }): Promise<void> {
    if (!spaceId) {
      toast.error('No space available to capture into.');
      return;
    }
    setBusy(true);
    let count = 0;
    try {
      for (const file of items.files) {
        await ingestFile(file);
        count++;
      }
      const text = items.text.trim();
      if (text) {
        const block = URL_RE.test(text)
          ? await api.capture({ text, url: text })
          : await api.capture({ text });
        onCaptured(block);
        count++;
      }
      if (count > 0) toast.success(`Captured ${count} item${count > 1 ? 's' : ''} — auto-tagging…`);
    } catch (err) {
      toast.error(`Capture failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`dropzone ${over ? 'over' : ''} ${busy ? 'busy' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void ingest({
          files: Array.from(e.dataTransfer.files),
          text: e.dataTransfer.getData('text'),
        });
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void ingest({ files, text: '' });
          e.target.value = '';
        }}
      />
      <div className="dropzone-glyph" aria-hidden>
        {busy ? '⏳' : '📎'}
      </div>
      <div className="dropzone-title">{busy ? t('drop.capturing') : t('drop.title')}</div>
      <div className="dropzone-hint">{t('drop.hint')}</div>
    </div>
  );
}
