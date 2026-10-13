// Signed-in: sign-in, the shell, and areas (plan §8.1 rows: auth, sidebar, folders). Needs TEST_EMAIL and TEST_PASSWORD.
const { test, expect, signIn, createArea, testName, cleanUp, areaIdFromUrl } = require('./support');

const made = [];
test.afterEach(async ({ page }) => { await cleanUp(page, { areas: made.splice(0) }); });

test('sign in lands on Today, with Today marked as the current page', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/#\/today$/);
  const today = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Today' });
  await expect(today).toHaveAttribute('aria-current', 'page');
});

test('the sidebar is visible at 1280 px', async ({ page }) => {
  test.skip(page.viewportSize().width < 900, 'sidebar is a drawer on phones');
  await signIn(page);
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Recovery' })).toBeVisible();
});

test('the sync pill reads "Up to date" when connected', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('status').filter({ hasText: 'Up to date' })).toBeVisible({ timeout: 20000 });
});

test('Deleted opens from the sidebar', async ({ page }) => {
  test.skip(page.viewportSize().width < 900, 'sidebar is a drawer on phones');
  await signIn(page);
  await page.getByRole('navigation', { name: 'Recovery' }).getByRole('link', { name: 'Deleted' }).click();
  await expect(page).toHaveURL(/#\/deleted$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Deleted' })).toBeVisible();
});

test('New area creates an area with the chosen emoji at the top level', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'New area' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New area' });
  await expect(dialog.getByRole('radio')).not.toHaveCount(0);
  await dialog.getByLabel('Name').fill(testName('Area emoji'));
  const pick = dialog.getByRole('radio').nth(1);
  await pick.click();
  await expect(pick).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByLabel('Location')).toHaveValue('');   // "Top level"
  await dialog.getByRole('button', { name: 'Create area' }).click();
  await expect(page.getByRole('heading', { level: 1, name: testName('Area emoji') })).toBeVisible({ timeout: 20000 });
  made.push({ id: areaIdFromUrl(page), name: testName('Area emoji') });
});

test('an empty area name is refused in the dialog', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'New area' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New area' });
  await dialog.getByRole('button', { name: 'Create area' }).click();
  await expect(dialog.getByText('Give the area a name, so you can find it later.')).toBeVisible();
  await expect(dialog).toBeVisible();
});

test('an open area shows its header and sections', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'Area sections');
  made.push(area);
  await expect(page.getByRole('button', { name: 'New MoM', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Meeting notes/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Files and links/ })).toBeVisible();
});

test('an area\'s menu creates a sub-area inside it', async ({ page }) => {
  await signIn(page);
  const parent = await createArea(page, 'Area parent');
  made.push(parent);
  await page.getByRole('button', { name: `More actions for ${parent.name}` }).click();
  await page.getByRole('menuitem', { name: 'New sub-area' }).click();
  const dialog = page.getByRole('dialog', { name: 'New sub-area' });
  await dialog.getByLabel('Name').fill(testName('Sub area'));
  await dialog.getByRole('button', { name: 'Create area' }).click();
  await expect(page.getByRole('heading', { level: 1, name: testName('Sub area') })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Sub-area', { exact: false }).first()).toBeVisible();
  await page.goto(`/#/areas/${encodeURIComponent(parent.id)}`);
  await expect(page.getByRole('heading', { name: /^Sub-areas/ })).toBeVisible();
  await expect(page.getByText(testName('Sub area')).first()).toBeVisible();
});
