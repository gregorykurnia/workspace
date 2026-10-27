// Phase 2 end-to-end (plan 2.4): private areas on the emulator with firestore.rules loaded. The seeded admin makes an
// area private; the seeded member and a share-link visitor can no longer see it, and a direct read of one of its
// MoMs is refused by the rules. A MoM moves into the private area and back out (with the warning), and the area is
// made visible again. Runs only under `npm run test:emu` (EMU=1). Every URL carries ?emulator, so nothing reaches
// the live project. It uses areas of its own (AREA_P, AREA_O in scripts/emu/accounts.mjs).
const { test, expect, emulatorSignIn } = require('./support');

const EMU = !!process.env.EMU;
const PRIVATE_AREA = { id: 'emu-area-p', name: 'Private test area', mom: { id: 'emu-mom-p', title: 'Plan for the private area' } };
const OPEN_AREA = { id: 'emu-area-o', name: 'Open test area', mom: { id: 'emu-mom-o', title: 'Notes from the open area' } };
const GREETING = /^(Good (morning|afternoon|evening)|Welcome to)/;

test.skip(!EMU, 'only runs under npm run test:emu');

const go = (page, hash) => page.goto(`/?emulator#${hash}`);

/** A fresh browser context. */
async function newPerson(browser) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  return { context, page: await context.newPage() };
}
const signIn = emulatorSignIn;
/** 'allowed' or the Firestore error code of reading one MoM by id, the way a hand-made request would. */
const readMom = (page, id) => page.evaluate(
  id => db.collection('moms').doc(id).get().then(s => (s.exists ? 'allowed' : 'missing'), e => e.code), id);
