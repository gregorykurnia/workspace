const { chromium } = require('@playwright/test');

const EMAIL = process.env.TEST_EMAIL || '';
const PASSWORD = process.env.TEST_PASSWORD || '';

module.exports = async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(process.env.BASE_URL || 'https://workspace-mzyz.vercel.app');
    await page.waitForSelector('#auth-screen', { state: 'visible' });
    await page.fill('#auth-email', EMAIL);
    await page.fill('#auth-pw', PASSWORD);
    await page.click('#auth-btn');
    await page.waitForSelector('#auth-screen', { state: 'hidden', timeout: 15000 });
    await page.waitForTimeout(2000); // let Firestore sync

    // Delete ALL leftover [TEST] folders
    while (true) {
      const testFolders = page.locator('.ti', { hasText: '[TEST]' });
      const count = await testFolders.count();
      if (count === 0) break;

      const item = testFolders.first();
      await item.hover();
      await item.locator('.mb').click();
      await page.locator('[data-a="del"]').click();
      await page.locator('#df-d').click();
      await page.waitForTimeout(500);
    }

    console.log('Global setup: all [TEST] folders cleaned up');
  } catch (e) {
    console.warn('Global setup cleanup failed (non-fatal):', e.message);
  } finally {
    await browser.close();
  }
};
