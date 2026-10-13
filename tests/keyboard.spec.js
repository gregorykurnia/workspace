// Signed-in keyboard model (plan §8.3 and the new behaviour tests): Esc order, ⌘K ↑↓↵. Needs TEST_EMAIL and TEST_PASSWORD.
const { test, expect, signIn, createArea, testName, escapeRe, cleanUp, areaIdFromUrl } = require('./support');

const made = [];
test.afterEach(async ({ page }) => { await cleanUp(page, { areas: made.splice(0) }); });

test('⌘K opens the bar, ↓ and ↵ open the chosen result', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'Palette target');
  made.push(area);
  await page.goto('/#/today');
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('combobox', { name: 'Search or jump to' });
  await expect(search).toBeVisible();
  await search.fill(area.name);
  await expect(page.getByRole('option', { name: new RegExp(escapeRe(area.name)) })).toBeVisible();
  // Down, Down, Up leaves the cursor on the first row whatever the number of matches.
  await search.press('ArrowDown');
  await search.press('ArrowDown');
  await search.press('ArrowUp');
  await search.press('Enter');
  await expect(page).toHaveURL(new RegExp(`#/areas/${escapeRe(encodeURIComponent(area.id))}$`));
});

test('Esc closes a dialog first', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'New area' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New area' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('Esc leaves Select mode after any dialog above it has closed', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'Esc select');
  made.push(area);
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Done selecting' })).toBeVisible();
  await page.getByRole('button', { name: `More actions for ${area.name}` }).click();
  await page.getByRole('menuitem', { name: 'New grouping' }).click();
  const dialog = page.getByRole('dialog', { name: 'New grouping' });
  await expect(dialog).toBeVisible();
  // First Esc: the dialog. Selection is still on.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Done selecting' })).toBeVisible();
  // Second Esc: leaves Select.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Select', exact: true })).toBeVisible();
});

test('Esc on a sub-area goes up to its parent area', async ({ page }) => {
  await signIn(page);
  const parent = await createArea(page, 'Esc parent');
  made.push(parent);
  await page.getByRole('button', { name: `More actions for ${parent.name}` }).click();
  await page.getByRole('menuitem', { name: 'New sub-area' }).click();
  const dialog = page.getByRole('dialog', { name: 'New sub-area' });
  await dialog.getByLabel('Name').fill(testName('Esc child'));
  await dialog.getByRole('button', { name: 'Create area' }).click();
  await expect(page.getByRole('heading', { level: 1, name: testName('Esc child') })).toBeVisible({ timeout: 20000 });
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(new RegExp(`#/areas/${escapeRe(encodeURIComponent(parent.id))}$`));
});
