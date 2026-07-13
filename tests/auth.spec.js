const { test, expect } = require('@playwright/test');
const { login, EMAIL } = require('./helpers');

test.describe('Authentication', () => {
  test('shows login screen on first load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#auth-screen')).toBeVisible();
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-pw')).toBeVisible();
    await expect(page.locator('#auth-btn')).toBeVisible();
  });

  test('shows error on wrong password', async ({ page }) => {
    await page.goto('/');
    await page.fill('#auth-email', EMAIL);
    await page.fill('#auth-pw', 'definitely-wrong-password-12345');
    await page.click('#auth-btn');
    await expect(page.locator('#auth-err')).toBeVisible({ timeout: 10000 });
    const errText = await page.locator('#auth-err').textContent();
    expect(errText).toMatch(/wrong|invalid|password/i);
  });

  test('logs in successfully and shows sidebar', async ({ page }) => {
    await login(page);
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('#btn-new-folder')).toBeVisible();
    // Auth screen should be gone
    await expect(page.locator('#auth-screen')).toBeHidden();
  });

  test('forgot password link is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#auth-forgot')).toBeVisible();
  });
});
