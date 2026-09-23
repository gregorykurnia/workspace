const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

const MOVE_DOC = 'move-search-test-doc';
const MOVE_FOLDERS = [
  { id: 'move-search-alpha', name: 'Quarterly Planning', parent: null, icon: '&#128193;' },
  { id: 'move-search-beta', name: 'Customer Research', parent: null, icon: '&#128193;' },
];

test.describe('Move destination search', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.evaluate(({ docId, folders }) => {
      window.F = folders;
      window.D = [{ id: docId, name: 'Search test document', folderId: null }];
      window.DF = [];
      window.MF = [];
    }, { docId: MOVE_DOC, folders: MOVE_FOLDERS });
  });

  test('filters bulk and individual move destination lists', async ({ page }) => {
    await page.evaluate((docId) => window.openBulkMoveModal('doc', [docId]), MOVE_DOC);
    await expect(page.locator('#mv-search')).toBeVisible();
    await expect(page.locator('#mv-list .move-fi')).toHaveCount(2);

    await page.fill('#mv-search', 'quarterly');
    await expect(page.locator('[data-fid="move-search-alpha"]')).toBeVisible();
    await expect(page.locator('[data-fid="move-search-beta"]')).toBeHidden();

    await page.fill('#mv-search', 'does not exist');
    await expect(page.locator('#mv-no-results')).toHaveText('No destinations match "does not exist".');

    await page.click('#mv-c');
    await page.evaluate((docId) => window.openMoveModal('doc', docId), MOVE_DOC);
    await expect(page.locator('#mv-search')).toBeVisible();
    await page.fill('#mv-search', 'customer');
    await expect(page.locator('[data-fid="move-search-beta"]')).toBeVisible();
    await expect(page.locator('[data-fid="move-search-alpha"]')).toBeHidden();
  });
});
