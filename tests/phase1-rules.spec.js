// Phase 1 end-to-end (plan 1.5): the current app (password sign-in) on the emulator with firestore.rules loaded.
// The seeded admin and member open areas, create a MoM, save a link and move both; a share-link visitor reads
// but can't write. Runs only under `npm run test:emu` (EMU=1). Every URL carries ?emulator, so nothing reaches
// the live project: a goto without it would reload the page onto the live Firebase.
const { test, expect } = require('@playwright/test');
const { filterListeners } = require('./emu-support');

const EMU = !!process.env.EMU;
const PEOPLE = [
  ['admin', process.env.TEST_EMAIL],
  ['member', process.env.TEST_MEMBER_EMAIL],
];
const PASSWORD = process.env.TEST_PASSWORD;
const AREA = { id: 'emu-area', name: 'Seeded area' };
const AREA2 = { id: 'emu-area-2', name: 'Seeded second area' };
const MOM_TITLE = 'Seeded meeting', FILE_NAME = 'Seeded link';
const GREETING = /^(Good (morning|afternoon|evening)|Welcome to)/;

test.skip(!EMU, 'only runs under npm run test:emu');
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ context }) => { await filterListeners(context); });

async function emuSignIn(page, email) {
  await page.goto('/?emulator');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: GREETING })).toBeVisible({ timeout: 30000 });
}
const go = (page, hash) => page.goto(`/?emulator#${hash}`);

/** Moves the item whose "More for <name>" button is on the page into `to` and waits for the toast. */
async function moveTo(page, name, to) {
  await page.getByRole('button', { name: `More for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Move to…' }).click();
  const dialog = page.getByRole('dialog', { name: /^Move / });
  await dialog.getByRole('combobox', { name: 'Search destinations' }).fill(to.name);
  await dialog.getByRole('option', { name: to.name }).click();
  await dialog.getByRole('button', { name: 'Move here' }).click();
  await expect(page.getByText(`Moved “${name}” to`)).toBeVisible({ timeout: 20000 });
}

for (const [who, email] of PEOPLE) {
  test(`the ${who} opens areas, creates a MoM, saves a link, and moves both`, async ({ page }) => {
    test.setTimeout(120000);   // the editor loads from esm.sh, which can take a minute when cold
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await emuSignIn(page, email);

    // Open areas: the seeded area shows its MoM and its file.
    await go(page, `/areas/${AREA.id}`);
    await expect(page.getByRole('heading', { level: 1, name: AREA.name })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(MOM_TITLE).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(FILE_NAME).first()).toBeVisible();
    await go(page, `/areas/${AREA2.id}`);
    await expect(page.getByRole('heading', { level: 1, name: AREA2.name })).toBeVisible({ timeout: 20000 });

    // Create a MoM in the first area, with a title of this person's own.
    const mom = `Phase 1 MoM by ${who}`, link = `Phase 1 link by ${who}`;
    await go(page, `/areas/${AREA.id}`);
    await page.getByRole('button', { name: 'New MoM', exact: true }).first().click();
    await expect(page.getByRole('textbox', { name: 'Meeting notes' })).toBeVisible({ timeout: 60000 });
    const heading = page.getByRole('heading', { name: 'Title' });
    await heading.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(mom);
    await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 20000 });

    // Add a file by link.
    await go(page, `/areas/${AREA.id}`);
    await page.getByRole('button', { name: 'Save link', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Save a link' });
    await dialog.getByLabel('Address').fill('https://example.com/phase-1');
    await dialog.getByLabel('Name').fill(link);
    await dialog.getByRole('button', { name: 'Save link' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(link).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(mom).first()).toBeVisible();

    // Move both into the second area, and see them there.
    await moveTo(page, mom, AREA2);
    await moveTo(page, link, AREA2);
    await go(page, `/areas/${AREA2.id}`);
    await expect(page.getByText(mom).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(link).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('a share-link visitor reads the shared area but cannot write', async ({ page, browser }) => {
  // The admin turns the share link on for the seeded area.
  await emuSignIn(page, process.env.TEST_EMAIL);
  await go(page, `/areas/${AREA.id}`);
  await page.getByRole('button', { name: `More actions for ${AREA.name}` }).click();
  await page.getByRole('menuitem', { name: 'Share a link' }).click();
  const share = page.getByRole('dialog', { name: 'Share a link' });
  await share.getByLabel('Link is on').check();
  await share.getByRole('button', { name: 'Done' }).click();
  await expect(share).toBeHidden();

  // A visitor has no account: a fresh context, signed out.
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await filterListeners(context);
  try {
    const v = await context.newPage();
    await v.goto(`/?emulator#/s/a/${AREA.id}`);
    await expect(v.getByRole('heading', { level: 1, name: AREA.name })).toBeVisible({ timeout: 30000 });
    await expect(v.getByText(MOM_TITLE).first()).toBeVisible({ timeout: 20000 });
    // The visitor is signed in anonymously, and every write comes back refused by the rules.
    expect(await v.evaluate(() => auth.currentUser && auth.currentUser.isAnonymous)).toBe(true);
    const attempts = await v.evaluate(async () => {
      const code = p => p.then(() => 'allowed', e => e.code);
      return {
        newMom: await code(db.collection('moms').doc('visitor-mom').set({ id: 'visitor-mom', folderId: 'emu-area', title: 'Visitor MoM', privateTo: null })),
        editMom: await code(db.collection('moms').doc('emu-mom').update({ title: 'Changed by a visitor' })),
        newFile: await code(db.collection('docs').doc('visitor-file').set({ id: 'visitor-file', folderId: 'emu-area', name: 'Visitor link', privateTo: null })),
        deleteArea: await code(db.collection('folders').doc('emu-area').delete()),
      };
    });
    expect(attempts).toEqual({ newMom: 'permission-denied', editMom: 'permission-denied', newFile: 'permission-denied', deleteArea: 'permission-denied' });
    await v.reload();
    await expect(v.getByText(MOM_TITLE).first()).toBeVisible({ timeout: 30000 });
    await expect(v.getByText('Changed by a visitor')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
