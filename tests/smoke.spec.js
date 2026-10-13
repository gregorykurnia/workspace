// Smoke tests for the signed-out paths (no account needed). The full behaviour tests (plan §8.1) come in Phase 8.
const { test, expect } = require('@playwright/test');

test('opens on the sign-in screen with no errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Sign in to/ })).toBeVisible({ timeout: 20000 });
  await expect(page).toHaveURL(/#\/signin$/);
  expect(errors).toEqual([]);
});

test('wrong details are refused with a reason', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('nobody@example.com');
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Couldn’t sign you in')).toBeVisible({ timeout: 20000 });
});

test('Forgot password opens the reset screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
});

test('a share link to something that does not exist says so', async ({ page }) => {
  await page.goto('/#/s/m/does-not-exist');
  await expect(page.getByRole('heading', { name: 'This link is no longer available' })).toBeVisible({ timeout: 30000 });
});

test('an old share address is rewritten to the new one', async ({ page }) => {
  await page.goto('/?mom=does-not-exist');
  await expect(page).toHaveURL(/#\/s\/m\/does-not-exist$/);
  await expect(page.getByRole('heading', { name: 'This link is no longer available' })).toBeVisible({ timeout: 30000 });
});
