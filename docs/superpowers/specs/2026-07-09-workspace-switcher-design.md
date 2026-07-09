# Workspace selection & switcher — design

**Date:** 2026-07-09
**Status:** approved (design), pending implementation

## Problem

Login requires typing the tenant UUID (`workspaceId` field, placeholder `uuid`) because a
`User` belongs to exactly one tenant and email is only unique *within* a tenant
(`@Index(['tenantId','email'], unique)`). There is no way to switch workspaces without
re-entering a UUID. Users want: (1) no UUID entry, (2) switch between workspaces from the
right-hand bar, (3) return to the last-used workspace automatically.

## Design (email-first login + client-side multi-session switcher)

No data-model rebuild. A `User` stays per-tenant; the same email+password may exist in several
tenants as separate accounts, and the client holds one session (token) per workspace.

### Backend

- `POST /auth/login` accepts **`{ email, password }`** (tenantId removed/optional). It finds every
  `User` with that email, verifies the password against each, and returns the matches:
  `{ sessions: [{ tenantId, tenantName, accessToken }] }` (empty ⇒ 401).
- **Security:** workspaces are revealed **only after a correct password** — no pre-auth
  enumeration of which email lives in which workspace. Password verification is per candidate
  with the same bcrypt path as today.
- Register is unchanged (creator is admin).
- Backwards-compat: keep accepting an optional `tenantId` to scope to one workspace if supplied.

### Frontend

- **Login form** (`Auth.tsx`): drop the UUID field; email + password only. On submit:
  one session → sign in directly; multiple → show a **workspace picker** (clickable cards).
- **Session store** (`lib/api.ts` / a small `lib/session.ts`): persist an array of
  `{ tenantId, tenantName, accessToken }` plus `lastTenantId` in localStorage. The active token
  (what `getToken()` returns) is the session for `lastTenantId`.
- **Right-bar switcher** (`RightRail.tsx`, top): list stored workspaces, highlight the active one,
  click to switch → set `lastTenantId`, swap the active token, re-load data. A "＋ Add workspace"
  entry opens the login form to add another session; sign-out removes the active session (and
  falls back to another, or the login screen if none remain).
- **Remember last:** on app load, activate the session for `lastTenantId` if its token is still
  valid; otherwise fall back to the login screen.

## Testing

- **Backend (unit):** `login({email,password})` returns all-and-only the workspaces whose password
  matches; returns 401/empty for a wrong password; does not leak workspaces on a wrong password.
- **Frontend (unit):** session-store helpers (add/switch/remove/lastTenantId resolution) as pure
  functions over a mock storage; picker shows when >1 session.

## Out of scope (YAGNI)

- A single global identity spanning all tenants (one login → membership in many workspaces). That
  is a larger data-model change (global user + tenant memberships) and belongs in its own project.
- Workspace slugs.

## Alternatives considered

- **Workspace slug instead of UUID:** still requires typing/knowing the slug — only half-solves it.
- **Client-only "recent workspaces" without email-first login:** the *first* login into a new
  workspace would still need the UUID.
