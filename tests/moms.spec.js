const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

const TEST_FOLDER = '[TEST] MoM Folder';

test.describe('MoMs (Documents)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('setup: create test folder', async ({ page }) => {
    const existing = page.locator('.ti .nm', { hasText: TEST_FOLDER });
    if (await existing.count() === 0) {
      await page.click('#btn-new-folder');
      await page.waitForSelector('#fn', { state: 'visible' });
      await page.fill('#fn', TEST_FOLDER);
      await page.click('#nf-s');
    }
    await expect(page.locator('.ti .nm', { hasText: TEST_FOLDER }).first()).toBeVisible({ timeout: 10000 });
  });

  test('create a new MoM', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).first().click();
    await page.locator('[data-tab="mom"]').click();
    await page.locator('[data-newmom]').first().click();
    await expect(page.locator('#tiptap-editor')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#tiptap-editor .tiptap')).toBeVisible({ timeout: 10000 });
  });

  test('MoM editor accepts text input', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).first().click();
    await page.locator('[data-tab="mom"]').click();
    await page.locator('[data-newmom]').first().click();
    await expect(page.locator('#tiptap-editor .tiptap')).toBeVisible({ timeout: 15000 });
    await page.locator('#tiptap-editor .tiptap').click();
    await page.keyboard.type('This is a Playwright test entry.');
    await expect(page.locator('#tiptap-editor .tiptap')).toContainText('This is a Playwright test entry.');
  });

  test('MoM appears in list after creation', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).first().click();
    await page.locator('[data-tab="mom"]').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.mc').first()).toBeVisible({ timeout: 10000 });
  });

  test('MoM search filters results', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).first().click();
    await page.locator('[data-tab="mom"]').click();
    await page.waitForSelector('.mc', { timeout: 10000 });
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('nonexistent-xyz-12345');
    await expect(page.locator('.mc:visible')).toHaveCount(0, { timeout: 5000 });
    await searchInput.fill('');
  });

  test('star a MoM', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).first().click();
    await page.locator('[data-tab="mom"]').click();
    await page.waitForSelector('.mc', { timeout: 10000 });
    await page.locator('.mc').first().locator('[data-starmom]').click();
    await page.locator('[data-tab="star"]').click();
    await expect(page.locator('.star-btn.on').first()).toBeVisible({ timeout: 5000 });
  });

  test('cleanup: delete all test MoM folders', async ({ page }) => {
    // Loop to handle multiple leftover copies
    while (await page.locator('.ti', { hasText: TEST_FOLDER }).count() > 0) {
      const folderItem = page.locator('.ti', { hasText: TEST_FOLDER }).first();
      await folderItem.click();
      await page.locator('[data-tab="mom"]').click();
      await page.waitForTimeout(1000);

      // Delete all MoM cards inside this folder
      while (await page.locator('.mc[data-openmom]').count() > 0) {
        const delBtn = page.locator('.mc[data-openmom]').first().locator('[data-delmom]');
        if (await delBtn.count() === 0) break;
        await delBtn.click();
        await page.locator('#dmc-d').click();
        await page.waitForTimeout(600);
      }

      // Now delete the folder itself
      await folderItem.hover();
      await folderItem.locator('.mb').click();
      await page.locator('[data-a="del"]').click();
      await page.locator('#df-d').click();
      await page.waitForTimeout(600);
    }

    await expect(page.locator('.ti', { hasText: TEST_FOLDER })).toHaveCount(0, { timeout: 10000 });
  });
});
