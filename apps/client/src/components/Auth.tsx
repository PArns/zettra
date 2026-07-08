import { useState } from 'react';
import { api, setToken } from '../lib/api';

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
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">
          <span className="logo">Z</span> Zettra
        </div>
        <p className="sub">Your self-hosted second brain.</p>

        <div className="seg" role="tablist">
          <button
            type="button"
            className={mode === 'register' ? 'on' : ''}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
          <button
            type="button"
            className={mode === 'login' ? 'on' : ''}
            onClick={() => setMode('login')}
          >
            Sign in
          </button>
        </div>

        {mode === 'register' ? (
          <div className="field">
            <label>Workspace name</label>
            <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
          </div>
        ) : (
          <div className="field">
            <label>Workspace ID</label>
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="uuid"
            />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        <button
          className="primary"
          type="submit"
          style={{ width: '100%', marginTop: 6 }}
          disabled={busy}
        >
          {busy ? 'Please wait…' : mode === 'register' ? 'Create workspace' : 'Sign in'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
