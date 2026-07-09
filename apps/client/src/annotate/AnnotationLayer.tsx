import { useEffect, useRef, useState } from 'react';
import {
  clearAnnotations,
  cssPath,
  elementLabel,
  exportMarkdown,
  listAnnotations,
  removeAnnotation,
  saveAnnotation,
  type Annotation,
} from './store';
import { isAdminEnabled, setAdmin } from './admin';

type Mode = 'off' | 'picking';

/**
 * Admin-only design annotation overlay (impeccable-style live iteration). Toggle it on, click any
 * element to drop a pin and leave a note, then "Copy for agent" to hand the notes to the coding
 * agent. Renders nothing unless admin mode is enabled, so it never reaches end users.
 */
export function AnnotationLayer() {
  const enabled = isAdminEnabled();
  const path = window.location.pathname + window.location.search;
  const [mode, setMode] = useState<Mode>('off');
  const [items, setItems] = useState<Annotation[]>(() => (enabled ? listAnnotations(path) : []));
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [open, setOpen] = useState(false);
  const uiRef = useRef<HTMLDivElement>(null);

  const refresh = () => setItems(listAnnotations(path));

  useEffect(() => {
    if (mode !== 'picking') return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || uiRef.current?.contains(target)) return;
      e.preventDefault();
      e.stopPropagation();
      const a: Annotation = {
        id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        selector: cssPath(target),
        label: elementLabel(target),
        x: e.clientX,
        y: e.clientY,
        path,
        note: '',
        resolved: false,
        createdAt: Date.now(),
      };
      setDraft(a);
      setMode('off');
    };
    document.addEventListener('click', onClick, true);
    document.body.style.cursor = 'crosshair';
    return () => {
      document.removeEventListener('click', onClick, true);
      document.body.style.cursor = '';
    };
  }, [mode, path]);

  if (!enabled) return null;

  const commitDraft = (note: string) => {
    if (draft && note.trim()) {
      saveAnnotation({ ...draft, note: note.trim() });
      refresh();
    }
    setDraft(null);
  };

  const copyForAgent = () => {
    void navigator.clipboard?.writeText(exportMarkdown(path));
  };

  const open_ = items.filter((a) => !a.resolved);

  return (
    <div ref={uiRef} className="anno-root">
      {/* Existing pins */}
      {items.map((a, i) => (
        <button
          key={a.id}
          className={`anno-pin ${a.resolved ? 'resolved' : ''}`}
          style={{ left: a.x, top: a.y }}
          title={`${a.label}\n${a.note}`}
          onClick={() => setOpen(true)}
        >
          {i + 1}
        </button>
      ))}

      {/* Draft note editor near the click point */}
      {draft && (
        <div
          className="anno-draft"
          style={{ left: Math.min(draft.x, window.innerWidth - 280), top: draft.y + 12 }}
        >
          <div className="anno-draft-label">{draft.label}</div>
          <textarea
            autoFocus
            placeholder="What should change here?"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
                commitDraft((e.target as HTMLTextAreaElement).value);
              if (e.key === 'Escape') setDraft(null);
            }}
            id="anno-draft-input"
          />
          <div className="anno-draft-actions">
            <button className="ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() =>
                commitDraft(
                  (document.getElementById('anno-draft-input') as HTMLTextAreaElement).value,
                )
              }
            >
              Add note
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="anno-bar">
        <button
          className={`anno-toggle ${mode === 'picking' ? 'on' : ''}`}
          onClick={() => setMode(mode === 'picking' ? 'off' : 'picking')}
          title="Annotate a UI element"
        >
          ✦ {mode === 'picking' ? 'Click an element…' : 'Annotate'}
        </button>
        {open_.length > 0 && (
          <button className="anno-count" onClick={() => setOpen((o) => !o)}>
            {open_.length}
          </button>
        )}
        <button
          className="anno-close"
          title="Exit admin mode"
          onClick={() => {
            setAdmin(false);
            window.location.reload();
          }}
        >
          ✕
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div className="anno-panel">
          <div className="anno-panel-head">
            <span>Annotations ({items.length})</span>
            <button className="ghost" onClick={copyForAgent}>
              Copy for agent
            </button>
          </div>
          <div className="anno-list">
            {items.length === 0 && <div className="anno-empty">No annotations yet.</div>}
            {items.map((a, i) => (
              <div key={a.id} className={`anno-item ${a.resolved ? 'resolved' : ''}`}>
                <div className="anno-item-head">
                  <span className="anno-badge">{i + 1}</span>
                  <span className="anno-item-label">{a.label}</span>
                </div>
                <div className="anno-item-note">{a.note}</div>
                <div className="anno-item-actions">
                  <button
                    className="ghost"
                    onClick={() => {
                      saveAnnotation({ ...a, resolved: !a.resolved });
                      refresh();
                    }}
                  >
                    {a.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      removeAnnotation(path, a.id);
                      refresh();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <div className="anno-panel-foot">
              <button
                className="ghost"
                onClick={() => {
                  clearAnnotations(path);
                  refresh();
                }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
