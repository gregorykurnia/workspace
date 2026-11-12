import { OWNER_EMAIL, OWNER_UID, SECRET, request, rpc, rpcResponse } from './setup.mjs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHandler } from '../../api/_lib/server.mjs';
import { listPlaces } from '../../api/_lib/places.mjs';
import { MAX_CONTENT_BYTES, markdownToHtml, saveLink, saveMom } from '../../api/_lib/saves.mjs';

const otherUid = 'c2-other-admin';
const areas = [
  { id: 'c2-root', name: 'Clients' },
  { id: 'c2-area', name: 'Acme', parent: 'c2-root' },
  { id: 'c2-private', name: 'Planning', privateTo: OWNER_UID },
  { id: 'c2-other', name: 'Other admin', privateTo: otherUid },
  { id: 'c2-hidden-child', name: 'Hidden', parent: 'c2-other' },
  { id: 'c2-deleted', name: 'Deleted', deleted: true },
  { id: 'c2-deleted-child', name: 'Below deleted', parent: 'c2-deleted' },
  { id: 'c2-orphan', parent: 'c2-missing' },
  { id: 'c2-cycle', parent: 'c2-cycle' },
  { id: 'c2-locked', name: 'Locked', pw: 'never-leak-this-hash' },
  { id: 'c2-changing', name: 'Changing' },
];
let app, db, context, handler;
const fixtures = [];
const mom = (extra = {}) => ({ areaId: 'c2-area', title: 'Meeting', markdown: '# Notes', ...extra });
const link = (extra = {}) => ({ areaId: 'c2-area', name: 'Reference', url: 'https://example.test/reference', ...extra });
const env = {
  MCP_SECRET: SECRET, WORKBENCH_OWNER_EMAIL: OWNER_EMAIL,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
};

async function seed(collection, records) {
  const batch = db.batch();
  for (const record of records) {
    const ref = db.collection(collection).doc(record.id);
    fixtures.push(ref);
    batch.set(ref, { ...record, id: 'stale-stored-id' });
  }
  await batch.commit();
}

async function saved() {
  return Promise.all(['moms', 'docs'].map(collection => db.collection(collection)
    .where('folderId', '>=', 'c2-').where('folderId', '<', 'c2.').get()));
}
const savedIds = async () => (await saved()).flatMap(snapshot => snapshot.docs.map(doc => doc.ref.path)).sort();
const call = async (name, args, handle = handler) => (await rpcResponse(handle, rpc('tools/call', { name, arguments: args }))).data;

before(async () => {
  app = initializeApp({ projectId: 'demo-workspace' }, 'mcp-c2-fixtures');
  db = getFirestore(app);
  context = { db, owner: { uid: OWNER_UID, name: 'Connector owner' }, origin: 'https://preview.example.test' };
  handler = createHandler({ env, getContext: async () => context });
  await seed('folders', areas);
  await seed('momfolders', [
    { id: 'c2-mom', folderId: 'c2-area', name: 'Meetings' },
    { id: 'c2-both', folderId: 'c2-area', name: 'Workshop', holds: 'both' },
    { id: 'c2-private-group', folderId: 'c2-private', name: 'Board', privateTo: OWNER_UID },
    { id: 'c2-other-group', folderId: 'c2-other', name: 'Wrong area', holds: 'both' },
    { id: 'c2-hidden-group', folderId: 'c2-area', name: 'Other admin', privateTo: otherUid, holds: 'both' },
    { id: 'c2-deleted-group', folderId: 'c2-area', name: 'Deleted', deleted: true, holds: 'both' },
    { id: 'c2-changing-group', folderId: 'c2-area', name: 'Changing', holds: 'both' },
  ]);
  await seed('docfolders', [
    // A legacy holds value on a docfolder still means files-only, as in the app.
    { id: 'c2-file', folderId: 'c2-area', name: 'References', holds: 'both' },
    { id: 'c2-other-file-group', folderId: 'c2-other', name: 'Wrong files' },
  ]);
});

after(async () => {
  if (db) {
    const refs = [...fixtures, ...(await saved()).flatMap(snapshot => snapshot.docs.map(doc => doc.ref))];
    const batch = db.batch();
    for (const ref of refs) batch.delete(ref);
    await batch.commit();
  }
  if (app) await deleteApp(app);
});

