/**
 * Admin/preview gate for the design annotation system. The annotation overlay is only ever
 * available when admin mode is on, so it never ships to end users. Enabled by any of:
 *   - the build flag `VITE_ADMIN_PREVIEW=1` (preview builds), or
 *   - `?admin=1` in the URL (sets a sticky localStorage flag), or
 *   - `localStorage['zettra.admin'] = '1'`.
 */
const KEY = 'zettra.admin';

export function isAdminEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  // Vite inlines import.meta.env; cast avoids needing the vite/client ambient types here.
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (env?.VITE_ADMIN_PREVIEW === '1') return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === '1') {
    localStorage.setItem(KEY, '1');
    return true;
  }
  if (params.get('admin') === '0') {
    localStorage.removeItem(KEY);
    return false;
  }
  return localStorage.getItem(KEY) === '1';
}

export function setAdmin(on: boolean): void {
  if (on) localStorage.setItem(KEY, '1');
  else localStorage.removeItem(KEY);
}
