import type { AuthTokenDto, BlockDto } from '@zettra/shared';

/**
 * Minimal typed API client. Talks to the same origin under `/api` (dev proxy / prod nginx).
 * The JWT is kept in localStorage for v1 (§2: enough to gate the API).
 */
const TOKEN_KEY = 'zettra.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

export const api = {
  register(input: { tenantName: string; email: string; password: string }): Promise<AuthTokenDto> {
    return request('/auth/register', { method: 'POST', body: JSON.stringify(input) });
  },
  login(input: { tenantId: string; email: string; password: string }): Promise<AuthTokenDto> {
    return request('/auth/login', { method: 'POST', body: JSON.stringify(input) });
  },
  me(): Promise<{ userId: string; tenantId: string; spaces: string[] }> {
    return request('/auth/me');
  },
  inbox(): Promise<BlockDto[]> {
    return request('/views/inbox');
  },
  createBlock(input: { spaceId: string; content?: unknown }): Promise<BlockDto> {
    return request('/blocks', { method: 'POST', body: JSON.stringify(input) });
  },
};
