import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Development proxy: the browser always calls the same-origin `/api`, exactly like in production
// where nginx forwards it. In Docker the backend is reachable as http://backend:3000.
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // ws: the live-updates socket (/api/socket.io) goes through the same rule.
    proxy: { '/api': { target: proxyTarget, changeOrigin: true, ws: true } },
    // Bind mounts from Windows do not deliver file-system events: poll when asked to.
    watch:
      process.env.VITE_USE_POLLING === 'true'
        ? { usePolling: true, interval: 300 }
        : undefined,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/testing/setup.ts'],
    // The first test of a file also transforms the lazy routes, which is slow on a cold start.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/testing/**',
        'src/components/ui/**',
      ],
      reporter: ['text', 'lcov'],
      // A ratchet, not a goal: set a little under the measured values (statements 92, branches 85,
      // functions 90) so that a change which drops tests fails CI. Raise it when the coverage grows.
      thresholds: {
        statements: 88,
        branches: 80,
        functions: 85,
        lines: 88,
      },
    },
  },
});
