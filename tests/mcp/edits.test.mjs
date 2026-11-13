import { OWNER_EMAIL, OWNER_UID, SECRET, request, rpc, rpcResponse } from './setup.mjs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { editMom } from '../../api/_lib/edits.mjs';
import { findItems, plainText, readMom, splitSections } from '../../api/_lib/reads.mjs';
import { markdownToHtml, MAX_CONTENT_BYTES } from '../../api/_lib/saves.mjs';
import { createHandler } from '../../api/_lib/server.mjs';

const other = 'c6-other-admin', now = Date.parse('2026-11-12T12:00:00Z');
const rich = '<p>Intro &amp; context</p>\n<h2>Decisions</h2><p>First decision.</p>\n'
  + '<h2>Decisions</h2><p>Second decision.</p>\n'
  + '<h3>Rich</h3><p style="color: red"><span class="font">Colour</span></p>'
  + '<table data-template="prospect-journal"><tr><td colwidth="120">Journal</td></tr></table>'
  + '<p><img src="https://example.test/chart.png" alt="Chart"></p>\n';
const refs = [], hidden = [];
let app, db, context, handler, sequence = 0;
const env = {
  MCP_SECRET: SECRET, WORKBENCH_OWNER_EMAIL: OWNER_EMAIL,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
};

async function seed(collection, id, data) {
  const ref = db.collection(collection).doc(id);
  refs.push(ref);
  await ref.set(data);
  return ref;
}
const newMom = (extra = {}) => seed('moms', `c6-mom-${++sequence}`, Object.fromEntries(Object.entries({
  id: 'stale-stored-id', folderId: 'c6-area', momFolderId: 'c6-group', title: 'C6 meeting',
  date: now, created: 50, tags: ['board'], starred: true, gdoc: 'https://docs.example.test/meeting',
  content: rich, edited: 100, prevEdited: 99, editedBy: { uid: other, name: 'Colleague' }, ...extra,
}).filter(([, value]) => value !== undefined)));
const args = (ref, extra = {}) => ({ id: ref.id, expectEdited: 100, mode: 'append', markdown: 'Added', ...extra });
const backups = ref => db.collection('mom_backups').where('momId', '==', ref.id).get();
async function state(ref) {
  const [mom, history] = await Promise.all([ref.get(), backups(ref)]);
  return { data: mom.data(), updated: mom.updateTime?.toString(), backups: history.docs
    .map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.id.localeCompare(b.id)) };
}
async function refused(ref, input, message) {
  const before = await state(ref);
  await assert.rejects(editMom(context, input, now), { message });
  assert.deepEqual(await state(ref), before);
}
const call = async (input, handle = handler) => (await rpcResponse(handle, rpc('tools/call', { name: 'edit_mom', arguments: input }))).data;
const withTransaction = runTransaction => ({ ...context, db: { collection: db.collection.bind(db), runTransaction } });

before(async () => {
  app = initializeApp({ projectId: 'demo-workspace' }, 'mcp-c6-fixtures');
  db = getFirestore(app);
  context = { db, owner: { uid: OWNER_UID, name: 'C6 owner' }, origin: 'https://preview.example.test' };
  handler = createHandler({ env, getContext: async () => context });
  for (const [id, data] of Object.entries({
    'c6-root': { name: 'C6 Clients' }, 'c6-area': { name: 'Acme', parent: 'c6-root' },
    'c6-own': { privateTo: OWNER_UID }, 'c6-other': { privateTo: other },
    'c6-under-other': { parent: 'c6-other' }, 'c6-deleted': { deleted: true },
    'c6-under-deleted': { parent: 'c6-deleted' }, 'c6-locked': { pw: 'secret-lock-hash' },
    'c6-under-locked': { parent: 'c6-locked' }, 'c6-orphan': { parent: 'c6-missing' },
    'c6-cycle': { parent: 'c6-cycle' }, 'c6-bad-parent': { parent: false },
  })) await seed('folders', id, data);
  for (const [id, data] of Object.entries({
    'c6-group': { folderId: 'c6-area', name: 'Meetings' },
    'c6-hidden-group': { folderId: 'c6-area', privateTo: other },
    'c6-deleted-group': { folderId: 'c6-area', deleted: true },
    'c6-moved-group': { folderId: 'c6-other' },
  })) await seed('momfolders', id, data);
});

