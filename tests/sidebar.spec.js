const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Sidebar & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sidebar is visible after login', async ({ page }) => {
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('#tree')).toBeVisible();
  });

  test('sidebar collapses and expands via toggle', async ({ page }) => {
    // Toggle collapse
    await page.click('#sb-toggle');
    await expect(page.locator('#sidebar')).toHaveClass(/collapsed/, { timeout: 3000 });
    // Toggle expand
    await page.click('#sb-toggle');
    await expect(page.locator('#sidebar')).not.toHaveClass(/collapsed/, { timeout: 3000 });
  });

  test('home nav item is active by default', async ({ page }) => {
    await expect(page.locator('#nav-home')).toHaveClass(/active/);
  });

  test('sync indicator shows live status', async ({ page }) => {
    // Allow time for Firestore to connect
    await page.waitForTimeout(3000);
    await expect(page.locator('.sync-dot.live')).toBeVisible({ timeout: 10000 });
  });

  test('trash nav item is clickable', async ({ page }) => {
    await page.click('#sb-trash-btn');
    // Should show trash view content (no crash)
    await expect(page.locator('#ca')).toBeVisible();
  });
});
