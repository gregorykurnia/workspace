// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // The screenshot capture is slow and writes a report, so it only runs on request (npm run capture).
  globalSetup: process.env.CAPTURE ? './tests/visual/global-setup.js' : undefined,
  testIgnore: process.env.CAPTURE ? [] : ['**/visual/**'],
  // npm run test:emu (EMU=1) runs only the specs written for the emulator: they open every URL with ?emulator.
  // The other specs sign in at '/', which would reach the live Firebase project. Add new emulator specs here.
  testMatch: process.env.EMU ? ['**/smoke.spec.js', '**/phase1-rules.spec.js', '**/private-areas.spec.js'] : undefined,
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
