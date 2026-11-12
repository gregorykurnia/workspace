import { OWNER_EMAIL, SECRET, rpc, rpcResponse } from './setup.mjs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { findItems, plainText, readMom, splitSections } from '../../api/_lib/reads.mjs';
import { createHandler } from '../../api/_lib/server.mjs';

const uid = 'c5-owner', other = 'c5-other-admin';
const midnight = day => Date.parse(`${day}T00:00:00+07:00`);
const rich = '<p>Before <u>under</u> &amp; details.</p>\n<h1>Agenda</h1><ul><li>☐ Falcon agreement</li><li>☑ Done</li></ul>'
  + '<h2>Decisions</h2><table><tbody><tr><th><p>Name</p></th><th><p>Status</p></th></tr><tr><td><p>Plan</p></td><td><p>Ready</p></td></tr></tbody></table>'
  + '<p><a href="https://example.test/report">Report</a></p>'
  + '<h3>Colour</h3><p><span style="color: #ff0000">Red decision</span></p>'
  + '<h2>Image</h2><p><img src="https://example.test/chart.png" alt="Chart"></p>';
const legacy = JSON.stringify({ ops: [{ insert: 'Old Falcon\n', attributes: { header: 1 } }, { insert: { image: 'never-fetch-this' } }, null, { insert: 'Resolution\n' }] });
const refs = new Map(), hiddenMoms = [], hiddenDocs = [];
let app, db, context, handler;
const env = {
  MCP_SECRET: SECRET, WORKBENCH_OWNER_EMAIL: OWNER_EMAIL,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
};

async function seed(collection, records) {
  const batch = db.batch();
  for (const record of records) {
    const ref = db.collection(collection).doc(record.id);
    refs.set(ref.path, ref);
    batch.set(ref, { ...record, id: 'stale-stored-id' });
  }
  await batch.commit();
}
const search = args => findItems(context, { areaId: 'c5-acme', ...args });
const ids = value => value.items.map(item => item.id);
const read = id => readMom(context, { id });
const call = async (name, args, handle = handler) => (await rpcResponse(handle, rpc('tools/call', { name, arguments: args }))).data;