test('markdown converts headings, bold, links, lists, tasks and a table while dropping scripts and handlers', () => {
  const sample = '# Heading\n\n## Subheading\n\n### Detail\n\n**Bold** and [link](https://example.test).\n\n- Bullet\n\n1. First\n2. Second\n\n- [ ] Todo\n- [x] Done\n\n| Name | Status |\n| --- | --- |\n| Plan | Ready |\n\n<script>alert("unsafe")</script>\n\n<p onclick="alert(1)">Safe text</p>';
  assert.equal(markdownToHtml(sample), [
    '<h1>Heading</h1>', '<h2>Subheading</h2>', '<h3>Detail</h3>',
    '<p><strong>Bold</strong> and <a href="https://example.test">link</a>.</p>',
    '<ul>', '<li>Bullet</li>', '</ul>', '<ol>', '<li>First</li>', '<li>Second</li>', '</ol>',
    '<ul>', '<li>☐ Todo</li>', '<li>☑ Done</li>', '</ul>',
    '<table>', '<thead>', '<tr>', '<th>Name</th>', '<th>Status</th>', '</tr>', '</thead>',
    '<tbody><tr>', '<td>Plan</td>', '<td>Ready</td>', '</tr>', '</tbody></table>', '<p>Safe text</p>',
  ].join('\n'));
});

test('sanitization allows only editor formatting and safe anchor schemes', () => {
  const html = markdownToHtml('#### Deep\n\n*Em* ~~gone~~ <u>under</u>\n\n> Quote\n\n```js\nif (a < b) run();\n```\n\n---\n\n<p style="color:red" onmouseover="bad()">Line<br>two</p>\n\n<a href="javascript:alert(1)" onclick="bad()">bad</a> <a href="//evil.test">relative</a> <a href="data:text/html,bad">data</a> [mail](mailto:person@example.test) [http](http://example.test)\n\n<iframe src="https://evil.test">hidden</iframe><style>body{display:none}</style><img src=x onerror=bad()>');
  for (const expected of ['<h3>Deep</h3>', '<em>Em</em>', '<s>gone</s>', '<u>under</u>', '<blockquote>', '<pre><code>', 'a &lt; b', '<hr />', '<br />', 'href="mailto:person@example.test"', 'href="http://example.test"']) assert.ok(html.includes(expected), expected);
  assert.doesNotMatch(html, /script|onclick|onmouseover|onerror|style=|<style|iframe|<img|javascript:|data:|href="\/\//i);
});

test('saved MoM matches app defaults, private area, author, grouping, date and returned path', async () => {
  const now = Date.parse('2026-11-12T18:30:00Z');
  const result = await saveMom(context, mom({ areaId: 'c2-private', groupId: 'c2-private-group', title: '  Board notes  ', date: '2026-10-20', tags: ['board'] }), now);
  assert.deepEqual(result, { id: result.id, path: 'Planning › Board', url: `${context.origin}/#/mom/${result.id}` });
  assert.deepEqual((await db.collection('moms').doc(result.id).get()).data(), {
    id: result.id, folderId: 'c2-private', momFolderId: 'c2-private-group', title: 'Board notes',
    date: Date.parse('2026-10-20T00:00:00+07:00'), content: '<h1>Notes</h1>\n', tags: ['board'],
    starred: false, created: now, edited: now, privateTo: OWNER_UID,
    createdBy: context.owner, source: 'claude-chat',
  });
  const place = (await listPlaces(context, { query: 'Board notes' })).places.find(place => place.id === 'c2-private');
  assert.equal(place.recentMoms[0].title, 'Board notes');
  assert.equal(place.private, true);
});

test('default day follows Jakarta across UTC midnight; omitted grouping, tags and empty body use app defaults', async () => {
  const result = await saveMom(context, mom({ markdown: '' }), Date.parse('2026-11-12T18:30:00Z'));
  const record = (await db.collection('moms').doc(result.id).get()).data();
  assert.equal(record.date, Date.parse('2026-11-13T00:00:00+07:00'));
  assert.equal(record.content, '');
  assert.deepEqual(record.tags, []);
  assert.equal(record.privateTo, null);
  assert.ok(!('momFolderId' in record));
  assert.equal(result.path, 'Clients › Acme');
});

test('saved links match Save link fields for each app kind and either files-capable grouping', async () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  for (const [kind, type] of Object.entries({ link: 'link', slides: 'presentation', pdf: 'pdf', sheet: 'spreadsheet', image: 'image', other: 'other' })) {
    const groupId = kind === 'link' ? 'c2-file' : 'c2-both';
    const result = await saveLink(context, link({ groupId, kind, name: '  Reference  ', note: '  Context  ' }), now);
    const record = (await db.collection('docs').doc(result.id).get()).data();
    assert.deepEqual(record, {
      id: result.id, folderId: 'c2-area', docFolderId: groupId, name: 'Reference', type,
      url: 'https://example.test/reference', note: 'Context', added: now,
      privateTo: null, createdBy: context.owner, source: 'claude-chat',
    });
    assert.deepEqual(result, { id: result.id, path: `Clients › Acme › ${groupId === 'c2-file' ? 'References' : 'Workshop'}`, url: `${context.origin}/#/areas/c2-area` });
  }
  const result = await saveLink(context, link({ areaId: 'c2-private' }));
  const record = (await db.collection('docs').doc(result.id).get()).data();
  assert.equal(record.privateTo, OWNER_UID);
  assert.equal(record.note, '');
  assert.ok(!('docFolderId' in record));
});

