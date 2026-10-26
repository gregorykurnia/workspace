// Helpers for the specs that run under `npm run test:emu`. Playwright runs only *.spec.js, so this file is not a test.
// The rules refuse a list query that doesn't say which privateTo it wants (spec §D), and the current app's five
// listeners are unfiltered until plan 2.1. Until then the page is served store.js with the one filter 2.1 adds
// for a visitor-sized read (privateTo == null, which is every item here); the writes, the move stamping and the
// reads of single documents are the app's own. Delete this shim, and every use of it, in 2.1.
const FILTER_LISTENERS = /db\.collection\('(folders|moms|docs|docfolders|momfolders)'\)\.onSnapshot\(/g;
async function filterListeners(context) {
  await context.route('**/js/data/store.js', async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace(FILTER_LISTENERS, "db.collection('$1').where('privateTo','==',null).onSnapshot(");
    await route.fulfill({ response: res, body });
  });
}

module.exports = { filterListeners };