const areaMenu = async (page, area, item) => {
  await page.getByRole('button', { name: `More actions for ${area.name}` }).click();
  await page.getByRole('menuitem', { name: item }).click();
};
async function moveTo(page, name, to, { warning } = {}) {
  await page.getByRole('button', { name: `More for ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Move to…' }).click();
  const dialog = page.getByRole('dialog', { name: /^Move / });
  await dialog.getByRole('combobox', { name: 'Search destinations' }).fill(to.name);
  await dialog.getByRole('option', { name: to.name }).click();
  if (warning) await expect(dialog.getByText('This will be visible to the team.')).toBeVisible();
  else await expect(dialog.getByText('This will be visible to the team.')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Move here' }).click();
  await expect(page.getByText(`Moved “${name}” to ${to.name}`)).toBeVisible({ timeout: 20000 });
}

test('an admin makes an area private, moves a MoM in and out, and makes it visible again', async ({ browser }) => {
  test.setTimeout(240000);
  const errors = [];
  const people = [];
  try {
    const admin = await newPerson(browser); people.push(admin);
    const member = await newPerson(browser); people.push(member);
    const visitor = await newPerson(browser); people.push(visitor);
    admin.page.on('pageerror', e => errors.push(e.message));
    await signIn(admin.page, process.env.TEST_EMAIL);
    await signIn(member.page, process.env.TEST_MEMBER_EMAIL);

    await test.step('before: the area is public, and its share link works for a visitor', async () => {
      await go(admin.page, `/areas/${PRIVATE_AREA.id}`);
      await expect(admin.page.getByRole('heading', { level: 1, name: PRIVATE_AREA.name })).toBeVisible({ timeout: 20000 });
      await areaMenu(admin.page, PRIVATE_AREA, 'Share a link');
      const share = admin.page.getByRole('dialog', { name: 'Share a link' });
      await share.getByLabel('Link is on').check();
      await share.getByRole('button', { name: 'Done' }).click();
      await expect(share).toBeHidden();
      await visitor.page.goto(`/?emulator#/s/a/${PRIVATE_AREA.id}`);
      await expect(visitor.page.getByText(PRIVATE_AREA.mom.title).first()).toBeVisible({ timeout: 30000 });
      await go(member.page, `/areas/${PRIVATE_AREA.id}`);
      await expect(member.page.getByText(PRIVATE_AREA.mom.title).first()).toBeVisible({ timeout: 20000 });
      expect(await readMom(member.page, PRIVATE_AREA.mom.id)).toBe('allowed');
    });

    await test.step('the admin makes it private', async () => {
      await areaMenu(admin.page, PRIVATE_AREA, 'Make private');
      const dialog = admin.page.getByRole('dialog', { name: `Make “${PRIVATE_AREA.name}” private?` });
      await dialog.getByRole('button', { name: 'Make private' }).click();
      await expect(admin.page.getByText(`“${PRIVATE_AREA.name}” is private. Only you can see it.`)).toBeVisible({ timeout: 20000 });
      // Still the admin's own, with its MoM, and Share is gone from the menu.
      await expect(admin.page.getByText(PRIVATE_AREA.mom.title).first()).toBeVisible();
      await admin.page.getByRole('button', { name: `More actions for ${PRIVATE_AREA.name}` }).click();
      await expect(admin.page.getByRole('menuitem', { name: 'Make visible to the team' })).toBeVisible();
      await expect(admin.page.getByRole('menuitem', { name: 'Share a link' })).toHaveCount(0);
      await admin.page.keyboard.press('Escape');
    });

    await test.step('the member and the visitor can no longer see it, and the rules refuse a direct read', async () => {
      await go(member.page, '/today');
      await member.page.reload();
      await go(member.page, `/areas/${PRIVATE_AREA.id}`);
      await expect(member.page.getByRole('heading', { name: 'This area isn’t here' })).toBeVisible({ timeout: 30000 });
      await expect(member.page.getByText(PRIVATE_AREA.mom.title)).toHaveCount(0);
      expect(await readMom(member.page, PRIVATE_AREA.mom.id)).toBe('permission-denied');
      // The other areas are untouched.
      await go(member.page, `/areas/${OPEN_AREA.id}`);
      await expect(member.page.getByText(OPEN_AREA.mom.title).first()).toBeVisible({ timeout: 20000 });

      await visitor.page.reload();
      await expect(visitor.page.getByText(PRIVATE_AREA.mom.title)).toHaveCount(0);
      await expect(visitor.page.getByRole('heading', { level: 1, name: PRIVATE_AREA.name })).toHaveCount(0);
      expect(await visitor.page.evaluate(() => auth.currentUser && auth.currentUser.isAnonymous)).toBe(true);
      expect(await readMom(visitor.page, PRIVATE_AREA.mom.id)).toBe('permission-denied');
    });

    await test.step('moving a MoM into the private area hides it; moving it out shows it, with a warning', async () => {
      await go(admin.page, `/areas/${OPEN_AREA.id}`);
      await expect(admin.page.getByText(OPEN_AREA.mom.title).first()).toBeVisible({ timeout: 20000 });
      await moveTo(admin.page, OPEN_AREA.mom.title, PRIVATE_AREA);
      await expect.poll(() => readMom(member.page, OPEN_AREA.mom.id), { timeout: 20000 }).toBe('permission-denied');
      await go(member.page, `/areas/${OPEN_AREA.id}`);
      await member.page.reload();
      await expect(member.page.getByRole('heading', { level: 1, name: OPEN_AREA.name })).toBeVisible({ timeout: 30000 });
      await expect(member.page.getByText(OPEN_AREA.mom.title)).toHaveCount(0);

      await go(admin.page, `/areas/${PRIVATE_AREA.id}`);
      await expect(admin.page.getByText(OPEN_AREA.mom.title).first()).toBeVisible({ timeout: 20000 });
      await moveTo(admin.page, OPEN_AREA.mom.title, OPEN_AREA, { warning: true });
      await expect.poll(() => readMom(member.page, OPEN_AREA.mom.id), { timeout: 20000 }).toBe('allowed');
      await member.page.reload();
      await expect(member.page.getByText(OPEN_AREA.mom.title).first()).toBeVisible({ timeout: 30000 });
      // The MoM that stayed behind is still private.
      expect(await readMom(member.page, PRIVATE_AREA.mom.id)).toBe('permission-denied');
    });

    await test.step('making the area visible again brings it and its MoM back for the member; the share link stays off', async () => {
      await go(admin.page, `/areas/${PRIVATE_AREA.id}`);
      await expect(admin.page.getByRole('heading', { level: 1, name: PRIVATE_AREA.name })).toBeVisible({ timeout: 20000 });
      await areaMenu(admin.page, PRIVATE_AREA, 'Make visible to the team');
      const dialog = admin.page.getByRole('dialog', { name: `Make “${PRIVATE_AREA.name}” visible to the team?` });
      await dialog.getByRole('button', { name: 'Make visible' }).click();
      await expect(admin.page.getByText(`“${PRIVATE_AREA.name}” is visible to the team again.`)).toBeVisible({ timeout: 20000 });

      await expect.poll(() => readMom(member.page, PRIVATE_AREA.mom.id), { timeout: 20000 }).toBe('allowed');
      await go(member.page, `/areas/${PRIVATE_AREA.id}`);
      await member.page.reload();
      await expect(member.page.getByRole('heading', { level: 1, name: PRIVATE_AREA.name })).toBeVisible({ timeout: 30000 });
      await expect(member.page.getByText(PRIVATE_AREA.mom.title).first()).toBeVisible({ timeout: 20000 });

      // Public again, but the link was turned off when it went private and stays off.
      await visitor.page.reload();
      await expect(visitor.page.getByText(PRIVATE_AREA.mom.title)).toHaveCount(0);
    });
    expect(errors).toEqual([]);
  } finally {
    for (const p of people) await p.context.close();
  }
});
