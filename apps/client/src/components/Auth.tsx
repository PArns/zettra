import { useState } from 'react';
import { api, setToken } from '../api';

/** Minimal register/login gate (§2). Registration provisions a whole seeded tenant. */
export function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [tenantName, setTenantName] = useState('My Brain');
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const res =
        mode === 'register'
          ? await api.register({ tenantName, email, password })
          : await api.login({ tenantId, email, password });
      setToken(res.accessToken);
      onAuthed();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="zettra-auth">
      <h1>Zettra</h1>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => setMode('register')} disabled={mode === 'register'}>
          Register
        </button>
        <button onClick={() => setMode('login')} disabled={mode === 'login'}>
          Login
        </button>
      </div>
      {mode === 'register' ? (
        <input
          placeholder="Tenant name"
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
        />
      ) : (
        <input
          placeholder="Tenant id"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        />
      )}
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        placeholder="Password (min 8)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={submit}>{mode === 'register' ? 'Create account' : 'Sign in'}</button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  );
}
