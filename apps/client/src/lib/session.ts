import { setToken } from './api';

/**
 * Multi-workspace sessions (§2). A person may have an account (same email) in several
 * workspaces; email-first login returns one signed session per matching workspace. We keep them
 * all in localStorage so the sidebar switcher can flip between workspaces without re-login, and
 * remember the last-active one across reloads. The API token (`api.setToken`) always mirrors the
 * active session.
 */
export interface WorkspaceSession {
  tenantId: string;
  tenantName: string;
  accessToken: string;
  email: string;
}

const SESSIONS_KEY = 'zettra.sessions';
const LAST_KEY = 'zettra.lastTenant';

export function getSessions(): WorkspaceSession[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw as WorkspaceSession[]) : [];
  } catch {
    return [];
  }
}

function save(list: WorkspaceSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
}

export function getLastTenantId(): string | null {
  return localStorage.getItem(LAST_KEY);
}

/** The active session (last-used if still present, else the first, else none). */
export function activeSession(): WorkspaceSession | null {
  const list = getSessions();
  const last = getLastTenantId();
  return list.find((s) => s.tenantId === last) ?? list[0] ?? null;
}

/** Add or replace a session and make it active (mirrors the token + records last-used). */
export function activate(session: WorkspaceSession): void {
  const list = getSessions().filter((s) => s.tenantId !== session.tenantId);
  list.unshift(session);
  save(list);
  localStorage.setItem(LAST_KEY, session.tenantId);
  setToken(session.accessToken);
}

/** Switch to an already-stored workspace. Returns false if it isn't stored. */
export function switchTo(tenantId: string): boolean {
  const s = getSessions().find((x) => x.tenantId === tenantId);
  if (!s) return false;
  localStorage.setItem(LAST_KEY, tenantId);
  setToken(s.accessToken);
  return true;
}

/** Sign out of one workspace; returns the next active session (or null if none remain). */
export function removeSession(tenantId: string): WorkspaceSession | null {
  const list = getSessions().filter((s) => s.tenantId !== tenantId);
  save(list);
  const next = list[0] ?? null;
  if (next) {
    localStorage.setItem(LAST_KEY, next.tenantId);
    setToken(next.accessToken);
  } else {
    localStorage.removeItem(LAST_KEY);
    setToken(null);
  }
  return next;
}

/** Sign out of every workspace. */
export function clearSessions(): void {
  localStorage.removeItem(SESSIONS_KEY);
  localStorage.removeItem(LAST_KEY);
  setToken(null);
}

/** Stable accent color for a workspace icon, derived from its tenant id. */
export function workspaceAccent(tenantId: string): string {
  let h = 0;
  for (let i = 0; i < tenantId.length; i++) h = (h * 31 + tenantId.charCodeAt(i)) % 360;
  return `hsl(${h} 62% 46%)`;
}

/** The single-letter glyph shown in a workspace icon. */
export function workspaceInitial(name: string): string {
  return (name.trim()[0] ?? 'W').toUpperCase();
}
