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
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    // Phone: a plain 390 × 844 touch viewport. Not Pixel 5 device emulation, which timed out on CI (plan §8.1).
    {
      name: 'phone',
      use: { viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
});
