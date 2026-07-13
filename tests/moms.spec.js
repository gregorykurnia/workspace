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
      await expect(page.locator('.ti .nm', { hasText: TEST_FOLDER })).toBeVisible({ timeout: 10000 });
    }
  });

  test('create a new MoM', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    await page.locator('[data-newmom]').first().click();
    // App uses Tiptap editor, not Quill
    await expect(page.locator('#tiptap-editor')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#tiptap-editor .tiptap')).toBeVisible({ timeout: 10000 });
  });

  test('MoM editor accepts text input', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    await page.locator('[data-newmom]').first().click();
    await expect(page.locator('#tiptap-editor .tiptap')).toBeVisible({ timeout: 15000 });
    await page.locator('#tiptap-editor .tiptap').click();
    await page.keyboard.type('This is a Playwright test entry.');
    await expect(page.locator('#tiptap-editor .tiptap')).toContainText('This is a Playwright test entry.');
  });

  test('MoM appears in list after creation', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    await page.waitForTimeout(1000);
    const cards = page.locator('.mc');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
  });

  test('MoM search filters results', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    await page.waitForSelector('.mc', { timeout: 10000 });
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('nonexistent-xyz-12345');
    const visibleCards = page.locator('.mc:visible');
    await expect(visibleCards).toHaveCount(0, { timeout: 5000 });
    await searchInput.fill('');
  });

  test('star a MoM', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    await page.waitForSelector('.mc', { timeout: 10000 });
    // Click the star button on first MoM card
    const starBtn = page.locator('.mc').first().locator('[data-starmom]');
    await starBtn.click();
    // Switch to Starred tab — starred items show with class .star-btn.on
    await page.locator('[data-tab="star"]').click();
    await expect(page.locator('.star-btn.on').first()).toBeVisible({ timeout: 5000 });
  });

  test('cleanup: delete test MoMs and folder', async ({ page }) => {
    await page.locator('.ti', { hasText: TEST_FOLDER }).click();
    await page.locator('[data-tab="mom"]').click();
    await page.waitForTimeout(1500);

    // Delete all MoM cards
    while (true) {
      const cards = page.locator('.mc[data-openmom]');
      if (await cards.count() === 0) break;
      const delBtn = cards.first().locator('[data-delmom]');
      if (await delBtn.count() === 0) break;
      await delBtn.click();
      // Modal confirm button for card delete is #dmc-d
      await page.locator('#dmc-d').click();
      await page.waitForTimeout(600);
    }

    // Delete the folder via context menu → modal confirm #df-d
    const folderItem = page.locator('.ti', { hasText: TEST_FOLDER });
    if (await folderItem.count() > 0) {
      await folderItem.hover();
      await folderItem.locator('.mb').click();
      await page.locator('[data-a="del"]').click();
      await page.locator('#df-d').click();
      await expect(folderItem).toBeHidden({ timeout: 10000 });
    }
  });
});
