import { Pool } from 'pg';
import { loadConfig } from '../../config/configuration';

/**
 * Build the Better Auth instance. Better Auth ships ESM-only, so this CommonJS server loads it
 * via dynamic `import()` (the server tsconfig uses node16 resolution to preserve it). The type is
 * inferred from the concrete options so the admin/organization plugin surface stays intact.
 *
 * Better Auth owns identity and its own tables (user/session/account/verification/organization):
 * - email + password,
 * - Google & Apple social login (enabled only when their credentials are configured),
 * - the **admin** plugin — user management + impersonation (create/list/ban/set-role/impersonate),
 * - the **organization** plugin — workspaces with members, invitations, and roles.
 *
 * Run `npx @better-auth/cli migrate` against DATABASE_URL to create its tables (no app migration
 * needed). Only reached when AUTH_PROVIDER=better-auth.
 */
async function buildAuth() {
  const cfg = loadConfig();
  const { betterAuth } = await import('better-auth');
  const { admin, organization } = await import('better-auth/plugins');

  return betterAuth({
    database: new Pool({ connectionString: cfg.databaseUrl }),
    secret: cfg.auth.secret,
    baseURL: cfg.auth.baseURL,
    trustedOrigins: cfg.auth.trustedOrigins,
    emailAndPassword: { enabled: true },
    socialProviders: {
      ...(cfg.auth.google ? { google: cfg.auth.google } : {}),
      ...(cfg.auth.apple ? { apple: cfg.auth.apple } : {}),
    },
    plugins: [admin(), organization()],
  });
}

/** The constructed Better Auth instance type (inferred — Better Auth is ESM-only). */
export type AuthInstance = Awaited<ReturnType<typeof buildAuth>>;

let cached: AuthInstance | null = null;

/** Lazily construct and memoize the Better Auth instance. */
export async function getAuth(): Promise<AuthInstance> {
  if (!cached) cached = await buildAuth();
  return cached;
}
