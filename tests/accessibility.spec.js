// Accessibility and keyboard checks (plan §8.3): axe on each screen and dialog in both themes (no serious or critical
// issue), a visible focus indicator on every Tab stop, Enter on a short form, and 44 px touch targets at 390 px.
// The signed-out screens run in every configuration; the signed-in ones need TEST_EMAIL and TEST_PASSWORD (plan Q4).
// Nothing here writes data: the signed-in checks only open pages and dialogs. The email-link sign-in screens that need
// a sent link or a signed-in session are checked on the emulator, in signin-a11y.spec.js.
const { test, expect, signIn, HAS_ACCOUNT } = require('./support');
const { setTheme, expectNoSeriousIssues, resetFocusStart, stopsWithoutFocusIndicator, smallTargets } = require('./a11y-support');

const THEMES = ['light', 'dark'];

/** Signed-out screens: where they are and what shows when they're ready. */
const OPEN_SCREENS = [
  { name: 'Sign in', hash: '#/signin', ready: p => p.getByRole('heading', { name: /Sign in to/ }) },
  { name: 'Link unavailable', hash: '#/s/a/does-not-exist', ready: p => p.getByRole('heading', { name: 'This link is no longer available' }) },
];

/** Signed-in screens that only read data. `open` (optional) opens a layer on top of the page. */
const SIGNED_IN_SCREENS = [
  { name: 'Today', hash: '#/today', ready: p => p.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ }) },
  { name: 'All areas', hash: '#/areas', ready: p => p.getByRole('heading', { level: 1, name: 'All areas' }) },
  { name: 'Flagged', hash: '#/flagged', ready: p => p.getByRole('heading', { level: 1, name: 'Flagged' }) },
  { name: 'Recent', hash: '#/recent', ready: p => p.getByRole('heading', { level: 1, name: 'Recent' }) },
  { name: 'Deleted', hash: '#/deleted', ready: p => p.getByRole('heading', { level: 1, name: 'Deleted' }) },
  { name: 'Account', hash: '#/account', ready: p => p.getByRole('heading', { level: 1, name: 'Account' }) },
  { name: 'Missing page', hash: '#/nowhere', ready: p => p.getByRole('heading', { name: 'This page isn’t here' }) },
  {
    name: 'New area dialog', hash: '#/today', ready: p => p.getByRole('dialog', { name: 'New area' }),
    open: p => p.getByRole('button', { name: 'New area' }).first().click(),
  },
  {
    name: 'Command bar', hash: '#/today', ready: p => p.getByRole('combobox', { name: 'Search or jump to' }),
    open: p => p.keyboard.press('ControlOrMeta+k'),
  },
];

async function openScreen(page, screen, theme) {
  await page.goto('/');
  await setTheme(page, theme);
  await page.evaluate(h => { location.hash = h; }, screen.hash);
  await expect(screen.ready(page)).toBeVisible({ timeout: 30000 });
  if (screen.open) {
    await screen.open(page);
    await expect(screen.ready(page)).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
}

async function openSignedIn(page, screen, theme) {
  await signIn(page);
  await setTheme(page, theme);
  await page.evaluate(h => { location.hash = h; }, screen.hash);
  await expect(screen.ready(page)).toBeVisible({ timeout: 30000 });
  if (screen.open) {
    await screen.open(page);
    await expect(screen.ready(page)).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
}

// --- axe ---------------------------------------------------------------------------------------------------------

test.describe('axe: no serious or critical issues', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', 'one viewport is enough for the rule checks'); });
  for (const theme of THEMES) {
    for (const screen of OPEN_SCREENS) {
      test(`${screen.name} · ${theme}`, async ({ page }) => {
        await openScreen(page, screen, theme);
        await expectNoSeriousIssues(page);
      });
    }
    for (const screen of SIGNED_IN_SCREENS) {
      test(`${screen.name} · ${theme} (signed in)`, async ({ page }) => {
        test.skip(!HAS_ACCOUNT, 'needs TEST_EMAIL and TEST_PASSWORD (plan Q4)');
        await openSignedIn(page, screen, theme);
        await expectNoSeriousIssues(page);
      });
    }
  }
});

// --- keyboard ----------------------------------------------------------------------------------------------------

test.describe('keyboard: every Tab stop shows focus', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', 'keyboard model is checked on the desktop viewport'); });
  for (const screen of OPEN_SCREENS) {
    test(`${screen.name}`, async ({ page }) => {
      await openScreen(page, screen, 'light');
      const { bad, stops } = await stopsWithoutFocusIndicator(page);
      expect(stops, 'the page has something to tab to').toBeGreaterThan(0);
      expect(bad, `stops with no visible focus: ${bad.join(', ')}`).toEqual([]);
    });
  }
  for (const screen of SIGNED_IN_SCREENS) {
    test(`${screen.name} (signed in)`, async ({ page }) => {
      test.skip(!HAS_ACCOUNT, 'needs TEST_EMAIL and TEST_PASSWORD (plan Q4)');
      await openSignedIn(page, screen, 'light');
      const { bad, stops } = await stopsWithoutFocusIndicator(page);
      expect(stops, 'the page has something to tab to').toBeGreaterThan(0);
      expect(bad, `stops with no visible focus: ${bad.join(', ')}`).toEqual([]);
    });
  }

  test('Enter submits the short sign-in form', async ({ page }) => {
    await openScreen(page, OPEN_SCREENS[0], 'light');
    await page.getByLabel('Email').press('Enter');
    await expect(page.getByText('Enter your email address.')).toBeVisible();
  });

  test('the skip link is the first stop and moves focus to the content', async ({ page }) => {
    await openScreen(page, OPEN_SCREENS[0], 'light');
    await resetFocusStart(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('#view')).toBeFocused();
  });
});

// --- touch targets -----------------------------------------------------------------------------------------------

test.describe('touch targets: at least 44 × 44 px on a phone', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'phone', 'only meaningful at 390 px with touch'); });

  for (const screen of OPEN_SCREENS) {
    test(`${screen.name}`, async ({ page }) => {
      await openScreen(page, screen, 'light');
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'the page sees a coarse pointer').toBe(true);
      expect(await smallTargets(page)).toEqual([]);
    });
  }
  for (const screen of SIGNED_IN_SCREENS) {
    test(`${screen.name} (signed in)`, async ({ page }) => {
      test.skip(!HAS_ACCOUNT, 'needs TEST_EMAIL and TEST_PASSWORD (plan Q4)');
      await openSignedIn(page, screen, 'light');
      expect(await smallTargets(page)).toEqual([]);
    });
  }
});
