const { test, expect } = require('@playwright/test');
const { login, TEST_PREFIX } = require('./helpers');

const TEST_FOLDER = `${TEST_PREFIX} Folders`;
const TEST_SUBFOLDER = `${TEST_PREFIX} Subfolder`;

test.describe('Folders', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('create a top-level folder', async ({ page }) => {
    await page.click('#btn-new-folder');
    await page.waitForSelector('#fn', { state: 'visible' });
    await page.fill('#fn', TEST_FOLDER);
    await page.click('#nf-s');
    await expect(page.locator('.ti .nm', { hasText: TEST_FOLDER }).first()).toBeVisible({ timeout: 10000 });
  });

  test('navigate into folder and see tabs', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).first().click();
    await expect(page.locator('[data-tab="mom"]')).toBeVisible();
    await expect(page.locator('[data-tab="doc"]')).toBeVisible();
    await expect(page.locator('[data-tab="star"]')).toBeVisible();
  });

  test('create a subfolder via context menu', async ({ page }) => {
    const folderItem = page.locator('.ti', { hasText: TEST_FOLDER }).first();
    await expect(folderItem).toBeVisible({ timeout: 10000 });
    await folderItem.hover();
    await folderItem.locator('.mb').click();
    await page.locator('[data-a="sub"]').click();
    await page.waitForSelector('#fn', { state: 'visible' });
    await page.fill('#fn', TEST_SUBFOLDER);
    await page.click('#nf-s');
    await expect(page.locator('.ti .nm', { hasText: TEST_SUBFOLDER }).first()).toBeVisible({ timeout: 10000 });
  });

  // Cleanup is handled by global-setup.js before each run
});
