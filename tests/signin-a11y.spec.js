// Accessibility of the email-link sign-in screens (plan R3, spec §H) on the emulator: axe in both themes (no serious
// or critical issue), a visible focus indicator on every Tab stop, and 44 px touch targets at 390 px. Each screen is
// reached the way a person reaches it, including the messages around the approved screens (§9.1 G20).
// Runs only under `npm run test:emu` (EMU=1). Every URL carries ?emulator, so nothing reaches the live project.
const { test, expect, requestLink } = require('./support');
const { setTheme, expectNoSeriousIssues, stopsWithoutFocusIndicator, smallTargets } = require('./a11y-support');

const EMU = !!process.env.EMU;
const ADMIN_EMAIL = process.env.TEST_EMAIL;
const STRANGER_EMAIL = process.env.TEST_STRANGER_EMAIL;
// Looks like a sign-in link to the app, but the code is made up: using it fails as a spent link does.
const MADE_UP_LINK = '/?emulator&apiKey=fake-api-key&oobCode=not-a-real-code&mode=signIn&lang=en';

test.skip(!EMU, 'only runs under npm run test:emu');
test.use({ serviceWorkers: 'block' });

const heading = (page, name) => expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 30000 });

/** Each screen and how to get there from a fresh browser. */
const SCREENS = [
  { name: 'Enter your email', open: async page => {
    await page.goto('/?emulator#/signin');
    await heading(page, /^Sign in to/);
  } },
  { name: 'Enter your email · field error', open: async page => {
    await page.goto('/?emulator#/signin');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Send sign-in link' }).click();
    await expect(page.getByText('Check the email address, then try again.')).toBeVisible();
  } },
  { name: 'Check your inbox', open: async page => {
    await requestLink(page, ADMIN_EMAIL);
  } },
  { name: 'Check your inbox · pasted text is no link', open: async page => {
    await requestLink(page, ADMIN_EMAIL);
    await page.getByLabel('Sign-in link').fill('not a link');
    await page.getByRole('button', { name: 'Sign in with this link' }).click();
    await expect(page.getByText('That isn’t a sign-in link.')).toBeVisible();
  } },
  { name: 'Confirm your email · wrong email', open: async page => {
    const link = await requestLink(page, ADMIN_EMAIL);
    await page.evaluate(() => localStorage.removeItem('G_signin_email'));   // as if opened on another device
    await page.goto(link);
    await heading(page, 'Confirm your email');
    await page.getByLabel('Email').fill('someone.else@example.test');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('That isn’t the email this link was sent to.')).toBeVisible({ timeout: 20000 });
  } },
  { name: 'Enter your email · link expired', open: async page => {
    await page.goto(MADE_UP_LINK);
    await heading(page, 'Confirm your email');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('That link has expired')).toBeVisible({ timeout: 20000 });
  } },
  { name: 'Signing you in', open: async page => {
    const link = await requestLink(page, ADMIN_EMAIL);
    await page.route(/accounts:signInWithEmailLink/, () => {});   // held: the screen stays up while it is checked
    await page.goto(link);
    await heading(page, 'Signing you in');
  } },
  { name: 'This email can’t open the workspace', open: async page => {
    const link = await requestLink(page, STRANGER_EMAIL);
    await page.goto(link);
    await heading(page, 'This email can’t open the workspace');
  } },
];

test.describe('desktop: axe in both themes, focus on every Tab stop', () => {
  for (const screen of SCREENS) {
    test(screen.name, async ({ page }) => {
      await screen.open(page);
      await page.evaluate(() => document.fonts.ready);
      await setTheme(page, 'light');
      await expectNoSeriousIssues(page);
      const { bad, stops } = await stopsWithoutFocusIndicator(page);
      expect(stops, 'the page has something to tab to').toBeGreaterThan(0);
      expect(bad, `stops with no visible focus: ${bad.join(', ')}`).toEqual([]);
      await setTheme(page, 'dark');
      await expectNoSeriousIssues(page);
    });
  }
});

test.describe('phone: touch targets at least 44 × 44 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  for (const screen of SCREENS) {
    test(screen.name, async ({ page }) => {
      await screen.open(page);
      await setTheme(page, 'light');
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'the page sees a coarse pointer').toBe(true);
      expect(await smallTargets(page)).toEqual([]);
    });
  }
});
