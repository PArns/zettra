import { useState } from 'react';
import type { WorkspaceSessionDto } from '@zettra/shared';
import { api } from '../lib/api';
import { activate, workspaceAccent, workspaceInitial } from '../lib/session';
import { useT } from '../i18n';
import { Button, Field, Input, ThemeSwitcher } from '../ui';

/**
 * Register/login gate (§2). Registration provisions a whole seeded tenant (§8.2). Login is
 * email-first: no workspace UUID — the server returns every workspace the credentials unlock,
 * and if there is more than one we show a picker.
 */
export function Auth({ onAuthed }: { onAuthed: () => void }) {
  const t = useT();
  const HIGHLIGHTS = [
    { glyph: '🧠', title: t('auth.h1t'), body: t('auth.h1b') },
    { glyph: '🔗', title: t('auth.h2t'), body: t('auth.h2b') },
    { glyph: '⚡', title: t('auth.h3t'), body: t('auth.h3b') },
    { glyph: '🔒', title: t('auth.h4t'), body: t('auth.h4b') },
  ];
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [tenantName, setTenantName] = useState('My Second Brain');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // When a login unlocks more than one workspace, offer a picker instead of auto-entering one.
  const [picker, setPicker] = useState<WorkspaceSessionDto[] | null>(null);

  function choose(s: WorkspaceSessionDto): void {
    activate({
      tenantId: s.tenantId,
      tenantName: s.tenantName,
      accessToken: s.accessToken,
      email: s.user.email,
    });
    onAuthed();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') {
        const res = await api.register({ tenantName, email, password });
        activate({ tenantId: res.user.tenantId, tenantName, accessToken: res.accessToken, email });
        onAuthed();
        return;
      }
      const { sessions } = await api.login({ email, password });
      if (sessions.length === 1) choose(sessions[0]);
      else setPicker(sessions);
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
        style={{ background: 'linear-gradient(150deg, #0e7490 0%, #0891b2 42%, #2563eb 100%)' }}
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #22d3ee, transparent 70%)' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }}
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
            {t('auth.heroTitle')}
          </h1>
          <p className="mt-4 max-w-md text-white/80">{t('auth.heroSub')}</p>
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

        <div className="relative text-sm text-white/60">{t('auth.openSource')}</div>
      </aside>

      {/* Form panel */}
      <main className="relative flex items-center justify-center bg-bg px-6 py-12">
        <div className="absolute right-5 top-5">
          <ThemeSwitcher />
        </div>
        {picker ? (
          <div className="w-full max-w-sm">
            <h2 className="text-2xl font-bold tracking-tight text-text">Choose a workspace</h2>
            <p className="mb-6 mt-1 text-sm text-muted">{email}</p>
            <div className="flex flex-col gap-2">
              {picker.map((s) => (
                <button
                  key={s.tenantId}
                  type="button"
                  onClick={() => choose(s)}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent"
                >
                  <span
                    className="grid h-8 w-8 flex-none place-items-center rounded-lg text-sm font-bold text-white"
                    style={{ background: workspaceAccent(s.tenantId) }}
                  >
                    {workspaceInitial(s.tenantName)}
                  </span>
                  <span className="font-semibold text-text">{s.tenantName}</span>
                </button>
              ))}
            </div>
            <Button variant="ghost" block className="mt-4" onClick={() => setPicker(null)}>
              ← Back
            </Button>
          </div>
        ) : (
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
            {mode === 'register' ? t('auth.createTitle') : t('auth.welcomeTitle')}
          </h2>
          <p className="mb-6 mt-1 text-sm text-muted">
            {mode === 'register' ? t('auth.createSub') : t('auth.signinSub')}
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
              {t('auth.tabCreate')}
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
              {t('auth.tabSignin')}
            </button>
          </div>

          {mode === 'register' && (
            <Field label={t('auth.workspaceName')} htmlFor="auth-tenant-name">
              {(id) => (
                <Input
                  id={id}
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
              )}
            </Field>
          )}
          <Field label={t('auth.email')} htmlFor="auth-email">
            {(id) => (
              <Input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            )}
          </Field>
          <Field label={t('auth.password')} htmlFor="auth-password">
            {(id) => (
              <Input
                id={id}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordHint')}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
            )}
          </Field>

          <Button variant="primary" size="lg" block type="submit" disabled={busy} className="mt-2">
            {busy
              ? t('auth.pleaseWait')
              : mode === 'register'
                ? t('auth.createWorkspace')
                : t('auth.tabSignin')}
          </Button>
          {error && (
            <p className="mt-3 text-sm text-red" role="alert">
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-xs text-faint">{t('auth.agree')}</p>
          </form>
        )}
      </main>
    </div>
  );
}