test('omitted kind follows the app address inference; explicit kind wins', async () => {
  for (const [url, type] of [
    ['https://example.test/deck.pptx', 'presentation'], ['https://docs.google.com/spreadsheets/d/id', 'spreadsheet'],
    ['https://example.test/report.pdf', 'pdf'], ['https://example.test/picture.png?size=1', 'image'],
    ['http://example.test/page', 'link'],
  ]) {
    const result = await saveLink(context, link({ url }));
    assert.equal((await db.collection('docs').doc(result.id).get()).data().type, type);
  }
  const result = await saveLink(context, link({ url: 'https://example.test/report.pdf', kind: 'other' }));
  assert.equal((await db.collection('docs').doc(result.id).get()).data().type, 'other');
});

test('MCP saves persist sanitized data and return links using the request origin', async () => {
  for (const [tool, args, collection, suffix] of [
    ['save_mom', mom({ groupId: 'c2-both', markdown: '<p onclick="bad()">safe</p><script>bad()</script>' }), 'moms', 'mom'],
    ['save_link', link({ groupId: 'c2-both' }), 'docs', 'areas'],
  ]) {
    const data = await call(tool, args);
    assert.ok(!data.result.isError);
    const value = data.result.structuredContent;
    assert.deepEqual(JSON.parse(data.result.content[0].text), value);
    assert.equal(value.url, `http://localhost/#/${suffix}/${suffix === 'mom' ? value.id : args.areaId}`);
    const record = (await db.collection(collection).doc(value.id).get()).data();
    assert.equal(record.source, 'claude-chat');
    if (collection === 'moms') assert.equal(record.content, '<p>safe</p>');
  }
});

test('caller-supplied identity, privacy, source and stored grouping fields cannot override the destination', async () => {
  const forged = { id: 'forged', privateTo: otherUid, createdBy: { uid: otherUid, name: 'Other' }, source: 'forged', momFolderId: 'c2-other-group', docFolderId: 'c2-other-file-group' };
  for (const [save, args, collection] of [[saveMom, mom(), 'moms'], [saveLink, link(), 'docs']]) {
    const result = await save(context, { ...args, ...forged });
    const record = (await db.collection(collection).doc(result.id).get()).data();
    assert.notEqual(record.id, forged.id);
    assert.equal(record.privateTo, null);
    assert.deepEqual(record.createdBy, context.owner);
    assert.equal(record.source, 'claude-chat');
    assert.ok(!('momFolderId' in record));
    assert.ok(!('docFolderId' in record));
  }
});

test('both saves refuse missing, private, deleted, hidden-ancestor, orphan and cyclic areas without writes', async () => {
  const before = await savedIds();
  for (const areaId of ['c2-missing', 'c2-other', 'c2-deleted', 'c2-hidden-child', 'c2-deleted-child', 'c2-orphan', 'c2-cycle']) {
    for (const [name, args] of [['save_mom', mom({ areaId })], ['save_link', link({ areaId })]]) {
      const data = await call(name, args);
      assert.equal(data.result.isError, true, `${name} ${areaId}`);
      assert.match(data.result.content[0].text, /existing, visible Workbench area/);
    }
  }
  assert.deepEqual(await savedIds(), before);
});

