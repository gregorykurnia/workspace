// Shared helpers for the behaviour specs (plan §8.1). Playwright runs only *.spec.js, so this file is not a test.
// Everything here goes through the UI: no test writes to Firestore directly.
const { test, expect } = require('@playwright/test');

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

/** Signs in and waits for the first screen. Skips the test when the account isn't configured (plan Q4). */
async function signIn(page, who = ADMIN) {
  const env = who === MEMBER ? 'TEST_MEMBER_EMAIL and TEST_MEMBER_PASSWORD' : 'TEST_EMAIL and TEST_PASSWORD';
  test.skip(!who.email || !who.password, `needs ${env} (plan Q4)`);
  await page.goto('/');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password', { exact: true }).fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /^(Good (morning|afternoon|evening)|Welcome to)/ })).toBeVisible({ timeout: 30000 });
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
  testName, escapeRe, signIn, createArea, newMoM, setTitle, cleanUp, areaIdFromUrl, momIdFromUrl,
};