after(async () => {
  if (db) {
    const history = await db.collection('mom_backups').where('momId', '>=', 'c6-').where('momId', '<', 'c6.').get();
    const batch = db.batch();
    for (const ref of [...refs, ...history.docs.map(doc => doc.ref)]) batch.delete(ref);
    await batch.commit();
  }
  if (app) await deleteApp(app);
});

test('append preserves rich HTML and metadata, backs up the exact prior version, and ripples into reads and search', async () => {
  const ref = await newMom(), before = (await ref.get()).data();
  const result = await editMom(context, args(ref, { markdown: 'C6appendneedle **agreed**.' }), now);
  const content = rich + markdownToHtml('C6appendneedle **agreed**.');
  assert.deepEqual(result, { id: ref.id, url: `${context.origin}/#/mom/${ref.id}`, edited: now, backupId: result.backupId });
  assert.deepEqual((await ref.get()).data(), { ...before, content, edited: now, prevEdited: 100, editedBy: context.owner });
  assert.deepEqual((await db.collection('mom_backups').doc(result.backupId).get()).data(), {
    momId: ref.id, content: rich, edited: 100, afterEdited: now, mode: 'append', savedAt: now,
  });
  assert.equal((await backups(ref)).size, 1);
  const pulled = await readMom(context, { id: ref.id });
  assert.equal(pulled.edited, now);
  assert.match(pulled.markdown, /C6appendneedle \*\*agreed\*\*/);
  const found = await findItems(context, { areaId: 'c6-area', query: 'C6appendneedle' });
  assert.deepEqual(found.items.map(item => item.id), [ref.id]);
  assert.match(found.items[0].snippet, /C6appendneedle agreed/);
});

test('replace_section uses its number despite duplicate headings and preserves every other byte', async () => {
  const ref = await newMom(), original = splitSections(rich);
  const result = await editMom(context, args(ref, { mode: 'replace_section', section: 1, markdown: '## Revised\n\nNew decision.' }), now);
  assert.equal((await ref.get()).data().content,
    original[0].html + markdownToHtml('## Revised\n\nNew decision.') + original.slice(2).map(section => section.html).join(''));
  const backup = (await db.collection('mom_backups').doc(result.backupId).get()).data();
  assert.equal(backup.content, rich); assert.equal(backup.mode, 'replace_section');
  assert.deepEqual((await readMom(context, { id: ref.id })).sections.map(section => section.heading), [null, 'Revised', 'Decisions', 'Rich']);
});

test('round trip read and replace keeps cell breaks, literal tags and linked underlines through search and undo', async () => {
  const body = '<table><tr><th>Value</th></tr><tr><td><p>one</p><p>two &lt;name&gt;</p></td></tr></table>'
    + '<p>&lt;script&gt;C6roundtripneedle&lt;/script&gt; &amp;lt;name&amp;gt;</p>'
    + '<p><a href="https://example.test/report"><u>under</u></a></p>';
  const original = splitSections(rich), content = original[0].html + '<h2>Decisions</h2>' + body
    + original.slice(2).map(section => section.html).join('');
  const ref = await newMom({ content }), read = await readMom(context, { id: ref.id }), section = read.sections[1];
  assert.equal(section.plain, true);
  const result = await editMom(context, args(ref, {
    mode: 'replace_section', section: section.n, markdown: section.markdown, expectEdited: read.edited,
  }), now);
  const saved = (await ref.get()).data().content, after = splitSections(saved);
  assert.equal(after[0].html, original[0].html);
  assert.equal(after.slice(2).map(section => section.html).join(''), original.slice(2).map(section => section.html).join(''));
  assert.equal(plainText(saved), plainText(content));
  assert.match(saved, /one<br\s*\/?>two &lt;name&gt;/);
  assert.match(saved, /&lt;script&gt;C6roundtripneedle&lt;\/script&gt;/);
  assert.match(saved, /<a href="https:\/\/example.test\/report"><u>under<\/u><\/a>/);
  assert.doesNotMatch(saved, /<script>|onetwo/);
  assert.equal((await db.collection('mom_backups').doc(result.backupId).get()).data().content, content);
  const pulled = await readMom(context, { id: ref.id });
  assert.equal(pulled.sections[1].markdown, section.markdown);
  const found = await findItems(context, { areaId: 'c6-area', query: 'C6roundtripneedle' });
  assert.equal(found.items.find(item => item.id === ref.id).matchedIn, 'body');
  await refused(ref, args(ref, { mode: 'replace_section', section: 1, markdown: section.markdown }),
    'This MoM changed since you read it: read it again.');
  await editMom(context, args(ref, { mode: 'undo', expectEdited: result.edited }), now);
  assert.equal((await ref.get()).data().content, content);
});

