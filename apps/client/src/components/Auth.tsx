import { useState } from 'react';
import { api, setToken } from '../lib/api';
import { Button, Field, Input, ThemeSwitcher } from '../ui';

const HIGHLIGHTS = [
  {
    glyph: '🧠',
    title: 'Entities, not just pages',
    body: 'Every note can become a typed, queryable thing.',
  },
  {
    glyph: '🔗',
    title: 'Connections you can trust',
    body: 'Hard links are explicit; soft ones stay suggestions.',
  },
  {
    glyph: '⚡',
    title: 'Real-time & offline-first',
    body: 'Yjs keeps everyone in sync, even off the grid.',
  },
  {
    glyph: '🔒',
    title: 'Self-hosted & permission-scoped',
    body: 'Your data, your server, scoped to what you can see.',
  },
];

/** Register/login gate (§2). Registration provisions a whole seeded tenant (§8.2). */
export function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [tenantName, setTenantName] = useState('My Second Brain');
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === 'register'
          ? await api.register({ tenantName, email, password })
          : await api.login({ tenantId, email, password });
      setToken(res.accessToken);
      onAuthed();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Marketing panel */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(150deg, #4f3fd4 0%, #6d5efc 40%, #a855f7 100%)' }}
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #ec4899, transparent 70%)' }}
          aria-hidden
        />
        <div className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-lg font-extrabold backdrop-blur">
            Z
          </span>
          <span className="text-lg font-bold tracking-tight">Zettra</span>
        </div>

        <div className="relative">
          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            The second brain that thinks in connections.
          </h1>
          <p className="mt-4 max-w-md text-white/80">
            Capture anything, tag it into a typed entity, and let Zettra surface the links you’d
            never find yourself.
          </p>
          <ul className="mt-8 grid max-w-md gap-4 sm:grid-cols-2">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3">
                <span className="text-xl" aria-hidden>
                  {h.glyph}
                </span>
                <div>
                  <div className="text-sm font-semibold">{h.title}</div>
                  <div className="text-[13px] text-white/70">{h.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-sm text-white/60">
          Open source · Postgres · pgvector · Yjs
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex items-center justify-center bg-bg px-6 py-12">
        <div className="absolute right-5 top-5">
          <ThemeSwitcher />
        </div>
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-1 flex items-center gap-2 lg:hidden">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg font-extrabold text-white"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
              Z
            </span>
            <span className="text-lg font-bold text-text">Zettra</span>
          </div>

          <h2 className="mt-4 text-2xl font-bold tracking-tight text-text">
            {mode === 'register' ? 'Create your workspace' : 'Welcome back'}
          </h2>
          <p className="mb-6 mt-1 text-sm text-muted">
            {mode === 'register'
              ? 'Spin up a fresh, seeded second brain in seconds.'
              : 'Sign in to your self-hosted workspace.'}
          </p>

          <div
            className="mb-6 inline-flex rounded-full border border-border bg-surface-2 p-0.5"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => setMode('register')}
              className={
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (mode === 'register'
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-muted hover:text-text')
              }
            >
              Create account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => setMode('login')}
              className={
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ' +
                (mode === 'login' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')
              }
            >
              Sign in
            </button>
          </div>

          {mode === 'register' ? (
            <Field label="Workspace name" htmlFor="auth-tenant-name">
              {(id) => (
                <Input id={id} value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
              )}
            </Field>
          ) : (
            <Field label="Workspace ID" htmlFor="auth-tenant-id">
              {(id) => (
                <Input
                  id={id}
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="uuid"
                />
              )}
            </Field>
          )}
          <Field label="Email" htmlFor="auth-email">
            {(id) => (
              <Input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            )}
          </Field>
          <Field label="Password" htmlFor="auth-password">
            {(id) => (
              <Input
                id={id}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            )}
          </Field>

          <Button variant="primary" size="lg" block type="submit" disabled={busy} className="mt-2">
            {busy ? 'Please wait…' : mode === 'register' ? 'Create workspace' : 'Sign in'}
          </Button>
          {error && (
            <p className="mt-3 text-sm text-red" role="alert">
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-xs text-faint">
            By continuing you agree this is your data on your server.
          </p>
        </form>
      </main>
    </div>
  );
}
