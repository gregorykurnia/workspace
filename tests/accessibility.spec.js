// Accessibility and keyboard checks (plan §8.3): axe on each screen and dialog in both themes (no serious or critical
// issue), a visible focus indicator on every Tab stop, Enter on a short form, and 44 px touch targets at 390 px.
// The signed-out screens run in every configuration; the signed-in ones need TEST_EMAIL and TEST_PASSWORD (plan Q4).
// Nothing here writes data: the signed-in checks only open pages and dialogs.
const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect, signIn, HAS_ACCOUNT } = require('./support');

const THEMES = ['light', 'dark'];

/** Signed-out screens: where they are and what shows when they're ready. */
const OPEN_SCREENS = [
  { name: 'Sign in', hash: '#/signin', ready: p => p.getByRole('heading', { name: /Sign in to/ }) },
  { name: 'Link unavailable', hash: '#/s/a/does-not-exist', ready: p => p.getByRole('heading', { name: 'This link is no longer available' }) },
];

/** Signed-in screens that only read data. `open` (optional) opens a layer on top of the page. */
const SIGNED_IN_SCREENS = [
  { name: 'Today', hash: '#/today', ready: p => p.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ }) },
  { name: 'All areas', hash: '#/areas', ready: p => p.getByRole('heading', { level: 1, name: 'All areas' }) },
  { name: 'Flagged', hash: '#/flagged', ready: p => p.getByRole('heading', { level: 1, name: 'Flagged' }) },
  { name: 'Recent', hash: '#/recent', ready: p => p.getByRole('heading', { level: 1, name: 'Recent' }) },
  { name: 'Deleted', hash: '#/deleted', ready: p => p.getByRole('heading', { level: 1, name: 'Deleted' }) },
  { name: 'Account', hash: '#/account', ready: p => p.getByRole('heading', { level: 1, name: 'Account' }) },
  { name: 'Missing page', hash: '#/nowhere', ready: p => p.getByRole('heading', { name: 'This page isn’t here' }) },
  {
    name: 'New area dialog', hash: '#/today', ready: p => p.getByRole('dialog', { name: 'New area' }),
    open: p => p.getByRole('button', { name: 'New area' }).first().click(),
  },
  {
    name: 'Command bar', hash: '#/today', ready: p => p.getByRole('combobox', { name: 'Search or jump to' }),
    open: p => p.keyboard.press('ControlOrMeta+k'),
  },
];

async function setTheme(page, theme) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
}

async function openScreen(page, screen, theme) {
  await page.goto('/');
  await setTheme(page, theme);
  await page.evaluate(h => { location.hash = h; }, screen.hash);
  await expect(screen.ready(page)).toBeVisible({ timeout: 30000 });
  if (screen.open) {
    await screen.open(page);
    await expect(screen.ready(page)).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
}

async function openSignedIn(page, screen, theme) {
  await signIn(page);
  await setTheme(page, theme);
  await page.evaluate(h => { location.hash = h; }, screen.hash);
  await expect(screen.ready(page)).toBeVisible({ timeout: 30000 });
  if (screen.open) {
    await screen.open(page);
    await expect(screen.ready(page)).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
}

/** Runs axe on the page as it is, and fails on serious or critical issues with a readable list. */
async function expectNoSeriousIssues(page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const bad = violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  const report = bad.map(v => `${v.impact} · ${v.id}: ${v.help}\n    ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join('\n    ')}`).join('\n');
  expect(bad, `axe found:\n${report}`).toEqual([]);
}

/**
 * Puts the Tab starting point at the top of the page. After a screen change the browser's starting point can sit in
 * an element that is gone (the first Tab then lands nowhere), or in the field that was focused (Tab skips what's above).
 */
async function resetFocusStart(page) {
  await page.evaluate(() => {
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });
}

/**
 * Tabs through the page (or the open dialog) and returns the stops that show no change when focused. A stop counts as
 * showing focus when its outline, shadow, border, background, position or opacity differs from the same element unfocused.
 */
async function stopsWithoutFocusIndicator(page, maxStops = 60) {
  const bad = [];
  const seen = new Set();
  await resetFocusStart(page);
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const sig = e => { const c = getComputedStyle(e); return [c.outlineStyle, c.outlineWidth, c.boxShadow, c.borderColor, c.backgroundColor, c.textDecorationLine, c.top, c.opacity].join('|'); };
      const label = `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role=${el.getAttribute('role')}]` : ''} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '').trim().slice(0, 40)}"`;
      const key = label + '@' + Math.round(el.getBoundingClientRect().top) + ',' + Math.round(el.getBoundingClientRect().left);
      const focused = sig(el);
      const visible = el.matches(':focus-visible');
      el.blur();
      const unfocused = sig(el);
      el.focus();
      return { key, label, visible, changed: focused !== unfocused };
    });
    if (!stop || seen.has(stop.key)) break;
    seen.add(stop.key);
    if (!stop.visible || !stop.changed) bad.push(stop.label);
  }
  return { bad, stops: seen.size };
}

