import { useEffect, useRef, useState } from 'react';
import {
  activeSession,
  getSessions,
  switchTo,
  workspaceAccent,
  workspaceInitial,
} from '../lib/session';
import { useT } from '../i18n';

/**
 * Left-sidebar workspace switcher (§2). Shows the active workspace with a colored icon; the
 * dropdown lists every signed-in workspace to switch to (a reload re-inits data under the new
 * token) and offers "New workspace" to add another account without losing the current ones.
 *
 * Closes via a document `mousedown` outside-click listener (the shared idiom — see
 * NotificationsBell/SearchBox), not a fixed backdrop overlay: a full-screen backdrop paints over
 * the trigger and races its click, which made the menu feel like it needed a double-click to open
 * and wouldn't close cleanly.
 */
export function WorkspaceSwitcher({ onAddWorkspace }: { onAddWorkspace: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sessions = getSessions();
  const active = activeSession();
  const name = active?.tenantName ?? 'Zettra';
  const id = active?.tenantId ?? 'zettra';

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (tenantId: string) => {
    if (tenantId !== active?.tenantId && switchTo(tenantId)) {
      window.location.reload();
    } else {
      setOpen(false);
    }
  };

  return (
    <div className="ws-switch" ref={ref}>
      <button className="ws-current" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="ws-ico" style={{ background: workspaceAccent(id) }}>
          {workspaceInitial(name)}
        </span>
        <span className="ws-name">{name}</span>
        <span className="ws-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="ws-menu" role="menu">
          {sessions.map((s) => (
            <button
              key={s.tenantId}
              className={`ws-item ${s.tenantId === active?.tenantId ? 'on' : ''}`}
              role="menuitem"
              onClick={() => pick(s.tenantId)}
            >
              <span className="ws-ico" style={{ background: workspaceAccent(s.tenantId) }}>
                {workspaceInitial(s.tenantName)}
              </span>
              <span className="ws-name">{s.tenantName}</span>
              {s.tenantId === active?.tenantId && (
                <span className="ws-check" aria-hidden>
                  ✓
                </span>
              )}
            </button>
          ))}
          <button
            className="ws-item ws-add"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onAddWorkspace();
            }}
          >
            <span className="ws-ico ws-ico-add" aria-hidden>
              ＋
            </span>
            <span className="ws-name">{t('workspace.new')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