test('round trip lossy sections refuse replacement without changing content, metadata or backups', async () => {
  for (const content of [
    '<table><tr><th>Cell</th></tr><tr><td><ul><li>one</li><li>two</li></ul></td></tr></table>',
    '<table><tr><th colspan="2">one</th></tr><tr><td>two</td><td>three</td></tr></table>',
    '<table><tr><th>one</th></tr><tr><td rowspan="2">two</td></tr><tr><td>three</td></tr></table>',
    '<table><tr><td>one</td></tr><tr><td>two</td></tr></table>',
    '<p>one</p><p></p><p>two</p>',
  ]) {
    const ref = await newMom({ content }), read = await readMom(context, { id: ref.id });
    assert.equal(read.sections[0].plain, false, content);
    await refused(ref, args(ref, { mode: 'replace_section', section: 0, markdown: read.sections[0].markdown }),
      'This section has formatting markdown cannot preserve. Append instead.');
    const result = await editMom(context, args(ref), now);
    assert.equal((await ref.get()).data().content, content + markdownToHtml('Added'));
    await editMom(context, args(ref, { mode: 'undo', expectEdited: result.edited }), now);
    assert.equal((await ref.get()).data().content, content);
  }
});

test('missing or null versions match null; legacy scalar versions match exactly and clear obsolete prevEdited', async () => {
  for (const previous of [undefined, null, '', '123']) {
    const ref = await newMom({ edited: previous, content: undefined });
    const result = await editMom(context, args(ref, { expectEdited: previous ?? null, markdown: '' }), now);
    const stored = (await ref.get()).data();
    assert.equal(stored.content, ''); assert.equal(stored.edited, now);
    assert.ok(!Object.hasOwn(stored, 'prevEdited'));
    const backup = (await db.collection('mom_backups').doc(result.backupId).get()).data();
    assert.equal(backup.edited, previous ?? null); assert.equal(backup.content, '');
  }
  const own = await newMom({ folderId: 'c6-own', momFolderId: undefined, privateTo: OWNER_UID, content: '' });
  await editMom(context, args(own), now);
  assert.equal((await own.get()).data().privateTo, OWNER_UID);
});

test('empty section zero and empty replacement are valid; two same-millisecond writes have distinct versions', async () => {
  const ref = await newMom({ content: '<h2>Heading</h2><p>Body</p>' });
  const first = await editMom(context, args(ref, { mode: 'replace_section', section: 0, markdown: 'Intro' }), 100);
  assert.equal(first.edited, 101);
  const second = await editMom(context, args(ref, { expectEdited: 101, mode: 'replace_section', section: 1, markdown: '' }), 100);
  assert.equal(second.edited, 102);
  assert.equal((await ref.get()).data().content, markdownToHtml('Intro'));
  assert.equal((await ref.get()).data().prevEdited, 101);
  assert.equal((await backups(ref)).size, 2);
});

test('stale expectEdited, including a numerically equal string, writes neither content nor backup', async () => {
  const ref = await newMom();
  for (const expectEdited of [null, 99, '100']) for (const mode of ['append', 'replace_section', 'undo']) {
    await refused(ref, args(ref, { expectEdited, mode, section: 1 }), 'This MoM changed since you read it: read it again.');
  }
});

test('an exhausted or unsafe stored numeric version is refused instead of reusing a version', async () => {
  for (const edited of [Number.MAX_SAFE_INTEGER, 1e100]) {
    const ref = await newMom({ edited });
    await refused(ref, args(ref, { expectEdited: edited }),
      'This MoM has an invalid edit version: open it in Workbench once, then try again.');
  }
});

