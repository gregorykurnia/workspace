const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

const TEST_FOLDER = '[TEST] MoM Folder';

/** Navigate into the test folder's Documents tab, creating the folder if needed */
async function goToMomTab(page) {
  let folder = page.locator('.ti', { hasText: TEST_FOLDER }).first();
  if (await folder.count() === 0) {
    await page.click('#btn-new-folder');
    await page.waitForSelector('#fn', { state: 'visible' });
    await page.fill('#fn', TEST_FOLDER);
    await page.click('#nf-s');
    await page.waitForTimeout(500);
    folder = page.locator('.ti', { hasText: TEST_FOLDER }).first();
  }
  await folder.click();
  await page.locator('[data-tab="mom"]').click();
}

/** Create a MoM and return to the list view */
async function createMom(page) {
  await page.locator('[data-newmom]').first().click();
  await expect(page.locator('#tiptap-editor .tiptap')).toBeVisible({ timeout: 15000 });
  // Go back to list
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
    await page.keyboard.type('This is a Playwright test entry.');
    await expect(page.locator('#tiptap-editor .tiptap')).toContainText('This is a Playwright test entry.');
  });

  test('MoM appears in list after creation', async ({ page }) => {
    await goToMomTab(page);
    await createMom(page);
    await expect(page.locator('.mc').first()).toBeVisible({ timeout: 10000 });
  });

  test('MoM search filters results', async ({ page }) => {
    await goToMomTab(page);
    await createMom(page);
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('nonexistent-xyz-12345');
    await expect(page.locator('.mc:visible')).toHaveCount(0, { timeout: 5000 });
    await searchInput.fill('');
  });

  test('star a MoM', async ({ page }) => {
    await goToMomTab(page);
    await createMom(page);
    await page.locator('.mc').first().locator('[data-starmom]').click();
    await page.locator('[data-tab="star"]').click();
    await expect(page.locator('.star-btn.on').first()).toBeVisible({ timeout: 5000 });
  });

  // Cleanup is handled by global-setup.js before each run
});
