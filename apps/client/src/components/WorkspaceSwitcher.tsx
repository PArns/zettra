import { useState } from 'react';
import {
  activeSession,
  getSessions,
  switchTo,
  workspaceAccent,
  workspaceInitial,
} from '../lib/session';

/**
 * Left-sidebar workspace switcher (§2). Shows the active workspace with a colored icon; the
 * dropdown lists every signed-in workspace to switch to (a reload re-inits data under the new
 * token) and offers "New workspace" to add another account without losing the current ones.
 */
export function WorkspaceSwitcher({ onAddWorkspace }: { onAddWorkspace: () => void }) {
  const [open, setOpen] = useState(false);
  const sessions = getSessions();
  const active = activeSession();
  const name = active?.tenantName ?? 'Zettra';
  const id = active?.tenantId ?? 'zettra';

  const pick = (tenantId: string) => {
    if (tenantId !== active?.tenantId && switchTo(tenantId)) {
      window.location.reload();
    } else {
      setOpen(false);
    }
  };

  return (
    <div className="ws-switch">
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
        <>
          <div className="ws-backdrop" onClick={() => setOpen(false)} aria-hidden />
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
              <span className="ws-name">New workspace</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
