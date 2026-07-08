import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config. In dev, proxy `/api` → server and `/collab` (WebSocket) → collab so the client
 * talks to a single origin, mirroring the nginx routing in prod (§13.1).
 */
export default defineConfig({
  plugins: [react()],
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
});