// --- axe ---------------------------------------------------------------------------------------------------------

test.describe('axe: no serious or critical issues', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', 'one viewport is enough for the rule checks'); });
  for (const theme of THEMES) {
    for (const screen of OPEN_SCREENS) {
      test(`${screen.name} · ${theme}`, async ({ page }) => {
        await openScreen(page, screen, theme);
        await expectNoSeriousIssues(page);
      });
    }
    for (const screen of SIGNED_IN_SCREENS) {
      test(`${screen.name} · ${theme} (signed in)`, async ({ page }) => {
        test.skip(!HAS_ACCOUNT, 'needs TEST_EMAIL and TEST_PASSWORD (plan Q4)');
        await openSignedIn(page, screen, theme);
        await expectNoSeriousIssues(page);
      });
    }
  }
});

// --- keyboard ----------------------------------------------------------------------------------------------------

test.describe('keyboard: every Tab stop shows focus', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'chromium', 'keyboard model is checked on the desktop viewport'); });
  for (const screen of OPEN_SCREENS) {
    test(`${screen.name}`, async ({ page }) => {
      await openScreen(page, screen, 'light');
      const { bad, stops } = await stopsWithoutFocusIndicator(page);
      expect(stops, 'the page has something to tab to').toBeGreaterThan(0);
      expect(bad, `stops with no visible focus: ${bad.join(', ')}`).toEqual([]);
    });
  }
  for (const screen of SIGNED_IN_SCREENS) {
    test(`${screen.name} (signed in)`, async ({ page }) => {
      test.skip(!HAS_ACCOUNT, 'needs TEST_EMAIL and TEST_PASSWORD (plan Q4)');
      await openSignedIn(page, screen, 'light');
      const { bad, stops } = await stopsWithoutFocusIndicator(page);
      expect(stops, 'the page has something to tab to').toBeGreaterThan(0);
      expect(bad, `stops with no visible focus: ${bad.join(', ')}`).toEqual([]);
    });
  }

  test('Enter submits the short sign-in form', async ({ page }) => {
    await openScreen(page, OPEN_SCREENS[0], 'light');
    await page.getByLabel('Email').press('Enter');
    await expect(page.getByText('Enter your email address.')).toBeVisible();
  });

  test('the skip link is the first stop and moves focus to the content', async ({ page }) => {
    await openScreen(page, OPEN_SCREENS[0], 'light');
    await resetFocusStart(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('#view')).toBeFocused();
  });
});

// --- touch targets -----------------------------------------------------------------------------------------------

test.describe('touch targets: at least 44 × 44 px on a phone', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'phone', 'only meaningful at 390 px with touch'); });

  /** Visible interactive elements smaller than 44 px in either direction. A control inside a label counts as the label. */
  async function smallTargets(page) {
    return page.evaluate(() => {
      const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=menuitem], [role=tab], [role=option], [role=checkbox], [role=radio], [role=switch], [contenteditable=true]';
      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden]') || el.closest('[aria-hidden="true"]')) continue;
        if (el.classList.contains('skip')) continue;   // the skip link only shows on focus
        if (el.tagName === 'A' && el.closest('p, li') && !el.classList.contains('btn')) continue;   // a link inside a sentence is exempt
        const box = (el.closest('label') || el).getBoundingClientRect();
        if (!box.width || !box.height) continue;
        if (box.width < 43.5 || box.height < 43.5) {
          out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '').trim().slice(0, 40)}" ${Math.round(box.width)}×${Math.round(box.height)}`);
        }
      }
      return out;
    });
  }

  for (const screen of OPEN_SCREENS) {
    test(`${screen.name}`, async ({ page }) => {
      await openScreen(page, screen, 'light');
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'the page sees a coarse pointer').toBe(true);
      expect(await smallTargets(page)).toEqual([]);
    });
  }
  for (const screen of SIGNED_IN_SCREENS) {
    test(`${screen.name} (signed in)`, async ({ page }) => {
      test.skip(!HAS_ACCOUNT, 'needs TEST_EMAIL and TEST_PASSWORD (plan Q4)');
      await openSignedIn(page, screen, 'light');
      expect(await smallTargets(page)).toEqual([]);
    });
  }
});
