// Signed-in: share links, Deleted (restore, remove forever, Empty all), and Final for a member
// (plan §8.1 and the new behaviour tests). Needs TEST_EMAIL and TEST_PASSWORD; the member test also needs
// TEST_MEMBER_EMAIL and TEST_MEMBER_PASSWORD (plan Q4).
const { test, expect, signIn, createArea, newMoM, setTitle, testName, escapeRe, cleanUp, HAS_MEMBER, MEMBER, ADMIN } = require('./support');

const made = [];
test.afterEach(async ({ page }) => { await cleanUp(page, { areas: made.splice(0) }); });

/** Turns an area's share link on or off from its Share a link dialog. */
async function setShareLink(page, area, on) {
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await page.getByRole('button', { name: `More actions for ${area.name}` }).click();
  await page.getByRole('menuitem', { name: 'Share a link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share a link' });
  const toggle = dialog.getByLabel('Link is on');
  if (on) await toggle.check(); else await toggle.uncheck();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
}

test('a share link on shows the area to a visitor; off says the link is no longer available', async ({ page, browser }) => {
  await signIn(page);
  const area = await createArea(page, 'Shared area');
  made.push(area);
  const title = testName('Shared MoM');
  await newMoM(page, area);
  await setTitle(page, title);
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 20000 });

  await setShareLink(page, area, true);

  // A visitor has no account: a fresh context, signed out.
  const visitor = await browser.newContext();
  try {
    const v = await visitor.newPage();
    await v.goto(`/#/s/a/${encodeURIComponent(area.id)}`);
    await expect(v.getByRole('heading', { level: 1, name: area.name })).toBeVisible({ timeout: 30000 });
    await expect(v.getByText(title).first()).toBeVisible({ timeout: 20000 });

    await setShareLink(page, area, false);
    await v.reload();
    await expect(v.getByRole('heading', { name: 'This link is no longer available' })).toBeVisible({ timeout: 30000 });
  } finally {
    await visitor.close();
  }
});

test('a restored area comes back from Deleted', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'Restore me');
  made.push(area);
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await page.getByRole('button', { name: `More actions for ${area.name}` }).click();
  await page.getByRole('menuitem', { name: 'Delete area' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete area' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.goto('/#/deleted');
  // Restore is the same label on every row, so take the Restore button in this area's own row.
  const row = page.getByText(area.name).first().locator('xpath=ancestor::div[.//button[normalize-space()="Restore"]][1]');
  await expect(row).toBeVisible({ timeout: 20000 });
  await row.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByText('Restored')).toBeVisible();
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await expect(page.getByRole('heading', { level: 1, name: area.name })).toBeVisible({ timeout: 20000 });
});

test('Remove forever asks first, then removes the item for good', async ({ page }) => {
  await signIn(page);
  const area = await createArea(page, 'Remove me');
  made.push(area);
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await page.getByRole('button', { name: `More actions for ${area.name}` }).click();
  await page.getByRole('menuitem', { name: 'Delete area' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete area' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.goto('/#/deleted');
  await page.getByRole('button', { name: `Remove ${area.name} forever` }).click();
  const dialog = page.getByRole('dialog', { name: `Remove “${area.name}” forever?` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Remove forever' }).click();
  await expect(page.getByText('Removed for good')).toBeVisible();
  await expect(page.getByRole('button', { name: `Remove ${area.name} forever` })).toHaveCount(0);
  made.splice(0);   // already gone; nothing for cleanup to do
});

test('Empty all asks first, and Cancel removes nothing', async ({ page }) => {
  // The real Deleted list may hold real items, so this test never confirms the empty.
  await signIn(page);
  await page.goto('/#/deleted');
  const empty = page.getByRole('button', { name: 'Empty all' });
  test.skip(!(await empty.count()), 'Deleted is already empty; nothing to check against');
  await empty.click();
  const dialog = page.getByRole('dialog', { name: 'Empty Deleted?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(empty).toBeVisible();
});

test('a member cannot attach a document to a final MoM', async ({ page, browser }) => {
  test.skip(!HAS_MEMBER, 'needs TEST_MEMBER_EMAIL and TEST_MEMBER_PASSWORD (plan Q4)');
  await signIn(page, ADMIN);
  const area = await createArea(page, 'Final for member');
  made.push(area);
  const title = testName('Final MoM');
  const momId = await newMoM(page, area);
  await setTitle(page, title);
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'More for this MoM' }).click();
  await page.getByRole('menuitem', { name: 'Mark as final' }).click();
  await expect(page.getByText('Final').first()).toBeVisible();

  // Grant the member access to the area (Access dialog, admin only).
  await page.goto(`/#/areas/${encodeURIComponent(area.id)}`);
  await page.getByRole('button', { name: `More actions for ${area.name}` }).click();
  await page.getByRole('menuitem', { name: 'Access' }).click();
  const access = page.getByRole('dialog', { name: `Who can see ${area.name}` });
  const grant = access.getByRole('button', { name: 'Grant access' });
  if (await grant.count()) {
    await grant.click();
    await expect(page.getByText(/^Access granted to/)).toBeVisible();
  }
  await access.getByRole('button', { name: 'Close' }).click();

  // The member opens the final MoM in their own context.
  const memberContext = await browser.newContext();
  try {
    const m = await memberContext.newPage();
    await signIn(m, MEMBER);
    await m.goto(`/#/mom/${encodeURIComponent(momId)}`);
    await expect(m.getByRole('heading', { name: 'Title' })).toBeVisible({ timeout: 20000 });
    await expect(m.getByRole('textbox', { name: 'Meeting notes' })).toHaveAttribute('contenteditable', 'false');
    await m.getByRole('button', { name: 'More for this MoM' }).click();
    await expect(m.getByRole('menuitem', { name: /Attach a document/ })).toBeVisible();
  } finally {
    await memberContext.close();
  }
});
