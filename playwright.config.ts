import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    // Lets environments with a preinstalled Chromium (e.g. CI images) skip `playwright install`.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'ipad',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        hasTouch: true,
        isMobile: false,
      },
    },
  ],
  webServer: {
    command: 'pnpm --filter @maxsen/web dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