before(async () => {
  app = initializeApp({ projectId: 'demo-workspace' }, 'mcp-c5-fixtures');
  db = getFirestore(app);
  context = { db, owner: { uid, name: 'C5 owner' }, origin: 'https://preview.example.test' };
  handler = createHandler({ env, getContext: async () => context });
  await seed('folders', [
    { id: 'c5-root', name: 'C5 Clients' }, { id: 'c5-acme', name: 'Acme', parent: 'c5-root' },
    { id: 'c5-child', name: 'Board', parent: 'c5-acme' }, { id: 'c5-sibling', name: 'Sibling', parent: 'c5-root' },
    { id: 'c5-own', name: 'Own private', privateTo: uid }, { id: 'c5-own-child', name: 'Child', parent: 'c5-own' },
    { id: 'c5-other', name: 'Other admin', privateTo: other }, { id: 'c5-under-other', name: 'Child', parent: 'c5-other' },
    { id: 'c5-deleted', deleted: 123 }, { id: 'c5-under-deleted', parent: 'c5-deleted' },
    { id: 'c5-locked', pw: 'never-return-lock-hash' }, { id: 'c5-under-locked', parent: 'c5-locked' },
    { id: 'c5-orphan', parent: 'c5-missing' }, { id: 'c5-cycle-a', parent: 'c5-cycle-b' }, { id: 'c5-cycle-b', parent: 'c5-cycle-a' },
    { id: 'c5-blank', name: '  ' }, { id: 'c5-bad-privacy', privateTo: '' },
    { id: 'c5-bad-parent', parent: 0 }, { id: 'c5-false-parent', parent: false },
  ]);
  await seed('momfolders', [
    { id: 'c5-group', folderId: 'c5-acme', name: 'Meetings', holds: 'both' },
    { id: 'c5-other-group', folderId: 'c5-acme', name: 'Hidden grouping', privateTo: other, holds: 'both' },
    { id: 'c5-deleted-group', folderId: 'c5-acme', deleted: true, holds: 'both' },
    { id: 'c5-wrong-area', folderId: 'c5-sibling', name: 'Moved', holds: 'both' },
    { id: 'c5-mom-only', folderId: 'c5-acme', name: 'MoMs only' },
  ]);
  await seed('docfolders', [
    { id: 'c5-files', folderId: 'c5-acme', name: 'References' },
    { id: 'c5-other-files', folderId: 'c5-acme', privateTo: other },
    { id: 'c5-deleted-files', folderId: 'c5-acme', deleted: true },
  ]);
  await seed('moms', [
    { id: 'c5-meeting', folderId: 'c5-acme', momFolderId: 'c5-group', title: 'Quarterly Board', date: midnight('2026-11-12'), created: 30, edited: 123, tags: ['finance', 'FOLLOWUP'], content: rich },
    { id: 'c5-old', folderId: 'c5-child', title: 'Archive', date: midnight('2026-11-11'), content: legacy },
    { id: 'c5-sibling-mom', folderId: 'c5-sibling', title: 'Sibling meeting', date: midnight('2026-11-12') },
    { id: 'c5-own-mom', folderId: 'c5-own-child', title: 'Own private notes', privateTo: uid, content: '<p>Allowed</p>' },
  ]);
  await seed('docs', [
    { id: 'c5-file', folderId: 'c5-acme', docFolderId: 'c5-files', name: 'Budget.pdf', uploaded: true, note: 'Quarterly budget reference', url: 'https://files.example.test/budget.pdf?download=1', added: Date.parse('2026-11-12T16:59:59.999Z') },
    { id: 'c5-link', folderId: 'c5-acme', docFolderId: 'c5-group', name: 'Report', note: 'Board reference', url: 'https://docs.example.test/report', added: Date.parse('2026-11-12T17:00:00Z') },
  ]);
  const areaCases = ['c5-other', 'c5-under-other', 'c5-deleted', 'c5-under-deleted', 'c5-locked', 'c5-under-locked', 'c5-orphan', 'c5-cycle-a', 'c5-bad-privacy', 'c5-bad-parent', 'c5-false-parent', 'c5-missing', 123];
  const cases = [
    ...areaCases.map(folderId => ({ folderId })), { privateTo: other }, { privateTo: '' }, { deleted: true },
    ...['c5-other-group', 'c5-deleted-group', 'c5-wrong-area', 'c5-missing', 123, 0, false].map(momFolderId => ({ momFolderId })),
  ];
  await seed('moms', cases.map((extra, i) => {
    const id = `c5-hidden-mom-${i}`;
    hiddenMoms.push(id);
    return { id, folderId: 'c5-acme', title: 'C5 forbidden', content: '<p>C5 forbidden secret</p>', ...extra };
  }));
  const docCases = [
    ...areaCases.map(folderId => ({ folderId })), { privateTo: other }, { deleted: 123 }, { pw: 'never-return-file-lock' },
    ...['c5-other-files', 'c5-deleted-files', 'c5-other-group', 'c5-deleted-group', 'c5-wrong-area', 'c5-missing', 'c5-mom-only', 123, 0, false].map(docFolderId => ({ docFolderId })),
  ];
  await seed('docs', docCases.flatMap((extra, i) => [false, true].map(uploaded => {
    const id = `c5-hidden-doc-${i}-${uploaded}`;
    hiddenDocs.push(id);
    return { id, folderId: 'c5-acme', name: 'C5 forbidden', note: 'C5 forbidden secret', url: 'https://forbidden.example.test', uploaded, ...extra };
  })));
});

after(async () => {
  if (db && refs.size) {
    const batch = db.batch();
    for (const ref of refs.values()) batch.delete(ref);
    await batch.commit();
  }
  if (app) await deleteApp(app);
});

test('find narrows all words across title, tags, grouping, area path and body, ignoring case', async () => {
  assert.deepEqual(ids(await search({ query: 'ACME meetings board FINANCE followup' })), ['c5-meeting']);
  const found = await search({ query: 'acme quarterly falcon' });
  assert.deepEqual(ids(found), ['c5-meeting']);
  assert.equal(found.items[0].matchedIn, 'body');
  assert.match(found.items[0].snippet, /Falcon agreement/);
  assert.equal(found.items[0].path, 'C5 Clients › Acme › Meetings');
  assert.deepEqual(ids(await search({ query: 'acme archive resolution' })), ['c5-old']);
  assert.deepEqual(ids(await search({ query: 'quarterly definitely-absent' })), []);
  assert.equal((await search({ query: 'Meetings' })).items[0].matchedIn, 'place');
  const titled = (await search({ query: 'Quarterly', kind: 'mom' })).items[0];
  assert.equal(titled.matchedIn, 'title');
  assert.ok(!Object.hasOwn(titled, 'snippet'));
});

