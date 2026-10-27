const { test, expect } = require('@playwright/test');

// `npm run test:emu` sets EMU=1: the app runs on localhost against the Auth and Firestore emulators (plan 1.3).
const EMU = !!process.env.EMU;

test.describe('on the emulator', () => {
  test.skip(!EMU, 'only runs under npm run test:emu');
  test.use({ serviceWorkers: 'block' });

  test('the seeded admin signs in', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/?emulator');
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(process.env.TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: /^(Good (morning|afternoon|evening)|Welcome to)/ })).toBeVisible({ timeout: 30000 });
    expect(errors).toEqual([]);
  });
});

test.describe('signed out, on the live site', () => {
  test.skip(EMU, 'these reach the live Firebase project, so the emulator run leaves them out');

  test('opens on the sign-in screen with no errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Sign in to/ })).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/#\/signin$/);
    expect(errors).toEqual([]);
  });

  test('an address that is not an email is refused before anything is sent', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Send sign-in link' }).click();
    await expect(page.getByText('Check the email address, then try again.')).toBeVisible();
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

  // A visitor from the old app has Firebase kept as opaque copies in the service worker's cache. The page now
  // asks for those scripts with `integrity`, so serving an opaque copy blanked the whole app.
  test('opens (not blank) when the cache holds opaque copies of the Firebase scripts', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Sign in to/ })).toBeVisible({ timeout: 20000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 }).catch(async () => { await page.reload(); });
    await page.evaluate(async () => {
      const cache = await caches.open('stale-opaque-copies');
      for (const name of ['app', 'firestore', 'auth']) {
        const url = `https://www.gstatic.com/firebasejs/9.23.0/firebase-${name}-compat.js`;
        await cache.put(url, await fetch(url, { mode: 'no-cors' }));
      }
    });
    errors.length = 0;
    await page.reload();
    await expect(page.getByRole('heading', { name: /Sign in to/ })).toBeVisible({ timeout: 20000 });
    expect(errors).toEqual([]);
  });
});
