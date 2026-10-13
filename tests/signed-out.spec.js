// Signed-out behaviour (plan §8.1): no account needed, so these run in every configuration.
const { test, expect } = require('./support');

test('empty sign-in is refused before anything is sent', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter your email address.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();
});

test('the sign-in screen shows no sidebar or navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Sign in to/ })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
});

test('the sign-in screen has no horizontal scroll at this width', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Sign in to/ })).toBeVisible({ timeout: 20000 });
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(fits).toBe(true);
});

test('a share link to an area that does not exist says so', async ({ page }) => {
  await page.goto('/#/s/a/does-not-exist');
  await expect(page.getByRole('heading', { name: 'This link is no longer available' })).toBeVisible({ timeout: 30000 });
});

test('a share link to a file that does not exist says so', async ({ page }) => {
  await page.goto('/#/s/f/does-not-exist');
  await expect(page.getByRole('heading', { name: 'This link is no longer available' })).toBeVisible({ timeout: 30000 });
});

test('an old area share address is rewritten to the new one', async ({ page }) => {
  await page.goto('/?folder=does-not-exist');
  await expect(page).toHaveURL(/#\/s\/a\/does-not-exist$/);
});

test('an old file share address is rewritten to the new one', async ({ page }) => {
  await page.goto('/?doc=does-not-exist');
  await expect(page).toHaveURL(/#\/s\/f\/does-not-exist$/);
});

// The redirect goes to a signed-in address, which a signed-out visitor is then sent on from. The
// rewritten address is seen by watching navigations, not only the final URL.
test('an old MoM hash address is rewritten before sign-in takes over', async ({ page }) => {
  const seen = [];
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) seen.push(frame.url()); });
  await page.goto('/#m=does-not-exist');
  await expect.poll(() => seen.some(u => /#\/mom\/does-not-exist$/.test(u)), { timeout: 20000 }).toBe(true);
});

test('an old folder hash address is rewritten before sign-in takes over', async ({ page }) => {
  const seen = [];
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) seen.push(frame.url()); });
  await page.goto('/#f=does-not-exist');
  await expect.poll(() => seen.some(u => /#\/areas\/does-not-exist$/.test(u)), { timeout: 20000 }).toBe(true);
});
