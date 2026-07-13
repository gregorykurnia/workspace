const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

const TEST_FOLDER = '[TEST] Playwright Folder';
const TEST_SUBFOLDER = '[TEST] Playwright Subfolder';

test.describe('Folders', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('create a top-level folder', async ({ page }) => {
    await page.click('#btn-new-folder');
    // Modal appears with folder name input
    await page.waitForSelector('#fn', { state: 'visible' });
    await page.fill('#fn', TEST_FOLDER);
    await page.click('#nf-s');
    // Folder should appear in sidebar tree
    await expect(page.locator('.ti .nm', { hasText: TEST_FOLDER })).toBeVisible({ timeout: 10000 });
  });

  test('navigate into folder and see tabs', async ({ page }) => {
    // Click the test folder created above
    const folderItem = page.locator('.ti', { hasText: TEST_FOLDER });
    await expect(folderItem).toBeVisible({ timeout: 10000 });
    await folderItem.click();
    // Should see the tab bar
    await expect(page.locator('[data-tab="mom"]')).toBeVisible();
    await expect(page.locator('[data-tab="doc"]')).toBeVisible();
    await expect(page.locator('[data-tab="star"]')).toBeVisible();
  });

  test('create a subfolder via context menu', async ({ page }) => {
    const folderItem = page.locator('.ti', { hasText: TEST_FOLDER });
    await expect(folderItem).toBeVisible({ timeout: 10000 });
    // Open context menu (⋯ button)
    await folderItem.hover();
    const menuBtn = folderItem.locator('.mb');
    await menuBtn.click();
    // Click "New subfolder" option
    await page.locator('[data-a="sub"]').click();
    await page.waitForSelector('#fn', { state: 'visible' });
    await page.fill('#fn', TEST_SUBFOLDER);
    await page.click('#nf-s');
    // Subfolder appears under parent
    await expect(page.locator('.ti .nm', { hasText: TEST_SUBFOLDER })).toBeVisible({ timeout: 10000 });
  });

  test('delete test folders (cleanup)', async ({ page }) => {
    // Delete subfolder first
    const subItem = page.locator('.ti', { hasText: TEST_SUBFOLDER });
    if (await subItem.count() > 0) {
      await subItem.hover();
      await subItem.locator('.mb').click();
      await page.locator('[data-a="del"]').click();
      await page.locator('#df-d').click(); // modal confirm button
      await expect(subItem).toBeHidden({ timeout: 10000 });
    }

    // Delete parent folder
    const folderItem = page.locator('.ti', { hasText: TEST_FOLDER });
    if (await folderItem.count() > 0) {
      await folderItem.hover();
      await folderItem.locator('.mb').click();
      await page.locator('[data-a="del"]').click();
      await page.locator('#df-d').click(); // modal confirm button
      await expect(folderItem).toBeHidden({ timeout: 10000 });
    }
  });
});
