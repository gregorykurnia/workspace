// Shared helpers for the behaviour specs (plan §8.1). Playwright runs only *.spec.js, so this file is not a test.
// Everything here goes through the UI: no test writes to Firestore directly.
const base = require('@playwright/test');
const { expect } = base;

// Every name a test creates starts with this tag, so cleanup and the real workspace data never mix.
const RUN_TAG = `[TEST-${process.env.GITHUB_RUN_ID || Date.now()}]`;
const ADMIN = { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD };
const MEMBER = { email: process.env.TEST_MEMBER_EMAIL, password: process.env.TEST_MEMBER_PASSWORD };
const HAS_ACCOUNT = !!(ADMIN.email && ADMIN.password);
const HAS_MEMBER = !!(MEMBER.email && MEMBER.password);

const testName = label => `${RUN_TAG} ${label}`;
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const areaIdFromUrl = page => decodeURIComponent(new URL(page.url()).hash.split('/').pop());
const momIdFromUrl = page => decodeURIComponent(new URL(page.url()).hash.split('/').pop());

const GREETING = /^(Good (morning|afternoon|evening)|Welcome to)/;
const EMU = !!process.env.EMU;
const AUTH_EMULATOR = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`;
const EMU_PROJECT = 'demo-workspace';

const BASE_URL = process.env.BASE_URL || '';
/** App addresses ('/…' or under BASE_URL) get ?emulator before the hash, so a spec can't reach the live project. */
function emulatorUrl(url) {
  if (typeof url !== 'string' || !(url.startsWith('/') || (BASE_URL && url.startsWith(BASE_URL)))) return url;
  const i = url.indexOf('#');
  let path = i < 0 ? url : url.slice(0, i);
  if (!/[?&]emulator\b/.test(path)) path += (path.includes('?') ? '&' : '?') + 'emulator';
  return path + (i < 0 ? '' : url.slice(i));
}
/** Under EMU: every page of the context opens app addresses with ?emulator, and Cloudinary is never reached. */
function guardContext(context) {
  if (!EMU || context.__emuGuard) return context;
  context.__emuGuard = true;
  const patch = page => { const go = page.goto.bind(page); page.goto = (url, opts) => go(emulatorUrl(url), opts); };
  context.pages().forEach(patch);
  context.on('page', patch);
  context.route(/cloudinary\.com/, route => route.abort());
  return context;
}
// `context` and `page` come from the fixtures; `browser.newContext()` (visitor and member windows) is guarded too.
const test = base.test.extend({
  browser: [async ({ browser }, use) => {
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async opts => guardContext(await newContext(opts));
    await use(browser);
    browser.newContext = newContext;
  }, { scope: 'worker' }],
  context: async ({ context }, use) => { await use(guardContext(context)); },
});

/** The newest sign-in link the Auth emulator "mailed" to this address (read from its oobCodes), or null. */
async function emulatorLink(email) {
  const res = await fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${EMU_PROJECT}/oobCodes`);
  const codes = (await res.json()).oobCodes || [];
  const mine = codes.filter(c => c.requestType === 'EMAIL_SIGNIN' && String(c.email).toLowerCase() === email.toLowerCase());
  return mine.length ? mine[mine.length - 1].oobLink : null;
}
/** Types the email on the sign-in screen and sends the link; waits for "Check your inbox". Returns the link. */
async function requestLink(page, email) {
  await page.goto('/?emulator');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible({ timeout: 20000 });
  const link = await emulatorLink(email);
  expect(link, `the Auth emulator holds a sign-in link for ${email}`).toBeTruthy();
  return link;
}
/** Emulator sign-in by link, as a person does it: ask for the link, then open it in the same browser. */
async function emulatorSignIn(page, email) {
  const link = await requestLink(page, email);
  await page.goto(link);   // the emulator redirects to the app with the link's parameters
  await expect(page.getByRole('heading', { name: GREETING })).toBeVisible({ timeout: 30000 });
}

/** Signs in and waits for the first screen. Only the emulator run can: the password form is gone, and the real
 *  sign-in link goes to an inbox (plan 3.2). Other runs skip. */
async function signIn(page, who = ADMIN) {
  test.skip(!EMU || !who.email, 'needs the emulator run (npm run test:emu): sign-in is by email link');
  await emulatorSignIn(page, who.email);
}

/** Creates an area at the top level through the New area dialog. Returns its id and name. */
async function createArea(page, label, { emoji = false } = {}) {
  const name = testName(label);
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'New area' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New area' });
  await dialog.getByLabel('Name').fill(name);
  if (emoji) await dialog.getByRole('radio').nth(1).click();
  await dialog.getByRole('button', { name: 'Create area' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 20000 });
  return { id: areaIdFromUrl(page), name };
}

/** Opens an area and starts a MoM in it with the header's New MoM button. Returns the MoM's id. */
async function newMoM(page, area) {
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await page.getByRole('button', { name: 'New MoM', exact: true }).first().click();
  await expect(page.getByRole('textbox', { name: 'Meeting notes' })).toBeVisible({ timeout: 20000 });
  return momIdFromUrl(page);
}

/** Types a MoM's title in the editor. The title is a contenteditable heading, so it's clicked and typed into. */
async function setTitle(page, title) {
  const heading = page.getByRole('heading', { name: 'Title' });
  await heading.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(title);
}

/** Removes what a test made, through the UI: each area goes to Deleted, then every [TEST-…] row in Deleted is removed for good. */
async function cleanUp(page, { areas = [], pw = null } = {}) {
  if (!HAS_ACCOUNT) return;
  for (const a of areas) {
    await page.goto(`/#/areas/${encodeURIComponent(a.id)}`);
    const gate = page.getByRole('heading', { name: `${a.name} is restricted` });
    if (pw && await gate.isVisible().catch(() => false)) {
      await page.getByLabel('Password', { exact: true }).fill(pw);
      await page.getByRole('button', { name: 'Unlock' }).click();
    }
    const more = page.getByRole('button', { name: `More actions for ${a.name}` });
    if (!(await more.count())) continue;   // already gone
    await more.click();
    await page.getByRole('menuitem', { name: 'Delete area' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete area' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await page.goto('/#/deleted');
  const row = new RegExp(`^Remove .*${escapeRe(RUN_TAG)}.* forever$`);
  for (let i = 0; i < 40; i++) {
    const button = page.getByRole('button', { name: row });
    if (!(await button.count())) break;
    await button.first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove forever' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
}

module.exports = {
  test, expect, RUN_TAG, ADMIN, MEMBER, HAS_ACCOUNT, HAS_MEMBER,
  testName, escapeRe, emulatorUrl, signIn, emulatorSignIn, requestLink, emulatorLink, GREETING, createArea, newMoM, setTitle, cleanUp, areaIdFromUrl, momIdFromUrl,
};
