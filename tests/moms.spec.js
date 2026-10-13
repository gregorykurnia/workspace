// Signed-in MoMs (plan §8.1 row: moms) and the offline save pill (new behaviour tests). Needs TEST_EMAIL and TEST_PASSWORD.
const { test, expect, signIn, createArea, newMoM, setTitle, testName, cleanUp } = require('./support');

const made = [];
test.afterEach(async ({ page }) => { await cleanUp(page, { areas: made.splice(0) }); });

test('New MoM opens the editor with a dated title, ready to type', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'MoM open');
  made.push(area);
  await newMoM(page, area);
  await expect(page.getByRole('heading', { name: 'Title' })).toHaveText(/^Meeting – \d{1,2} \S+ \d{4}$/);
  await expect(page.getByRole('textbox', { name: 'Meeting notes' })).toBeEditable();
});

test('typing saves, and the pill ends on Saved', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'MoM save');
  made.push(area);
  await newMoM(page, area);
  await page.getByRole('textbox', { name: 'Meeting notes' }).click();
  await page.keyboard.type('Agenda item one.');
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 20000 });
});

test('a saved MoM appears in its area with its title', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'MoM card');
  made.push(area);
  await newMoM(page, area);
  const title = testName('Card MoM');
  await setTitle(page, title);
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 20000 });
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await expect(page.getByText(title).first()).toBeVisible();
});

test('the area filter narrows its MoMs and widens them again', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'MoM filter');
  made.push(area);
  await newMoM(page, area);
  const title = testName('Filter MoM');
  await setTitle(page, title);
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 20000 });
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  const filter = page.getByRole('searchbox', { name: 'Filter this area' });
  await filter.fill('no-such-words-here');
  await expect(page.getByText(title)).toHaveCount(0);
  await filter.fill(title);
  await expect(page.getByText(title).first()).toBeVisible();
});

test('flagging a MoM puts it in Flagged', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'MoM flag');
  made.push(area);
  await newMoM(page, area);
  const title = testName('Flagged MoM');
  await setTitle(page, title);
  await page.getByRole('button', { name: 'Flag as important' }).click();
  await expect(page.getByRole('button', { name: 'Unflag' })).toBeVisible();
  await page.goto('/#/flagged');
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20000 });
});

test('offline, the pill says "Saved on this device", then "Saved" once back online', async ({ page, context }) => {
  await signIn(page);
  const area = await createArea(page, 'MoM offline');
  made.push(area);
  await newMoM(page, area);
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 20000 });
  await context.setOffline(true);
  try {
    await page.getByRole('textbox', { name: 'Meeting notes' }).click();
    await page.keyboard.type('Written with no connection.');
    await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible({ timeout: 20000 });
  } finally {
    await context.setOffline(false);
  }
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 60000 });
});
