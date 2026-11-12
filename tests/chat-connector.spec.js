// C4/C7: only the local app and demo-workspace emulators; opens the actual links returned over MCP HTTP.
const { test, expect } = require('@playwright/test');
const { filterListeners } = require('./emu-support');

test.skip(!process.env.EMU, 'only runs under npm run test:emu');
test.use({ serviceWorkers: 'block' });

let fixture, app, db, place, http, client, saved, admin;
const editedIds = new Set();
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
  for (const id of editedIds) {
    const backups = await db.collection('mom_backups').where('momId', '==', id).get();
    await Promise.all(backups.docs.map(doc => doc.ref.delete()));
  }
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

async function signIn(page) {
  await page.goto(`${http.origin}/?emulator`);
  await page.getByLabel('Email').fill(process.env.TEST_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /^(Good (morning|afternoon|evening)|Welcome to)/ })).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => firebase.app().options.projectId)).toBe('demo-workspace');
}

async function openEditableMom(page, title) {
  const saved = await fixture.callTool(client, 'save_mom', {
    areaId: place.area.id, groupId: place.group.id, title,
    markdown: '# Agenda\n\nKeep this agenda.\n\n## Decisions\n\nOriginal browser decision.',
  });
  editedIds.add(saved.id);
  await signIn(page);
  await page.goto(emulatorLink(saved.url));
  await expect(page.getByRole('heading', { name: 'Title', exact: true })).toHaveText(title);
  const editor = page.getByRole('textbox', { name: 'Meeting notes' });
  await expect(editor).toBeEditable({ timeout: 20000 });
  await expect(editor.getByText('Original browser decision.', { exact: true })).toBeVisible();
  return { id: saved.id, ref: db.collection('moms').doc(saved.id), editor };
}

test('the admin opens saved links, sees rich notes and both files, and reopening never rewrites the MoM', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const ref = db.collection('moms').doc(saved.mom.id);
  const before = await ref.get();
  await signIn(page);

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

test('without typing, the open editor shows an appended paragraph and a replaced section through Show changes', async ({ page }) => {
  test.setTimeout(90000);
  const { id, ref, editor } = await openEditableMom(page, 'C7 live browser edits');
  const read = await fixture.callTool(client, 'read_mom', { id });
  await fixture.callTool(client, 'edit_mom', { id, expectEdited: read.edited, mode: 'append', markdown: 'C7 chat paragraph — 日本語.' });
  await page.getByRole('button', { name: 'Show changes', exact: true }).click();
  await expect(editor.getByText('C7 chat paragraph — 日本語.', { exact: true })).toBeVisible();
  await expect(editor.getByText('Keep this agenda.', { exact: true })).toBeVisible();
  const withAppend = await fixture.callTool(client, 'read_mom', { id });
  const section = withAppend.sections.find(section => section.heading === 'Decisions');
  expect(section.plain).toBe(true);
  await fixture.callTool(client, 'edit_mom', {
    id, expectEdited: withAppend.edited, mode: 'replace_section', section: section.n,
    markdown: '## Decisions\n\nC7 replacement in the open editor.',
  });
  await page.getByRole('button', { name: 'Show changes', exact: true }).click();
  await expect(editor.getByText('C7 replacement in the open editor.', { exact: true })).toBeVisible();
  await expect(editor).not.toContainText('Original browser decision');
  await expect(editor.getByText('Keep this agenda.', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
  await page.evaluate(() => db.waitForPendingWrites());
  const beforeClose = await ref.get();
  await page.close();
  const afterClose = await ref.get();
  expect(afterClose.data()).toEqual(beforeClose.data());
  expect(afterClose.updateTime.isEqual(beforeClose.updateTime)).toBe(true);
});

test('a chat append while typing is unsaved keeps both texts in stored content after autosave and reopening', async ({ page }) => {
  test.setTimeout(90000);
  const { id, ref, editor } = await openEditableMom(page, 'C7 pending browser typing');
  const read = await fixture.callTool(client, 'read_mom', { id });
  // Pause browser timers so the 800 ms autosave cannot win the race with the HTTP edit.
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('C7 typed locally before autosave.');
  await expect(editor).toContainText('C7 typed locally before autosave.');
  const unsaved = (await ref.get()).data();
  expect(unsaved.edited).toBe(read.edited);
  expect(unsaved.content).not.toContain('C7 typed locally');
  const append = await fixture.callTool(client, 'edit_mom', {
    id, expectEdited: read.edited, mode: 'append', markdown: 'C7 appended while typing.',
  });
  const chatOnly = (await ref.get()).data();
  expect(chatOnly.content).toContain('C7 appended while typing.');
  expect(chatOnly.content).not.toContain('C7 typed locally');
  await page.clock.resume();
  await expect(page.getByRole('button', { name: 'Show changes', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 20000 });
  await expect.poll(async () => (await ref.get()).data().content).toEqual(expect.stringContaining('C7 typed locally before autosave.'));
  const merged = (await ref.get()).data();
  expect(merged.content).toContain('C7 appended while typing.');
  for (const text of ['C7 typed locally before autosave.', 'C7 appended while typing.']) expect(merged.content.split(text)).toHaveLength(2);
  expect(merged.prevEdited).toBe(append.edited);
  const link = page.url();
  await page.reload();
  await expect(page).toHaveURL(link);
  const reopened = page.getByRole('textbox', { name: 'Meeting notes' });
  await expect(reopened).toContainText('C7 typed locally before autosave.');
  await expect(reopened).toContainText('C7 appended while typing.');
});
