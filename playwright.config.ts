import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    { name: 'checks', testMatch: '**/checks/*.spec.ts' },
    { name: 'desktop', testMatch: '**/e2e/*.spec.ts', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', testMatch: '**/e2e/*.spec.ts', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'phone', testMatch: '**/e2e/*.spec.ts', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    // Always start the configured server: an ordinary dev server lacks test fixtures.
    reuseExistingServer: false,
    env: { VITE_GEOAPIFY_KEY: '', VITE_ACCEPTANCE_TESTS: 'true' },
  },
})
