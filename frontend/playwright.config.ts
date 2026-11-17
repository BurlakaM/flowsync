import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run in a real browser against a running stack. By default that is the
 * production-like compose stack (nginx on :8080), because it is the one that ships:
 *   docker compose -f docker-compose.yml up -d --build
 * Point E2E_BASE_URL elsewhere to test another environment.
 *
 * The `visual` project is different: it needs no backend (public pages only), serves the production build with
 * `vite preview`, and must run in the Playwright Linux container so that the screenshots are comparable
 * (ops/visual.sh).
 */
const visual = process.env.VISUAL === '1';

export default defineConfig({
  testDir: './e2e',
  // One user flow at a time: the API limits sign-ups per IP.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // One name for a baseline on every platform: it is only ever produced in the Linux container.
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    baseURL: visual
      ? 'http://localhost:4173'
      : (process.env.E2E_BASE_URL ?? 'http://localhost:8080'),
    trace: 'retain-on-failure',
  },
  webServer: visual
    ? {
        command: 'npm run build && npm run preview -- --port 4173 --strictPort',
        url: 'http://localhost:4173/login',
        timeout: 240_000,
        reuseExistingServer: false,
      }
    : undefined,
  projects: visual
    ? [
        {
          name: 'visual',
          testMatch: /visual\.spec\.ts/,
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          testIgnore: /visual\.spec\.ts/,
          use: {
            ...devices['Desktop Chrome'],
            // Locally the installed Chrome is used (no browser download); CI installs Playwright's Chromium.
            channel: process.env.CI ? undefined : 'chrome',
          },
        },
      ],
});
