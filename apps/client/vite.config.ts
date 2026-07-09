/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite + Vitest config. In dev, proxy `/api` → server and `/collab` (WebSocket) → collab so
 * the client talks to a single origin, mirroring the nginx routing in prod (§13.1). Tests run
 * under jsdom with Testing Library.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/collab': { target: 'ws://localhost:1234', ws: true },
    },
  },
  resolve: {
    alias: {
      '@zettra/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
      '@zettra/editor-ext': new URL('../../packages/editor-ext/src/index.ts', import.meta.url)
        .pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
