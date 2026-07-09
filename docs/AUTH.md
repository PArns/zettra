# Authentication & identity — Better Auth integration

Zettra is moving from the built-in email+password JWT flow to **[Better Auth](https://better-auth.com)**
as the identity foundation. Better Auth is TypeScript-native, self-hosted, runs in-process, and
brings the capabilities we want out of the box:

- **Email + password** and **social login** — Google & Apple (more providers are one config line each).
- The **admin plugin** — user management + **impersonation**: create / list / ban / set-role /
  impersonate users.
- The **organization plugin** — workspaces with members, invitations, and roles (maps onto our
  tenant / space / membership model).

Because there is **no existing installation or data**, this is a clean adoption — no data
migration, and the legacy flow will be removed once the cutover is verified.

> **Runtime note.** Better Auth is ESM-only; the NestJS server is CommonJS. The server tsconfig
> uses `module`/`moduleResolution: node16`, and Better Auth is loaded via dynamic `import()`
> (`src/modules/auth/better-auth.ts`). Runtime is **Node 24**.

## Status — what is wired (behind a flag)

Delivered and building green, gated by `AUTH_PROVIDER` (default `legacy`, so the default boot path
is unchanged and verified):

- `src/config/configuration.ts` — `auth` config: provider flag, secret, base URL, trusted origins,
  Google/Apple credentials (each activates only when both id + secret are set).
- `src/modules/auth/better-auth.ts` — the Better Auth instance (pg pool on `DATABASE_URL`,
  email+password, gated social providers, `admin()` + `organization()` plugins).
- `src/modules/auth/better-auth.mount.ts` — mounts the handler at `/api/auth/*` as an encapsulated
  Fastify plugin (raw-body passthrough scoped to auth routes; NestJS JSON parsing stays intact).
- `main.ts` mounts it only when `AUTH_PROVIDER=better-auth`.
- `.env.example` — the new auth variables; Node 24 base images.

## Remaining phases

1. **RequestContext bridge.** Resolve the acting principal from a Better Auth session instead of a
   Bearer JWT: map the active **organization → `tenantId`** and **user → `userId`**, then reuse
   `PermissionsService.visibleSpaceIds` (invariant 11 unchanged — every read stays
   permission-scoped). Swap `AuthGuard` to read the session; keep the `RequestContext` shape.
2. **Client sign-in/up.** Add the Better Auth React client, replace the custom auth calls, and add
   **Google / Apple** buttons on the login page (already designed).
3. **Admin console.** A client admin area backed by the admin plugin: list/search users, create,
   ban/unban, set role, **impersonate**; plus create / delete spaces. Gate it behind an
   `admin`-role check.
4. **Welcome page & space templates.** First-run welcome, and seed newly created spaces from a
   template (starter note + example supertags/views).
5. **Cutover.** Set `AUTH_PROVIDER=better-auth`, run `npx @better-auth/cli migrate` (creates
   Better Auth's tables from `DATABASE_URL`), then delete the legacy JWT auth
   (`auth.service.ts`/`auth.controller.ts` JWT paths, `AuthGuard` JWT branch).

## Operator setup (your environment)

Live verification needs a database + real credentials — it cannot be exercised in the build sandbox.

1. `AUTH_PROVIDER=better-auth`, set `BETTER_AUTH_SECRET` (`openssl rand -hex 32`) and
   `BETTER_AUTH_URL` (your public `…/api/auth`).
2. `npx @better-auth/cli migrate` against `DATABASE_URL`.
3. **Google:** create an OAuth client (Google Cloud Console → Credentials), authorized redirect
   `…/api/auth/callback/google`; set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. **Apple:** requires a paid Apple Developer account and a "Sign in with Apple" key; the client
   secret is a signed JWT. Set `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`, redirect
   `…/api/auth/callback/apple`.