test('hidden, deleted, locked, missing and malformed destinations have the same not-found refusal for all modes', async () => {
  const cases = [
    ...['c6-other', 'c6-under-other', 'c6-deleted', 'c6-under-deleted', 'c6-locked', 'c6-under-locked',
      'c6-orphan', 'c6-cycle', 'c6-bad-parent', 'c6-missing', false].map(folderId => ({ folderId, momFolderId: undefined })),
    { privateTo: other }, { privateTo: '' }, { deleted: true }, { pw: 'own-lock' },
    ...['c6-hidden-group', 'c6-deleted-group', 'c6-moved-group', 'c6-missing', false, 'bad/id'].map(momFolderId => ({ momFolderId })),
  ];
  for (const data of cases) hidden.push(await newMom(data));
  for (const ref of [...hidden, db.collection('moms').doc('c6-missing')]) {
    for (const mode of ['append', 'replace_section', 'undo']) await refused(ref, args(ref, { mode, section: 1 }), 'No MoM with that id.');
  }
  assert.deepEqual((await call(args(hidden[0]))).result, (await call(args(db.collection('moms').doc('c6-missing')))).result);
});

test('old Delta, nonplain sections and nonexistent sections refuse without any writes', async () => {
  const old = await newMom({ content: JSON.stringify({ ops: [{ insert: 'Legacy\n' }] }) });
  for (const mode of ['append', 'replace_section', 'undo']) await refused(old, args(old, { mode, section: 0 }),
    'This MoM is in the old format: open it in Workbench once, then try again.');
  for (const content of ['<p style="">Colour</p>', '<p class="">Font</p>', '<p data-extra="">Data</p>',
    '<span>Span</span>', '<mark>Highlight</mark>', '<img src="https://example.test/x.png">',
    '<table data-template="prospect-journal"><tr><td>Journal</td></tr></table>', '<table><tr><td colwidth="100">Cell</td></tr></table>']) {
    const ref = await newMom({ content });
    await refused(ref, args(ref, { mode: 'replace_section', section: 0 }), 'This section has formatting markdown cannot preserve. Append instead.');
  }
  const ref = await newMom();
  for (const section of [4, 999]) await refused(ref, args(ref, { mode: 'replace_section', section }), 'No section with that number: read the MoM again.');
});