test('area includes descendants, excludes siblings, and a missing or hidden area has no matches', async () => {
  assert.deepEqual(ids(await search({ kind: 'mom' })), ['c5-meeting', 'c5-old']);
  assert.deepEqual(ids(await search({ areaId: 'c5-child' })), ['c5-old']);
  for (const areaId of ['c5-missing', 'c5-other', 'c5-locked']) assert.deepEqual(await search({ areaId }), { items: [], total: 0, hasMore: false });
});

test('inclusive Jakarta dates use the MoM date or document added time across midnight', async () => {
  assert.deepEqual(ids(await search({ from: '2026-11-12', to: '2026-11-12' })), ['c5-file', 'c5-meeting']);
  assert.deepEqual(ids(await search({ from: '2026-11-13' })), ['c5-link']);
  assert.deepEqual(ids(await search({ to: '2026-11-11' })), ['c5-old']);
  assert.equal((await search({ kind: 'file' })).items[0].date, '2026-11-12');
  assert.equal((await search({ kind: 'link' })).items[0].date, '2026-11-13');
});

test('file and link kinds carry their stored address and note without contents or lock fields', async () => {
  for (const [kind, id, address] of [['file', 'c5-file', 'https://files.example.test/budget.pdf?download=1'], ['link', 'c5-link', 'https://docs.example.test/report']]) {
    const result = await search({ kind, query: 'reference' });
    assert.deepEqual(ids(result), [id]);
    assert.equal(result.items[0].address, address);
    assert.equal(result.items[0].url, `${context.origin}/#/areas/c5-acme`);
    assert.match(result.items[0].note, /reference/);
  }
  for (const item of (await search()).items) for (const key of ['content', 'pw', 'privateTo', 'time', 'created']) assert.ok(!Object.hasOwn(item, key), key);
});

test('hidden items, groupings, ancestors and locked files are absent even from counts and body searches', async () => {
  assert.deepEqual(await findItems(context, { query: 'C5 forbidden' }), { items: [], total: 0, hasMore: false });
  const found = await findItems(context, { query: 'Own private notes' });
  assert.deepEqual(ids(found), ['c5-own-mom']);
  assert.equal((await read('c5-own-mom')).markdown, 'Allowed');
  const missing = await call('read_mom', { id: 'c5-missing' });
  assert.equal(missing.result.isError, true);
  assert.deepEqual(missing.result.content, [{ type: 'text', text: 'No MoM with that id.' }]);
  for (const id of [...hiddenMoms, ...hiddenDocs]) {
    await assert.rejects(read(id), { message: 'No MoM with that id.' });
  }
  assert.deepEqual((await call('read_mom', { id: hiddenMoms[0] })).result, missing.result);
});

test('editor HTML becomes numbered markdown sections with tables, tasks, links, colour and images', async () => {
  const result = await read('c5-meeting');
  assert.deepEqual(Object.keys(result).sort(), ['id', 'title', 'date', 'path', 'tags', 'url', 'edited', 'format', 'markdown', 'sections'].sort());
  assert.equal(result.id, 'c5-meeting');
  assert.equal(result.edited, 123);
  assert.equal(result.format, 'html');
  assert.equal(result.url, `${context.origin}/#/mom/c5-meeting`);
  assert.equal(result.date, '2026-11-12');
  assert.deepEqual(result.tags, ['finance', 'FOLLOWUP']);
  assert.deepEqual(result.sections.map(({ n, heading, plain }) => ({ n, heading, plain })), [
    { n: 0, heading: null, plain: true }, { n: 1, heading: 'Agenda', plain: true },
    { n: 2, heading: 'Decisions', plain: true }, { n: 3, heading: 'Colour', plain: false }, { n: 4, heading: 'Image', plain: false },
  ]);
  for (const text of ['<u>under</u>', '# Agenda', '- ☐ Falcon agreement', '- ☑ Done', '| Name | Status |', '| Plan | Ready', '[Report](https://example.test/report)', 'Red decision', '![Chart](https://example.test/chart.png)']) assert.ok(result.markdown.includes(text), text);
  assert.equal(splitSections(rich).map(section => section.html).join(''), rich);
  assert.ok(result.sections.every(section => !Object.hasOwn(section, 'html')));
});

