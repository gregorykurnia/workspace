// Screenshot capture (plan §8.2). Captures each data-independent surface from the prototype
// (redesign/design/prototype/app.html, driven through its own state) and from the build, at 390 / 900 / 1280 px in
// light and dark, then writes a side-by-side report to visual-report/index.html.
//
// Not part of the default run: `npm run capture` (or CAPTURE=1 npx playwright test tests/visual).
// Signed-in surfaces need TEST_EMAIL / TEST_PASSWORD (plan Q4) and are skipped without them.
//
// The pixel difference is measured on the two PNGs in the browser (no extra dependency). A surface is only asserted
// when its entry says `tolerance`; the number is the share of pixels allowed to differ. The build is meant to differ in
// a few places on purpose (the product name, interim copy), so the tolerance is not zero, and the report shows every
// difference for the owner's side-by-side review.
const fs = require('fs');
const path = require('path');
const { test, expect, signIn, HAS_ACCOUNT } = require('../support');

const OUT = path.join(__dirname, '..', '..', 'visual-report');
const PROTOTYPE = '/redesign/design/prototype/app.html';
const SIZES = [{ w: 390, h: 844 }, { w: 900, h: 1000 }, { w: 1280, h: 800 }];
const THEMES = ['light', 'dark'];

/**
 * proto: sets the prototype's own switches, then opens `hash`; `open` runs after (to open a dialog).
 * build: opens `hash` on the build; `auth` signs in first; `ready` is what shows when the screen is there.
 * `crop: 'dialog'` captures the dialog only (the page behind it holds data).
 */
const SURFACES = [
  {
    id: 'signin', title: 'Sign in', tolerance: 0.01,
    proto: { role: 'signedout', hash: '#/signin' },
    build: { hash: '#/signin', ready: p => p.getByRole('heading', { name: /Sign in to/ }) },
  },
  {
    id: 'reset', title: 'Reset your password', tolerance: 0.01,
    proto: { role: 'signedout', hash: '#/reset' },
    build: { hash: '#/reset', ready: p => p.getByRole('heading', { name: 'Reset your password' }) },
  },
  {
    id: 'link-unavailable', title: 'Link unavailable', tolerance: 0.01,
    proto: { role: 'visitor', hash: '#/s/a/does-not-exist' },
    build: { hash: '#/s/a/does-not-exist', ready: p => p.getByRole('heading', { name: 'This link is no longer available' }) },
  },
  {
    id: 'missing', title: 'Missing page', tolerance: 0.01,
    proto: { role: 'admin', hash: '#/nowhere' },
    build: { auth: true, hash: '#/nowhere', ready: p => p.getByRole('heading', { name: 'This page isn’t here' }) },
  },
  {
    id: 'dialog-new-area', title: 'New area dialog', tolerance: 0.02, crop: 'dialog',
    proto: { role: 'admin', hash: '#/today', open: p => p.getByRole('button', { name: 'New area' }).first().click() },
    build: { auth: true, hash: '#/today', open: p => p.getByRole('button', { name: 'New area' }).first().click(), ready: p => p.getByRole('dialog', { name: 'New area' }) },
  },
];

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

async function shoot(page, surface) {
  const opts = { animations: 'disabled', caret: 'hide' };
  if (surface.crop === 'dialog') return page.getByRole('dialog').screenshot(opts);
  return page.screenshot(opts);
}

async function capturePrototype(page, surface, theme) {
  await page.goto(PROTOTYPE);
  await page.evaluate(({ role, hash, theme }) => {
    S.theme = theme; document.documentElement.dataset.theme = theme;
    S.role = role; S.state = 'normal'; applyScenario(); renderProto(); go(hash);
  }, { ...surface.proto, theme });
  if (surface.proto.open) await surface.proto.open(page);
  await expect(surface.crop === 'dialog' ? page.getByRole('dialog') : page.locator('#view')).toBeVisible();
  // The prototype's sign-in form is pre-filled with its sample address; the build's is empty. Same surface, so clear it.
  await page.evaluate(() => { const e = document.getElementById('sEmail'); if (e) e.value = ''; });
  await page.evaluate(() => document.querySelector('#proto')?.setAttribute('hidden', ''));
  await settle(page);
  return shoot(page, surface);
}