test('wrong-area, missing, private, deleted and wrong-kind groupings are refused without writes', async () => {
  const before = await savedIds();
  for (const [name, args, wrongKind] of [['save_mom', mom(), 'c2-file'], ['save_link', link(), 'c2-mom']]) {
    for (const groupId of ['c2-missing', 'c2-other-group', 'c2-other-file-group', 'c2-hidden-group', 'c2-deleted-group', wrongKind]) {
      const data = await call(name, { ...args, groupId });
      assert.equal(data.result.isError, true, `${name} ${groupId}`);
      assert.match(data.result.content[0].text, /visible grouping in this area/);
    }
  }
  assert.deepEqual(await savedIds(), before);
});

test('missing, blank, wrong-type, invalid dates and document-path inputs fail before context lookup', async () => {
  let lookups = 0;
  const isolated = createHandler({ env, getContext: async () => { lookups++; return context; } });
  const before = await savedIds();
  for (const [name, args] of [
    ['save_mom', {}], ['save_mom', mom({ title: '' })], ['save_mom', mom({ title: ' \n\t ' })],
    ['save_mom', mom({ markdown: undefined })], ['save_mom', mom({ markdown: 1 })], ['save_mom', mom({ tags: 'board' })],
    ['save_mom', mom({ date: '2026-02-30' })], ['save_mom', mom({ date: '12/11/2026' })],
    ['save_mom', mom({ areaId: 'folders/id' })], ['save_mom', mom({ areaId: 'a'.repeat(1501) })],
    ['save_link', {}], ['save_link', link({ name: '   ' })], ['save_link', link({ url: 123 })],
    ['save_link', link({ kind: 'presentation' })], ['save_link', link({ groupId: 'x/y' })],
  ]) {
    const data = await call(name, args, isolated);
    assert.equal(data.error.code, -32602, name);
    assert.ok(!('result' in data));
  }
  assert.equal(lookups, 0);
  assert.deepEqual(await savedIds(), before);
});