test('old Delta is text without sections, formatting objects or embedded image addresses', async () => {
  const result = await read('c5-old');
  assert.equal(result.format, 'old');
  assert.equal(result.markdown, 'Old Falcon\n  Resolution');
  assert.equal(result.edited, null);
  assert.ok(!Object.hasOwn(result, 'sections'));
  assert.doesNotMatch(result.markdown, /never-fetch|attributes|header/);
});

test('plain is false for any richer element or attribute, including empty attributes and journal tables', () => {
  for (const html of ['<p style="">Colour</p>', '<p class="">Class</p>', '<p data-extra="">Data</p>', '<table><tr><td colwidth="100">Cell</td></tr></table>', '<span>Font</span>', '<mark>Highlight</mark>', '<img src="https://example.test/image.png">', '<table data-template="prospect-journal"><tr><td>Journal</td></tr></table>', '<p style="text-align:center">Centred</p>']) {
    assert.equal(splitSections(html)[0].plain, false, html);
  }
  assert.equal(splitSections('<h1>Heading</h1>')[0].markdown, '');
  assert.equal(splitSections('<blockquote><h2>Nested</h2></blockquote>').length, 1);
});

test('ordered lists keep their stored starting number alongside nested bullets', () => {
  const section = splitSections('<ol start="3"><li>Third<ul><li>Nested</li></ul></li><li>Fourth</li></ol>')[0];
  assert.equal(section.plain, true);
  assert.match(section.markdown, /^3\. Third/m);
  assert.match(section.markdown, /^4\. Fourth/m);
  assert.match(section.markdown, /- Nested/);
});

test('body text follows browser spacing, entities and inert content rules for HTML and Delta', () => {
  assert.equal(plainText('<p>One&amp;two<br>Three</p><div>Four</div><table><tr><td>Five</td><td>Six</td></tr></table><script>hidden</script><style>hidden</style><template>hidden</template><noscript>hidden</noscript>'), 'One&two Three Four Five Six');
  assert.equal(plainText(legacy), 'Old Falcon Resolution');
  assert.equal(plainText('{bad json'), '{bad json');
});

test('missing, blank and malformed stored fields stay readable; duplicate titles remain separate', async () => {
  await seed('moms', [
    { id: 'c5-empty', folderId: 'c5-blank', title: ' ', tags: { malformed: true } },
    { id: 'c5-duplicate-a', folderId: 'c5-child', title: 'Duplicate', date: '2026-11-10', content: '{malformed' },
    { id: 'c5-duplicate-b', folderId: 'c5-child', title: 'duplicate', date: 'not-a-date', content: { malformed: true } },
  ]);
  const empty = await read('c5-empty');
  assert.equal(empty.title, 'Untitled meeting'); assert.equal(empty.path, 'Untitled area');
  assert.equal(empty.date, null); assert.deepEqual(empty.tags, []);
  assert.equal(empty.markdown, ''); assert.deepEqual(empty.sections, [{ n: 0, heading: null, markdown: '', plain: true }]);
  assert.equal((await read('c5-duplicate-a')).format, 'html');
  assert.deepEqual(ids(await search({ query: 'DUPLICATE' })), ['c5-duplicate-a', 'c5-duplicate-b']);
  assert.deepEqual(ids(await search({ query: 'duplicate', from: '2026-11-10' })), ['c5-duplicate-a']);
});

test('very long bodies return only a short snippet around the first needed body word', async () => {
  await seed('moms', [{ id: 'c5-long', folderId: 'c5-child', title: 'Long note', content: `<p>${'prefix '.repeat(12000)}Needle agreement ${'suffix '.repeat(12000)}</p>` }]);
  const [item] = (await search({ query: 'long NEEDLE' })).items;
  assert.match(item.snippet, /Needle agreement/);
  assert.ok(item.snippet.length <= 122);
  assert.equal(item.snippet[0], '…');
});

