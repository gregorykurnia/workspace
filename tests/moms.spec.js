const { test, expect } = require('@playwright/test');
const { login, TEST_PREFIX } = require('./helpers');

const TEST_FOLDER = `${TEST_PREFIX} MoMs`;

async function goToMomTab(page) {
  // Create folder if it doesn't exist yet in this run
  if (await page.locator('.ti .nm', { hasText: TEST_FOLDER }).count() === 0) {
    await page.click('#btn-new-folder');
    await page.waitForSelector('#fn', { state: 'visible' });
    await page.fill('#fn', TEST_FOLDER);
    await page.click('#nf-s');
    await page.waitForTimeout(500);
  }
  await page.locator('.ti', { hasText: TEST_FOLDER }).first().click();
  await page.locator('[data-tab="mom"]').click();
}

async function createMomAndReturnToList(page) {
  await page.locator('[data-newmom]').first().click();
  await expect(page.locator('#tiptap-editor .tiptap')).toBeVisible({ timeout: 15000 });
  await page.locator('.ti', { hasText: TEST_FOLDER }).first().click();
  await page.locator('[data-tab="mom"]').click();
  await page.waitForSelector('.mc', { timeout: 10000 });
}

test.describe('MoMs (Documents)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('create a new MoM opens editor', async ({ page }) => {
    await goToMomTab(page);
    await page.locator('[data-newmom]').first().click();
    await expect(page.locator('#tiptap-editor')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#tiptap-editor .tiptap')).toBeVisible({ timeout: 10000 });
  });

  test('MoM editor accepts text input', async ({ page }) => {
    await goToMomTab(page);
    await page.locator('[data-newmom]').first().click();
    await expect(page.locator('#tiptap-editor .tiptap')).toBeVisible({ timeout: 15000 });
    await page.locator('#tiptap-editor .tiptap').click();
    await page.keyboard.type('Playwright test entry.');
    await expect(page.locator('#tiptap-editor .tiptap')).toContainText('Playwright test entry.');
  });

  test('MoM appears in list after creation', async ({ page }) => {
    await goToMomTab(page);
    await createMomAndReturnToList(page);
    await expect(page.locator('.mc').first()).toBeVisible({ timeout: 10000 });
  });

  test('MoM search filters results', async ({ page }) => {
    await goToMomTab(page);
    await createMomAndReturnToList(page);
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('nonexistent-xyz-12345');
    await expect(page.locator('.mc:visible')).toHaveCount(0, { timeout: 5000 });
    await searchInput.fill('');
  });

  test('star a MoM', async ({ page }) => {
    await goToMomTab(page);
    await createMomAndReturnToList(page);
    await page.locator('.mc').first().locator('[data-starmom]').click();
    await page.locator('[data-tab="star"]').click();
    await expect(page.locator('.star-btn.on').first()).toBeVisible({ timeout: 5000 });
  });

  // Cleanup: old test data auto-expires in Firebase Trash after 7 days
});
