// C4: only the local app and demo-workspace emulators; opens the actual links returned over MCP HTTP.
const { test, expect } = require('@playwright/test');
const { filterListeners } = require('./emu-support');

test.skip(!process.env.EMU, 'only runs under npm run test:emu');
test.use({ serviceWorkers: 'block' });

let fixture, app, db, place, http, client, saved, admin;
test.beforeAll(async ({ baseURL }) => {
  fixture = await import('./mcp/http.mjs');
  const { assertEmulatorEnv } = await import('./mcp/emulator-guard.mjs');
  assertEmulatorEnv();
  const { ADMIN, PROJECT } = await import('../scripts/emu/accounts.mjs');
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  admin = ADMIN;
  app = initializeApp({ projectId: PROJECT }, 'c4-browser-fixtures');
  db = getFirestore(app);
  place = await fixture.createPlace(db, 'c4-browser');
  http = await fixture.startConnector({ ownerEmail: ADMIN.email, appUrl: baseURL });
  client = await fixture.connectClient(http.origin);
  saved = await fixture.saveChat(client, place);
});
test.afterAll(async () => {
  if (client) await client.close();
  if (http) await http.close();
  if (place) await place.cleanup();
  const { deleteApp, getApps } = await import('firebase-admin/app');
  for (const app of getApps()) await deleteApp(app);
});
test.beforeEach(async ({ context }) => { await filterListeners(context, admin.uid); });

const emulatorLink = url => {
  const link = new URL(url);
  link.searchParams.set('emulator', '1');
  return link.href;
};

test('the admin opens saved links, sees rich notes and both files, and reopening never rewrites the MoM', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const ref = db.collection('moms').doc(saved.mom.id);
  const before = await ref.get();
  await page.goto(`${http.origin}/?emulator`);
  await page.getByLabel('Email').fill(process.env.TEST_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /^(Good (morning|afternoon|evening)|Welcome to)/ })).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => firebase.app().options.projectId)).toBe('demo-workspace');

  const checkEditor = async () => {
    await expect(page.getByRole('heading', { name: 'Title', exact: true })).toHaveText(fixture.NOTES.title);
    const editor = page.getByRole('textbox', { name: 'Meeting notes' });
    await expect(editor).toBeEditable({ timeout: 20000 });
    await expect(editor.getByRole('heading', { level: 1, name: 'Connector minutes' })).toBeVisible();
    await expect(editor.locator('ul > li').filter({ hasText: 'Board approved the proposal' })).toBeVisible();
    await expect(editor.locator('ul > li').filter({ hasText: '☐ Send the report' })).toBeVisible();
    await expect(editor.getByRole('table')).toBeVisible();
    await expect(editor.getByRole('columnheader', { name: 'Owner', exact: true })).toBeVisible();
    await expect(editor.getByRole('cell', { name: 'Ayu', exact: true })).toBeVisible();
  };
  await page.goto(emulatorLink(saved.mom.url));
  await checkEditor();
  // Closing the editor flushes any scheduled save, so compare server timestamps as well as the entire record.
  // Desktop uses "Done" in the top bar; phone labels its back button "Done, back to …".
  await page.getByRole('button', { name: /^Done(?:, back to .*)?$/ }).click({ timeout: 10000 });
  await expect(page).toHaveURL(new RegExp(`#/areas/${place.area.id}$`));
  await page.evaluate(() => db.waitForPendingWrites());
  for (const item of [saved.link, saved.file]) {
    await page.goto(emulatorLink(item.url));
    await expect(page.getByRole('heading', { level: 1, name: place.area.name, exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(fixture.LINK.name, { exact: true })).toBeVisible();
    await expect(page.getByText(fixture.FILE.name, { exact: true })).toBeVisible();
    await expect(page.getByText(fixture.NOTES.title, { exact: true })).toBeVisible();
  }
  await page.goto(emulatorLink(saved.mom.url));
  await checkEditor();
  await page.evaluate(() => db.waitForPendingWrites());
  await page.close(); // Leaving immediately after opening must not rewrite or normalize the saved HTML either.
  const after = await ref.get();
  expect(after.data()).toEqual(before.data());
  expect(after.updateTime.isEqual(before.updateTime)).toBe(true);
  expect(errors).toEqual([]);
});
