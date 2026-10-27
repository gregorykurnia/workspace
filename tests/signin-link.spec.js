// Phase 3 end-to-end (plan 3.2): sign-in by email link on the emulator with firestore.rules loaded. The "email" is
// read from the Auth emulator's oobCodes (see support.js). An approved email signs in and out; an unapproved email
// lands on the "can't open" screen; a link opened on another device asks for the email again; a pasted link works.
// Runs only under `npm run test:emu` (EMU=1). Every URL carries ?emulator, so nothing reaches the live project.
const { test, expect, requestLink, emulatorSignIn, GREETING } = require('./support');

const EMU = !!process.env.EMU;
const ADMIN_EMAIL = process.env.TEST_EMAIL;
const STRANGER_EMAIL = process.env.TEST_STRANGER_EMAIL;

test.skip(!EMU, 'only runs under npm run test:emu');
test.use({ serviceWorkers: 'block' });

const signedIn = page => expect(page.getByRole('heading', { name: GREETING })).toBeVisible({ timeout: 30000 });
const signInScreen = page => expect(page.getByRole('heading', { name: /^Sign in to/ })).toBeVisible({ timeout: 20000 });

/** A fresh browser context: a different device, with nothing stored. */
async function otherDevice(browser) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  return { context, page: await context.newPage() };
}

test('an approved email signs in with the link and signs out', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await emulatorSignIn(page, ADMIN_EMAIL);
  await expect(page).toHaveURL(/#\/today$/);
  expect(page.url()).not.toMatch(/oobCode|apiKey/);   // the link's parameters left the address

  await page.goto('/?emulator#/account');
  await page.getByRole('button', { name: /^Sign out/ }).click();
  await signInScreen(page);
  await page.reload();
  await signInScreen(page);   // the session is gone, not just hidden
  expect(errors).toEqual([]);
});

test('an unapproved email lands on the "can\'t open" screen and can sign out', async ({ page }) => {
  expect(STRANGER_EMAIL).toBeTruthy();
  const link = await requestLink(page, STRANGER_EMAIL);
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'This email can’t open the workspace' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(STRANGER_EMAIL)).toBeVisible();
  await expect(page.getByRole('heading', { name: GREETING })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await signInScreen(page);
});

test('a link opened on another device asks for the email, then signs in', async ({ page, browser }) => {
  const link = await requestLink(page, ADMIN_EMAIL);   // asked for on this device…
  const other = await otherDevice(browser);
  try {
    await other.page.goto(link);   // …opened on another one
    await expect(other.page.getByRole('heading', { name: 'Confirm your email' })).toBeVisible({ timeout: 20000 });
    expect(other.page.url()).not.toMatch(/oobCode|apiKey/);

    await other.page.getByLabel('Email').fill('someone.else@example.test');
    await other.page.getByRole('button', { name: 'Sign in' }).click();
    await expect(other.page.getByText('That isn’t the email this link was sent to.')).toBeVisible({ timeout: 20000 });

    await other.page.getByLabel('Email').fill(ADMIN_EMAIL);
    await other.page.getByRole('button', { name: 'Sign in' }).click();
    await signedIn(other.page);
  } finally {
    await other.context.close();
  }
});

test('a pasted link signs in, and a text that is no link is refused', async ({ page }) => {
  const link = await requestLink(page, ADMIN_EMAIL);
  const field = page.getByLabel('Sign-in link');

  await field.fill('not a link at all');
  await page.getByRole('button', { name: 'Sign in with this link' }).click();
  await expect(page.getByText('That isn’t a sign-in link.')).toBeVisible();

  await field.fill(`Here you go: <${link}> thanks`);   // a whole pasted line, address in <>
  await page.getByRole('button', { name: 'Sign in with this link' }).click();
  await signedIn(page);
});

test('a used-up link asks for a new one', async ({ page, browser }) => {
  const link = await requestLink(page, ADMIN_EMAIL);
  await page.goto(link);
  await signedIn(page);

  const other = await otherDevice(browser);
  try {
    await other.page.goto(link);   // the same link again: it works once
    await expect(other.page.getByRole('heading', { name: 'Confirm your email' })).toBeVisible({ timeout: 20000 });
    await other.page.getByLabel('Email').fill(ADMIN_EMAIL);
    await other.page.getByRole('button', { name: 'Sign in' }).click();
    await expect(other.page.getByText('That link has expired')).toBeVisible({ timeout: 20000 });
    await expect(other.page.getByRole('button', { name: 'Send sign-in link' })).toBeVisible();
  } finally {
    await other.context.close();
  }
});