test('both edit modes use the save_mom sanitizer without sanitizing untouched rich blocks', async () => {
  const markdown = '<script>alert("bad")</script>\n\n<p onclick="bad()">Safe **text**</p>\n\n- [x] Done';
  for (const mode of ['append', 'replace_section']) {
    const ref = await newMom();
    await editMom(context, args(ref, { mode, section: 1, markdown }), now);
    const content = (await ref.get()).data().content;
    assert.ok(content.includes(markdownToHtml(markdown)));
    assert.doesNotMatch(content, /<script|onclick|alert\(/i);
    assert.match(content, /style="color: red"/); assert.match(content, /data-template="prospect-journal"/);
  }
});

test('500 KB applies to resulting UTF-8 HTML for append, replacement and undo, with the exact boundary allowed', async () => {
  const overflow = 'MoM content is over 500 KB. Shorten it or save it as a file instead.';
  const ref = await newMom({ content: `<p>${'界'.repeat(170000)}</p>` });
  await refused(ref, args(ref, { markdown: 'x'.repeat(2100) }), overflow);
  for (const mode of ['append', 'replace_section']) {
    await refused(ref, args(ref, { mode, section: 0, markdown: '😀'.repeat(MAX_CONTENT_BYTES / 4 + 1) }), overflow);
    await refused(ref, args(ref, { mode, section: 0, markdown: '<'.repeat(130000) }), overflow);
  }
  const long = await newMom({ content: `<p>${'x'.repeat(MAX_CONTENT_BYTES - 60)}</p><h2>Target</h2><p>Old</p>` });
  await refused(long, args(long, { mode: 'replace_section', section: 1, markdown: 'x'.repeat(100) }), overflow);
  const exact = await newMom({ content: `<p>${'x'.repeat(MAX_CONTENT_BYTES - 7)}</p>` });
  await editMom(context, args(exact, { markdown: '' }), now);
  assert.equal(Buffer.byteLength((await exact.get()).data().content), MAX_CONTENT_BYTES);
  const oversized = await newMom({ content: `<p>${'x'.repeat(MAX_CONTENT_BYTES)}</p>` });
  const shrink = await editMom(context, args(oversized, { mode: 'replace_section', section: 0, markdown: 'Small' }), now);
  await refused(oversized, args(oversized, { expectEdited: shrink.edited, mode: 'undo' }), overflow);
});

test('undo restores only the last chat edit, byte for byte, as a new backed-up version', async () => {
  const ref = await newMom(), original = (await ref.get()).data();
  const first = await editMom(context, args(ref), now);
  const afterAppend = (await ref.get()).data().content;
  const second = await editMom(context, args(ref, { expectEdited: first.edited, mode: 'replace_section', section: 1, markdown: 'Changed' }), now);
  const changed = (await ref.get()).data().content;
  const undone = await editMom(context, args(ref, { expectEdited: second.edited, mode: 'undo' }), now);
  assert.deepEqual((await ref.get()).data(), { ...original, content: afterAppend, edited: undone.edited, prevEdited: second.edited, editedBy: context.owner });
  assert.deepEqual((await db.collection('mom_backups').doc(undone.backupId).get()).data(), {
    momId: ref.id, content: changed, edited: second.edited, afterEdited: undone.edited, mode: 'undo', savedAt: now,
  });
  assert.equal((await backups(ref)).size, 3);
  const one = await newMom();
  const edit = await editMom(context, args(one), now);
  await editMom(context, args(one, { expectEdited: edit.edited, mode: 'undo' }), now + 1);
  assert.equal((await one.get()).data().content, rich);
});

test('undo refuses an unedited note or an app change after the last chat edit, even after a fresh read', async () => {
  const ref = await newMom(), message = 'Nothing to undo: the MoM changed after the last chat edit.';
  await refused(ref, args(ref, { mode: 'undo' }), message);
  const result = await editMom(context, args(ref), now);
  await ref.update({ content: '<p>App edit</p>', edited: now + 10 });
  await refused(ref, args(ref, { mode: 'undo', expectEdited: result.edited }), 'This MoM changed since you read it: read it again.');
  await refused(ref, args(ref, { mode: 'undo', expectEdited: now + 10 }), message);
});

test('undo chooses the newest matching backup for this MoM and ignores other versions and other MoMs', async () => {
  const ref = await newMom();
  for (const [id, data] of Object.entries({
    'c6-backup-newest': { momId: ref.id, afterEdited: 100, content: '<p>Newest</p>', savedAt: 20 },
    'c6-backup-older': { momId: ref.id, afterEdited: 100, content: '<p>Older</p>', savedAt: 10 },
    'c6-backup-other-version': { momId: ref.id, afterEdited: 99, content: '<p>Different version</p>', savedAt: 30 },
    'c6-backup-other-mom': { momId: 'c6-other-mom', afterEdited: 100, content: '<p>Other MoM</p>', savedAt: 40 },
  })) await seed('mom_backups', id, data);
  await editMom(context, args(ref, { mode: 'undo' }), now);
  assert.equal((await ref.get()).data().content, '<p>Newest</p>');
});

test('simultaneous edits based on one read commit exactly one content change and one backup', async () => {
  const ref = await newMom();
  const results = await Promise.allSettled([editMom(context, args(ref, { markdown: 'First' }), now), editMom(context, args(ref, { markdown: 'Second' }), now)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.message, 'This MoM changed since you read it: read it again.');
  const content = (await ref.get()).data().content;
  assert.ok(content === rich + markdownToHtml('First') || content === rich + markdownToHtml('Second'));
  assert.equal((await backups(ref)).size, 1);
});

test('transaction retries recheck area privacy, locks, grouping membership and the edited version', async t => {
  for (const [collection, id, change, restore, stale] of [
    ['folders', 'c6-area', { privateTo: other }, { privateTo: null }],
    ['folders', 'c6-root', { pw: 'locked-now' }, { pw: null }],
    ['momfolders', 'c6-group', { folderId: 'c6-other' }, { folderId: 'c6-area' }],
    ['moms', null, { edited: 101 }, null, true],
  ]) {
    const ref = await newMom(), changing = db.collection(collection).doc(id || ref.id);
    const original = (await ref.get()).data();
    const changed = withTransaction(async callback => {
      // Discard the first staged attempt, then retry with the changed database.
      await callback({ get: ref => ref.get(), update() {}, create() {} });
      await changing.update(change);
      return db.runTransaction(callback);
    });
    if (restore) t.after(() => changing.update(restore));
    await assert.rejects(editMom(changed, args(ref), now), { message: stale ? 'This MoM changed since you read it: read it again.' : 'No MoM with that id.' });
    assert.deepEqual((await ref.get()).data(), { ...original, ...(stale ? change : {}) });
    assert.equal((await backups(ref)).size, 0);
    if (restore) await changing.update(restore);
  }
});

test('HTTP advertises edit_mom, returns structured results and rejects invalid input before Firebase', async () => {
  const listed = (await rpcResponse(handler, rpc('tools/list'))).data.result.tools;
  const tool = listed.find(tool => tool.name === 'edit_mom');
  assert.equal(listed.length, 8); assert.equal(tool.annotations.readOnlyHint, false); assert.equal(tool.annotations.destructiveHint, true);
  const ref = await newMom();
  const response = (await call(args(ref))).result;
  assert.deepEqual(JSON.parse(response.content[0].text), response.structuredContent);
  assert.equal(response.structuredContent.url, `http://localhost/#/mom/${ref.id}`);
  const noContext = createHandler({ env, getContext: () => assert.fail('Invalid input reached Firebase') });
  for (const input of [{}, { ...args(ref), id: ' ' }, { ...args(ref), id: 'bad/id' }, { ...args(ref), id: 'x'.repeat(1501) },
    { ...args(ref), expectEdited: undefined }, { ...args(ref), expectEdited: {} }, { ...args(ref), expectEdited: false },
    { ...args(ref), mode: 'delete' }, { ...args(ref), markdown: undefined }, { ...args(ref), markdown: 123 },
    { ...args(ref), mode: 'replace_section' }, ...[-1, 0.5, '1'].map(section => ({ ...args(ref), mode: 'replace_section', section }))]) {
    assert.equal((await call(input, noContext)).error.code, -32602);
  }
});

test('read failures and failures after staging either write commit nothing and hide internal details', async () => {
  for (const mode of ['append', 'replace_section']) for (const failAt of ['get', 'update', 'create']) {
    const ref = await newMom(), before = await state(ref), input = args(ref, { mode, section: 1 });
    const broken = withTransaction(callback => db.runTransaction(transaction => callback({
      get: async ref => { const value = await transaction.get(ref); if (failAt === 'get') throw new Error('secret-database-details'); return value; },
      update: (...args) => { transaction.update(...args); if (failAt === 'update') throw new Error('secret-database-details'); },
      create: (...args) => { transaction.create(...args); if (failAt === 'create') throw new Error('secret-database-details'); },
    })));
    const failed = (await call(input, createHandler({ env, getContext: async () => broken }))).result;
    assert.equal(failed.isError, true); assert.match(failed.content[0].text, /Check Workbench and read the MoM again before retrying/);
    assert.doesNotMatch(JSON.stringify(failed), /secret-database-details/);
    assert.deepEqual(await state(ref), before);
    assert.ok(!(await call(input)).result.isError);
  }
});

test('a lost commit acknowledgement or closed caller leaves one complete edit; retrying the old read cannot duplicate it', async () => {
  for (const mode of ['append', 'replace_section']) for (const close of [false, true]) {
    const ref = await newMom(), abort = new AbortController(), input = args(ref, { mode, section: 1 });
    const lost = withTransaction(async callback => {
      const value = await db.runTransaction(callback);
      if (close) { abort.abort(); return value; }
      throw new Error('lost-ack-secret');
    });
    const handle = createHandler({ env, getContext: async () => lost });
    if (close) {
      try { await (await handle(new Request(request(rpc('tools/call', { name: 'edit_mom', arguments: input })), { signal: abort.signal }))).text(); }
      catch { /* The disconnected caller may receive no answer. */ }
      assert.equal(abort.signal.aborted, true);
    } else {
      const failed = (await call(input, handle)).result;
      assert.equal(failed.isError, true); assert.match(failed.content[0].text, /may have saved/);
      assert.doesNotMatch(JSON.stringify(failed), /lost-ack-secret/);
    }
    const saved = await state(ref);
    const original = splitSections(rich);
    assert.equal(saved.data.content, mode === 'append' ? rich + markdownToHtml('Added')
      : original[0].html + markdownToHtml('Added') + original.slice(2).map(section => section.html).join(''));
    assert.equal(saved.data.prevEdited, 100); assert.deepEqual(saved.data.editedBy, context.owner);
    assert.equal(saved.backups.length, 1); assert.equal(saved.backups[0].afterEdited, saved.data.edited);
    assert.equal((await call(input)).result.content[0].text, 'This MoM changed since you read it: read it again.');
    assert.deepEqual(await state(ref), saved);
  }
});
