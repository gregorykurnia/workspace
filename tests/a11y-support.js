// Accessibility helpers shared by accessibility.spec.js (live site) and signin-a11y.spec.js (emulator), plan §8.3.
// Playwright runs only *.spec.js, so this file is not a test.
const AxeBuilder = require('@axe-core/playwright').default;
const { expect } = require('@playwright/test');

async function setTheme(page, theme) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
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
 * showing focus when its outline, shadow, border, background, position or opacity differs from the same element unfocused,
 * or, for a field (base.css clears the ring on every input), its parent's does: the command bar's box draws it with
 * :focus-within.
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
      const box = el.matches('input, select, textarea') && el.parentElement || el;
      const focused = sig(el) + '/' + sig(box);
      const visible = el.matches(':focus-visible');
      el.blur();
      const unfocused = sig(el) + '/' + sig(box);
      el.focus();
      return { key, label, visible, changed: focused !== unfocused };
    });
    if (!stop || seen.has(stop.key)) break;
    seen.add(stop.key);
    if (!stop.visible || !stop.changed) bad.push(stop.label);
  }
  return { bad, stops: seen.size };
}

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

module.exports = { setTheme, expectNoSeriousIssues, resetFocusStart, stopsWithoutFocusIndicator, smallTargets };
