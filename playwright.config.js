// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // serial — tests share Firebase state
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.BASE_URL || 'https://workspace-mzyz.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile disabled on CI — Firebase auth consistently times out on Pixel 5 emulation
    // Re-enable locally with: npx playwright test --project=mobile
    // {
    //   name: 'mobile',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],
});