test('javascript, data, file, ftp, mailto, relative and malformed link addresses write nothing', async () => {
  const before = await savedIds();
  for (const url of ['', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>bad()</script>', 'file:///tmp/file', 'ftp://example.test/a', 'mailto:person@example.test', '//example.test', 'example.test', 'http:', 'https://']) {
    const data = await call('save_link', link({ url }));
    assert.equal(data.result.isError, true, url);
    assert.equal(data.result.content[0].text, 'Use a complete http:// or https:// web address for the link.');
  }
  assert.deepEqual(await savedIds(), before);
});

test('500 KB limit measures UTF-8 input and sanitized HTML expansion before any write', async () => {
  const before = await savedIds();
  for (const markdown of ['a'.repeat(MAX_CONTENT_BYTES + 1), '☑'.repeat(Math.ceil(MAX_CONTENT_BYTES / 3)), '&'.repeat(Math.floor(MAX_CONTENT_BYTES / 4))]) {
    const data = await call('save_mom', mom({ markdown }));
    assert.equal(data.result.isError, true);
    assert.match(data.result.content[0].text, /over 500 KB/);
  }
  assert.deepEqual(await savedIds(), before);
  const boundary = await saveMom(context, mom({ markdown: 'a'.repeat(MAX_CONTENT_BYTES - 8) }));
  assert.equal(Buffer.byteLength((await db.collection('moms').doc(boundary.id).get()).data().content), MAX_CONTENT_BYTES);
});

test('very long names survive and case-variant duplicate titles and URLs remain separate items', async () => {
  for (const [save, args, collection, field] of [
    [saveMom, mom({ title: 'Title '.repeat(3000) }), 'moms', 'title'],
    [saveLink, link({ name: 'Reference '.repeat(3000) }), 'docs', 'name'],
  ]) {
    const first = await save(context, args);
    const second = await save(context, { ...args, [field]: args[field].toUpperCase() });
    assert.notEqual(first.id, second.id);
    assert.equal((await db.collection(collection).doc(first.id).get()).data()[field], args[field].trim());
    assert.equal((await db.collection(collection).doc(second.id).get()).data()[field], args[field].trim().toUpperCase());
  }
});

test('locked areas accept explicit saves without disclosing existing titles or password hashes', async () => {
  const result = await saveMom(context, mom({ areaId: 'c2-locked', title: 'Locked notes' }));
  assert.equal(result.path, 'Locked');
  const place = (await listPlaces(context)).places.find(place => place.id === 'c2-locked');
  assert.equal(place.locked, true);
  assert.deepEqual(place.recentMoms, []);
  assert.ok(!JSON.stringify(place).includes('never-leak-this-hash'));
});

test('failed reads and failures after staging a create commit nothing and reveal no internal error', async t => {
  for (const halfway of [false, true]) {
    const before = await savedIds();
    const original = db.runTransaction.bind(db);
    const patch = t.mock.method(db, 'runTransaction', callback => original(async transaction => {
      if (halfway) await callback(transaction);
      throw new Error('secret-database-address-and-key');
    }));
    for (const [name, args] of [['save_mom', mom()], ['save_link', link()]]) {
      const data = await call(name, args);
      assert.equal(data.result.isError, true);
      assert.match(data.result.content[0].text, /Check Workbench before retrying; it may have saved/);
      assert.doesNotMatch(JSON.stringify(data), /secret-database-address-and-key/);
    }
    patch.mock.restore();
    assert.deepEqual(await savedIds(), before);
  }
});

test('lost commit acknowledgement saves once, warns before retry, and an explicit retry stays a separate save', async t => {
  for (const [name, args] of [['save_mom', mom()], ['save_link', link()]]) {
    const before = await savedIds();
    const original = db.runTransaction.bind(db);
    const patch = t.mock.method(db, 'runTransaction', async callback => {
      await original(callback);
      throw new Error('lost-ack-with-sensitive-details');
    });
    const data = await call(name, args);
    patch.mock.restore();
    assert.equal(data.result.isError, true);
    assert.match(data.result.content[0].text, /Check Workbench before retrying; it may have saved/);
    assert.doesNotMatch(JSON.stringify(data), /lost-ack-with-sensitive-details/);
    assert.equal((await savedIds()).length, before.length + 1);
    const retry = await call(name, args);
    assert.ok(retry.result.structuredContent.id);
    assert.equal((await savedIds()).length, before.length + 2);
  }
});

test('closing the caller immediately after commit leaves exactly one complete saved item', async t => {
  for (const [name, args] of [['save_mom', mom()], ['save_link', link()]]) {
    const before = await savedIds();
    const abort = new AbortController();
    const original = db.runTransaction.bind(db);
    const patch = t.mock.method(db, 'runTransaction', async callback => {
      const value = await original(callback);
      abort.abort();
      return value;
    });
    const pending = new Request(request(rpc('tools/call', { name, arguments: args })), { signal: abort.signal });
    try {
      const response = await handler(pending);
      await response.text();
    } catch { /* A disconnected client may receive no answer. */ }
    patch.mock.restore();
    assert.equal(abort.signal.aborted, true);
    const added = (await savedIds()).filter(id => !before.includes(id));
    assert.equal(added.length, 1);
    const record = (await db.doc(added[0]).get()).data();
    assert.equal(record.source, 'claude-chat');
    assert.deepEqual(record.createdBy, context.owner);
    assert.equal(record.privateTo, null);
  }
});

test('transaction retry revalidates changed area privacy and changed grouping membership before writing', async t => {
  for (const grouping of [false, true]) {
    const before = await savedIds();
    const ref = db.collection(grouping ? 'momfolders' : 'folders').doc(grouping ? 'c2-changing-group' : 'c2-changing');
    const original = db.runTransaction.bind(db);
    const patch = t.mock.method(db, 'runTransaction', async callback => {
      // Discard a staged first attempt, then use a real transaction for the retry.
      await callback({ get: ref => ref.get(), create() {} });
      await ref.update(grouping ? { folderId: 'c2-other' } : { privateTo: otherUid });
      return original(callback);
    });
    const data = await call('save_mom', mom(grouping ? { groupId: 'c2-changing-group' } : { areaId: 'c2-changing' }));
    patch.mock.restore();
    assert.equal(data.result.isError, true);
    assert.deepEqual(await savedIds(), before);
    await ref.update(grouping ? { folderId: 'c2-area' } : { privateTo: null });
  }
});
