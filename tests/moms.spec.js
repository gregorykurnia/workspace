const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

const TEST_FOLDER = '[TEST] MoM Folder';
const TEST_MOM_TITLE = 'Meeting Notes'; // default title set by app

test.describe('MoMs (Documents)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('setup: create test folder', async ({ page }) => {
    // Only create if it doesn't already exist
    const existing = page.locator('.ti .nm', { hasText: TEST_FOLDER });
    if (await existing.count() === 0) {
      await page.click('#btn-new-folder');
      await page.waitForSelector('#fn', { state: 'visible' });
      await page.fill('#fn', TEST_FOLDER);
      await page.click('#nf-s');
      await expect(page.locator('.ti .nm', { hasText: TEST_FOLDER })).toBeVisible({ timeout: 10000 });
    }
  });

  test('create a new MoM', async ({ page }) => {
    // Navigate to the test folder
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    // Switch to Documents tab
    await page.locator('[data-tab="mom"]').click();
    // Click New MoM / Add Document button
    await page.locator('[data-newmom]').first().click();
    // Should enter MoM editor view
    await expect(page.locator('.ql-editor')).toBeVisible({ timeout: 10000 });
  });

  test('MoM editor accepts text input', async ({ page }) => {
    // Navigate to the test folder
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    await page.locator('[data-newmom]').first().click();
    await expect(page.locator('.ql-editor')).toBeVisible({ timeout: 10000 });
    // Type in the editor
    await page.locator('.ql-editor').click();
    await page.keyboard.type('This is a Playwright test entry.');
    await expect(page.locator('.ql-editor')).toContainText('This is a Playwright test entry.');
  });

  test('MoM appears in list after creation', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    // Wait for MoM cards to load
    await page.waitForTimeout(1000);
    // There should be at least one .mc card (created in prior test)
    const cards = page.locator('.mc');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('MoM search filters results', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    await page.waitForSelector('.mc', { timeout: 10000 });
    // Type in search box
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('nonexistent-xyz-12345');
    // All cards should be hidden
    const visibleCards = page.locator('.mc:visible');
    await expect(visibleCards).toHaveCount(0, { timeout: 5000 });
    // Clear search
    await searchInput.fill('');
  });

  test('star a MoM', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    await page.waitForSelector('.mc', { timeout: 10000 });
    // Click the star button on first card
    const starBtn = page.locator('.mc').first().locator('[data-starmom]');
    await starBtn.click();
    // Switch to Starred tab and verify the MoM appears
    await page.locator('[data-tab="star"]').click();
    await expect(page.locator('.mc').first()).toBeVisible({ timeout: 5000 });
  });

  test('cleanup: delete test MoMs and folder', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    await page.waitForTimeout(1500);

    // Delete all MoM cards in the folder
    while (true) {
      const cards = page.locator('.mc[data-openmom]');
      if (await cards.count() === 0) break;
      const delBtn = cards.first().locator('[data-delmom]');
      if (await delBtn.count() === 0) break;
      await delBtn.click();
      const confirmBtn = page.locator('button', { hasText: /delete|confirm|yes/i }).last();
      await confirmBtn.click();
      await page.waitForTimeout(500);
    }

    // Delete the folder itself
    const folderItem = page.locator('.ti', { hasText: TEST_FOLDER });
    if (await folderItem.count() > 0) {
      await folderItem.hover();
      await folderItem.locator('.mb').click();
      await page.locator('[data-a="del"]').click();
      const confirmBtn = page.locator('button', { hasText: /delete|confirm|yes/i }).last();
      await confirmBtn.click();
      await expect(folderItem).toBeHidden({ timeout: 10000 });
    }
  });
});
