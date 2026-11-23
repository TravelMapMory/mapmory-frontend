import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/checks',
  testMatch: 'live-client.spec.ts',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    env: {
      VITE_API_URL: 'http://127.0.0.1:59999',
      VITE_FIREBASE_API_KEY: '',
      VITE_GEOAPIFY_KEY: '',
      VITE_ACCEPTANCE_TESTS: 'true',
    },
  },
})