test('twenty-result cap counts all matches; same-day notes use created time before random IDs', async () => {
  await seed('moms', Array.from({ length: 23 }, (_, i) => ({
    id: `c5-many-${String(23 - i).padStart(2, '0')}`, folderId: 'c5-child', title: 'C5 ordering', date: midnight('2026-11-12'), created: i,
  })));
  const result = await search({ query: 'C5 ordering' });
  assert.equal(result.total, 23); assert.equal(result.hasMore, true); assert.equal(result.items.length, 20);
  assert.deepEqual(ids(result), Array.from({ length: 20 }, (_, i) => `c5-many-${String(i + 1).padStart(2, '0')}`));
});

test('a privacy, grouping or lock change is checked afresh on both read tools', async t => {
  const area = db.collection('folders').doc('c5-acme'), group = db.collection('momfolders').doc('c5-group');
  t.after(async () => { await area.update({ privateTo: null, pw: null, deleted: false }); await group.update({ deleted: false, folderId: 'c5-acme' }); });
  for (const [ref, change, restore] of [
    [area, { privateTo: other }, { privateTo: null }], [area, { pw: 'locked-now' }, { pw: null }],
    [area, { deleted: true }, { deleted: false }], [group, { deleted: true }, { deleted: false }],
    [group, { folderId: 'c5-sibling' }, { folderId: 'c5-acme' }],
  ]) {
    await ref.update(change);
    assert.deepEqual(ids(await search({ query: 'Quarterly Board' })), []);
    await assert.rejects(read('c5-meeting'), { message: 'No MoM with that id.' });
    await ref.update(restore);
    assert.deepEqual(ids(await search({ query: 'Quarterly Board' })), ['c5-meeting']);
  }
});

test('HTTP exposes both read tools, structured results and rejects invalid inputs before loading context', async () => {
  const searchResult = await call('find_items', { query: 'quarterly falcon', areaId: 'c5-acme' });
  assert.deepEqual(JSON.parse(searchResult.result.content[0].text), searchResult.result.structuredContent);
  assert.deepEqual(ids(searchResult.result.structuredContent), ['c5-meeting']);
  assert.equal(searchResult.result.structuredContent.items[0].url, 'http://localhost/#/mom/c5-meeting');
  const readResult = await call('read_mom', { id: 'c5-meeting' });
  assert.equal(readResult.result.structuredContent.sections[3].plain, false);
  const noContext = createHandler({ env, getContext: () => { assert.fail('Invalid input reached Firebase'); } });
  for (const [name, args] of [
    ['read_mom', {}], ['read_mom', { id: ' ' }], ['read_mom', { id: 'bad/id' }], ['read_mom', { id: 'x'.repeat(1501) }],
    ['find_items', { query: 123 }], ['find_items', { areaId: ' ' }], ['find_items', { kind: 'pdf' }],
    ['find_items', { from: '2026-02-30' }], ['find_items', { from: '2026-12-01', to: '2026-11-01' }],
  ]) {
    assert.equal((await call(name, args, noContext)).error.code, -32602, JSON.stringify(args));
  }
});

test('partial database failures return no data or internal details; retries and lost replies make no writes', async () => {
  for (const [name, args] of [['find_items', { areaId: 'c5-acme', query: 'quarterly falcon' }], ['read_mom', { id: 'c5-meeting' }]]) {
    let remaining = 2;
    const flaky = createHandler({ env, getContext: async () => ({
      ...context, db: {
        collection: db.collection.bind(db),
        runTransaction: (fn, options) => db.runTransaction(transaction => fn({ get: ref => {
          if (--remaining === 0) throw new Error('private-key-and-database-address');
          return transaction.get(ref);
        } }), options),
      },
    }) });
    const before = (await db.getAll(...refs.values())).map(doc => doc.updateTime?.toMillis());
    const failed = (await call(name, args, flaky)).result;
    assert.deepEqual(failed, { isError: true, content: [{ type: 'text', text: 'Could not read Workbench items. Try again shortly.' }] });
    const retried = (await call(name, args, flaky)).result;
    assert.ok(!retried.isError);
    // Discard that reply, as if the connection closed, then read again.
    assert.deepEqual((await call(name, args)).result, retried);
    assert.deepEqual((await db.getAll(...refs.values())).map(doc => doc.updateTime?.toMillis()), before);
  }
});
