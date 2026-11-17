// End-to-end suite: the BUILT site (dist/, served with the Plesk rewrite rules) against the e2e API
// (api/scripts/e2e-server.js → local test database only, console providers, test hooks).
// Run: npm run e2e   (builds first)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // one shared test database
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /deep-link-refresh/ },
  ],
  webServer: [
    { command: 'node ../api/scripts/e2e-server.js', url: 'http://localhost:4100/api/v1/health', timeout: 120_000, reuseExistingServer: false, stdout: 'ignore', stderr: 'pipe' },
    { command: 'node e2e/static-server.mjs', url: 'http://localhost:4173', timeout: 30_000, reuseExistingServer: false },
  ],
});
