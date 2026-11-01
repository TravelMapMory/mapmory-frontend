import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',

  projects: [
    {
      name: 'boundaries',
      testMatch: '**/boundaries/*.spec.ts',
      use: {
        browserName: 'chromium',
        headless: true,
      },
    },
  ],

  webServer: [
    {
      command: 'npx vite --host 127.0.0.1 --port 4181 --strictPort',
      url: 'http://127.0.0.1:4181/',
      reuseExistingServer: false,
      env: {
        VITE_API_URL: '',
      },
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 4182 --strictPort',
      url: 'http://127.0.0.1:4182/',
      reuseExistingServer: false,
      env: {
        VITE_API_URL: 'http://127.0.0.1:8080',
      },
    },
  ],
})
