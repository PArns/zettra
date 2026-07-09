import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node 26 ships a native, experimental `localStorage` global that is unavailable (and read-only)
// unless started with `--localstorage-file`; it shadows the jsdom window's Storage, so the
// theme/auth/annotation helpers see `undefined`. Override it with an in-memory Storage — same
// rationale as the matchMedia shim below. Must use defineProperty: the native global is a getter
// with no setter, so plain assignment throws.
if (!globalThis.localStorage?.setItem) {
  const store = new Map<string, string>();
  const storage: Storage = {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}

// jsdom does not implement matchMedia; the theme helper uses it for the OS-preference default.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}

// Unmount React trees between tests so the DOM doesn't leak across cases.
afterEach(() => cleanup());
