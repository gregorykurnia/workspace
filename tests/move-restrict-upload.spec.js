// Signed-in: Move, Undo, restricted areas and upload failures (plan §8.1 row: move-search; new behaviour tests).
// Needs TEST_EMAIL and TEST_PASSWORD.
const { test, expect, signIn, createArea, newMoM, setTitle, testName, escapeRe, cleanUp } = require('./support');

const RESTRICT_PW = 'test-pass-123';
const made = [];
test.afterEach(async ({ page }) => { await cleanUp(page, { areas: made.splice(0), pw: RESTRICT_PW }); });

/** Saves a MoM with the given title in an area, then returns to the area page. */
async function savedMoM(page, area, title) {
  await newMoM(page, area);
  await setTitle(page, title);
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 20000 });
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await expect(page.getByText(title).first()).toBeVisible();
}

test('Move dialog search filters the destinations, and says when none match', async ({ page }) => {
  await signIn(page);
  const from = await createArea(page, 'Move from');
  const to = await createArea(page, 'Move to');
  made.push(from, to);
  await savedMoM(page, from, testName('Move search MoM'));
  await page.getByRole('button', { name: `More for ${testName('Move search MoM')}` }).click();
  await page.getByRole('menuitem', { name: 'Move to…' }).click();
  const dialog = page.getByRole('dialog', { name: /^Move / });
  const search = dialog.getByRole('combobox', { name: 'Search destinations' });
  await search.fill('zz-no-such-place');
  await expect(dialog.getByText('No destination matches')).toBeVisible();
  await search.fill(to.name);
  await expect(dialog.getByRole('option', { name: new RegExp(escapeRe(to.name)) })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('a moved MoM goes to its new area, and Undo brings it back', async ({ page }) => {
  await signIn(page);
  const from = await createArea(page, 'Undo from');
  const to = await createArea(page, 'Undo to');
  made.push(from, to);
  const title = testName('Undo MoM');
  await savedMoM(page, from, title);
  await page.getByRole('button', { name: `More for ${title}` }).click();
  await page.getByRole('menuitem', { name: 'Move to…' }).click();
  const dialog = page.getByRole('dialog', { name: /^Move / });
  await dialog.getByRole('combobox', { name: 'Search destinations' }).fill(to.name);
  await dialog.getByRole('option', { name: new RegExp(escapeRe(to.name)) }).click();
  await dialog.getByRole('button', { name: 'Move here' }).click();
  await expect(page.getByText(`Moved “${title}” to`)).toBeVisible();
  const undo = page.getByRole('button', { name: 'Undo', exact: true });   // not "More actions for … Undo from"
  await expect(undo).toBeVisible();
  await undo.click();
  await page.goto(`/#/areas/${encodeURIComponent(from.id)}`);
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });
});

test('several selected MoMs move together, and the bar says how many', async ({ page }) => {
  await signIn(page);
  const from = await createArea(page, 'Bulk from');
  const to = await createArea(page, 'Bulk to');
  made.push(from, to);
  const a = testName('Bulk one'), b = testName('Bulk two');
  await savedMoM(page, from, a);
  await savedMoM(page, from, b);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  // The box is drawn on the card and lets clicks through (pointer-events: none): the card takes them.
  await page.getByRole('checkbox', { name: `Select ${a}` }).click({ force: true });
  await page.getByRole('checkbox', { name: `Select ${b}` }).click({ force: true });
  const bar = page.getByRole('region', { name: 'Selection' });
  await expect(bar.getByText('2 selected')).toBeVisible();
  await bar.getByRole('button', { name: 'Move…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Move 2 items' });
  await dialog.getByRole('combobox', { name: 'Search destinations' }).fill(to.name);
  await dialog.getByRole('option', { name: new RegExp(escapeRe(to.name)) }).click();
  await dialog.getByRole('button', { name: 'Move here' }).click();
  await expect(page.getByText('Moved 2 items to')).toBeVisible();
  await page.goto(`/#/areas/${encodeURIComponent(to.id)}`);
  await expect(page.getByText(a).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(b).first()).toBeVisible();
});

test('a restricted area asks for its password, and Lock again locks it', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'Restricted gate');
  made.push(area);
  await page.getByRole('button', { name: `More actions for ${area.name}` }).click();
  await page.getByRole('menuitem', { name: 'Restrict with password' }).click();
  const dialog = page.getByRole('dialog', { name: 'Restrict with a password' });
  await dialog.getByLabel('Password', { exact: true }).fill(RESTRICT_PW);
  await dialog.getByLabel('Type it again').fill(RESTRICT_PW);
  await dialog.getByRole('button', { name: 'Restrict', exact: true }).click();
  await expect(page.getByText('Restricted with a password')).toBeVisible();
  await expect(dialog).toBeHidden();   // it fades out with its own "Password" field still in the page

  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await expect(page.getByRole('heading', { name: `${area.name} is restricted` })).toBeVisible({ timeout: 20000 });
  const open = page.getByRole('button', { name: `Open ${area.name}`, exact: true });
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await open.click();
  await expect(page.getByText('That password isn’t right. Try again.')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(RESTRICT_PW);
  await open.click();
  await expect(page.getByRole('button', { name: 'Lock again' })).toBeVisible({ timeout: 20000 });

  await page.getByRole('button', { name: 'Lock again' }).click();
  await expect(page.getByText('Locked again')).toBeVisible();
  await expect(page.getByRole('heading', { name: `${area.name} is restricted` })).toBeVisible();
});

test('nothing inside a restricted area appears in search', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'Restricted search');
  made.push(area);
  const title = testName('Hidden MoM');
  await savedMoM(page, area, title);
  await page.getByRole('button', { name: `More actions for ${area.name}` }).click();
  await page.getByRole('menuitem', { name: 'Restrict with password' }).click();
  const dialog = page.getByRole('dialog', { name: 'Restrict with a password' });
  await dialog.getByLabel('Password', { exact: true }).fill(RESTRICT_PW);
  await dialog.getByLabel('Type it again').fill(RESTRICT_PW);
  await dialog.getByRole('button', { name: 'Restrict', exact: true }).click();
  await expect(page.getByText('Restricted with a password')).toBeVisible();
  // The toast comes before the password reaches this page's copy of the area: wait for the gate.
  await expect(page.getByRole('heading', { name: `${area.name} is restricted` })).toBeVisible({ timeout: 20000 });

  await page.goto('/#/today');
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('combobox', { name: 'Search or jump to' });
  await search.fill(title);
  await expect(page.getByText(`No matches for “${title}”`)).toBeVisible();
  // A MoM row starts with its title; the "New MoM ‘…’" action only echoes what was typed.
  await expect(page.getByRole('option', { name: new RegExp(`^${escapeRe(title)}`) })).toHaveCount(0);
});

test('a blocked file type is refused before anything is sent', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'Upload blocked');
  made.push(area);
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await page.getByRole('button', { name: 'Upload', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Upload a file' });
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Choose a file, or drop one here' }).click();
  (await chooser).setFiles({ name: 'blocked.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('not sent') });
  await expect(dialog.getByText(/This file type isn’t allowed in/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save as link instead' })).toBeVisible();
});

test('a PDF over 10 MB is refused before anything is sent', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'Upload big');
  made.push(area);
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await page.getByRole('button', { name: 'Upload', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Upload a file' });
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Choose a file, or drop one here' }).click();
  (await chooser).setFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(11 * 1024 * 1024) });
  await expect(dialog.getByText(/PDFs over about 10 MB can’t be uploaded yet/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save as link instead' })).toBeVisible();
});
