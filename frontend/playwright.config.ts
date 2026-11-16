import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run in a real browser against a running stack. By default that is the
 * production-like compose stack (nginx on :8080), because it is the one that ships:
 *   docker compose -f docker-compose.yml up -d --build
 * Point E2E_BASE_URL elsewhere to test another environment.
 */
export default defineConfig({
  testDir: './e2e',
  // One user flow at a time: the API limits sign-ups per IP.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Locally the installed Chrome is used (no browser download); CI installs Playwright's Chromium.
        channel: process.env.CI ? undefined : 'chrome',
      },
    },
  ],
});
