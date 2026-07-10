import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from './Toast';

const EMOJIS = [
  '📝', '📄', '📌', '✅', '⭐', '🔥', '💡', '🚀', '🎯', '📅', '📊', '📈',
  '💰', '🧾', '🏷️', '📁', '🔖', '👤', '🏠', '🌐', '✈️', '🍎', '☕', '🎉',
  '❤️', '⚡', '🔒', '🧠', '🛠️', '🐛', '📷', '🎵', '🗂️', '💬', '❓', '✏️',
];

/**
 * Notion-style page header (§4): an optional cover image with an emoji icon overlaid, above the
 * note title (the editor's first line). Cover + icon persist as block metadata via
 * `PUT /blocks/:id/header`. Hovering the header reveals "add cover / add icon"; the icon opens an
 * emoji picker, the cover a file upload.
 */
export function NoteHeader({ blockId }: { blockId: string }) {
  const toast = useToast();
  const [icon, setIcon] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    setIcon(null);
    setCover(null);
    setPicker(false);
    api
      .block(blockId)
      .then((b) => {
        if (!live) return;
        setIcon(b.icon ?? null);
        setCover(b.coverImageUrl ?? null);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [blockId]);

  const save = async (patch: { icon?: string | null; coverImageUrl?: string | null }) => {
    try {
      await api.setNoteHeader(blockId, patch);
    } catch (err) {
      toast.error(`Header konnte nicht gespeichert werden: ${(err as Error).message}`);
    }
  };

  const pickIcon = (e: string) => {
    setIcon(e);
    setPicker(false);
    void save({ icon: e });
  };

  const uploadCover = async (file: File) => {
    try {
      const url = await api.upload(file);
      setCover(url);
      void save({ coverImageUrl: url });
    } catch (err) {
      toast.error(`Cover-Upload fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  return (
    <div className={`note-header ${cover ? 'has-cover' : ''}`}>
      {cover && (
        <div className="note-cover" style={{ backgroundImage: `url("${cover}")` }}>
          <div className="note-cover-actions">
            <button onClick={() => fileRef.current?.click()}>Cover ändern</button>
            <button
              onClick={() => {
                setCover(null);
                void save({ coverImageUrl: null });
              }}
            >
              Entfernen
            </button>
          </div>
        </div>
      )}

      <div className="note-header-bar">
        <div className="note-icon-wrap">
          {icon ? (
            <button className="note-icon" onClick={() => setPicker((p) => !p)} title="Icon ändern">
              {icon}
            </button>
          ) : null}
          {picker && (
            <div className="note-emoji-pop">
              {EMOJIS.map((e) => (
                <button key={e} className="note-emoji" onClick={() => pickIcon(e)}>
                  {e}
                </button>
              ))}
              {icon && (
                <button
                  className="note-emoji note-emoji-clear"
                  onClick={() => {
                    setIcon(null);
                    setPicker(false);
                    void save({ icon: null });
                  }}
                  title="Icon entfernen"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        <div className="note-header-add">
          {!icon && (
            <button onClick={() => setPicker(true)}>
              <span aria-hidden>😀</span> Icon hinzufügen
            </button>
          )}
          {!cover && (
            <button onClick={() => fileRef.current?.click()}>
              <span aria-hidden>🖼</span> Cover hinzufügen
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadCover(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