async function captureBuild(page, surface, theme) {
  if (surface.build.auth) await signIn(page);
  else await page.goto('/');
  await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
  await page.evaluate(h => { location.hash = h; }, surface.build.hash);
  if (surface.build.open) await surface.build.open(page);
  await expect(surface.build.ready(page)).toBeVisible({ timeout: 30000 });
  await settle(page);
  return shoot(page, surface);
}

/** Share of pixels that differ by more than a small colour distance. Different sizes count as fully different. */
async function diffShare(page, a, b) {
  return page.evaluate(async ([a64, b64]) => {
    const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + src; });
    const [ia, ib] = await Promise.all([load(a64), load(b64)]);
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    const read = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#f0f'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h).data; };
    const da = read(ia), db = read(ib);
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 24) n++;
    }
    return n / (w * h);
  }, [a.toString('base64'), b.toString('base64')]);
}

// Each result is written as its own file, because Playwright starts a fresh worker after a failed test and a list kept
// in memory would be lost. The folder is emptied once per run by global-setup.js.
test.afterAll(() => {
  const rows = fs.readdirSync(OUT).filter(f => f.endsWith('.json') && f !== 'summary.json')
    .map(f => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')))
    .sort((x, y) => x.surface.localeCompare(y.surface) || x.w - y.w || x.theme.localeCompare(y.theme));
  const cell = (r, kind) => `<figure><img src="${r.files[kind]}" alt="${kind} — ${r.title}, ${r.w} px, ${r.theme}" loading="lazy"><figcaption>${kind}</figcaption></figure>`;
  const html = `<!doctype html><meta charset="utf-8"><title>Prototype and build, side by side</title>
<style>body{font:14px system-ui;margin:24px;background:#fafafa;color:#111}h2{margin:32px 0 4px}.row{display:flex;gap:16px;align-items:flex-start;margin:8px 0 24px;overflow-x:auto}
figure{margin:0;flex:none}img{max-width:100%;border:1px solid #ccc;background:#fff;display:block}figcaption{font-size:12px;color:#555;margin-top:4px}.bad{color:#b00020;font-weight:600}</style>
<h1>Prototype and build, side by side</h1><p>Generated ${new Date().toISOString()}. “Differs” is the share of pixels that are visibly different; the red ones are over their tolerance.</p>
${rows.map(r => `<h2>${r.title} · ${r.w} px · ${r.theme}</h2><p class="${r.over ? 'bad' : ''}">Differs: ${(r.share * 100).toFixed(2)}%${r.tolerance != null ? ` (tolerance ${(r.tolerance * 100).toFixed(0)}%)` : ' (reviewed by eye)'}</p><div class="row">${cell(r, 'prototype')}${cell(r, 'build')}</div>`).join('\n')}`;
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(rows.map(({ files, ...r }) => r), null, 2));
});

for (const surface of SURFACES) {
  for (const size of SIZES) {
    for (const theme of THEMES) {
      test(`${surface.title} · ${size.w} px · ${theme}`, async ({ page }) => {
        test.skip(surface.build.auth && !HAS_ACCOUNT, 'needs TEST_EMAIL and TEST_PASSWORD (plan Q4)');
        await page.setViewportSize({ width: size.w, height: size.h });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        const proto = await capturePrototype(page, surface, theme);
        const build = await captureBuild(page, surface, theme);
        const base = `${surface.id}-${size.w}-${theme}`;
        const files = { prototype: `${base}-prototype.png`, build: `${base}-build.png` };
        fs.writeFileSync(path.join(OUT, files.prototype), proto);
        fs.writeFileSync(path.join(OUT, files.build), build);
        const share = await diffShare(page, proto, build);
        const over = surface.tolerance != null && share > surface.tolerance;
        fs.writeFileSync(path.join(OUT, `${base}.json`), JSON.stringify({ surface: surface.id, title: surface.title, w: size.w, theme, share, tolerance: surface.tolerance ?? null, over, files }));
        if (surface.tolerance != null) expect(share, `${surface.title} differs from the prototype by ${(share * 100).toFixed(2)}%`).toBeLessThanOrEqual(surface.tolerance);
      });
    }
  }
}
