import { OWNER_EMAIL, OWNER_UID, SECRET, rpc, rpcResponse } from './setup.mjs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import endpoint from '../../api/mcp/[secret].mjs';
import { getWorkbench, readSettings } from '../../api/_lib/firebase.mjs';
import { listPlaces } from '../../api/_lib/places.mjs';

process.env.MCP_SECRET = SECRET;
process.env.WORKBENCH_OWNER_EMAIL = OWNER_EMAIL;

let fixtureDb, context;
const refs = [];
const otherUid = 'c1-other-admin';
const longName = 'Long area '.repeat(600);
const folders = [
  { id: 'c1-clients', name: 'Clients' },
  { id: 'c1-acme', name: 'Acme', parent: 'c1-clients' },
  { id: 'c1-board', name: 'Board', parent: 'c1-acme' },
  { id: 'c1-internal', name: 'Internal', privateTo: null },
  { id: 'c1-own', name: 'Owner private', privateTo: OWNER_UID },
  { id: 'c1-own-child', name: 'Inherited private', parent: 'c1-own' },
  { id: 'c1-other', name: 'Other admin private', privateTo: otherUid },
  { id: 'c1-other-child', name: 'Hidden below private', parent: 'c1-other', privateTo: null },
  { id: 'c1-deleted', name: 'Deleted area', deleted: 123 },
  { id: 'c1-deleted-child', name: 'Hidden below deleted', parent: 'c1-deleted' },
  { id: 'c1-locked', name: 'Locked area', pw: 'never-return-this-hash' },
  { id: 'c1-locked-child', name: 'Inherited lock', parent: 'c1-locked' },
  { id: 'c1-orphan', name: 'Orphan', parent: 'no-such-parent' },
  { id: 'c1-cycle-a', name: 'Cycle A', parent: 'c1-cycle-b' },
  { id: 'c1-cycle-b', name: 'Cycle B', parent: 'c1-cycle-a' },
  { id: 'c1-self', name: 'Self', parent: 'c1-self' },
  { id: 'c1-invalid-privacy', name: 'Invalid privacy', privateTo: '' },
  { id: 'c1-blank', name: '   ' },
  { id: 'c1-duplicate', name: 'clients' },
  { id: 'c1-long', name: longName },
];

async function write(collection, records) {
  const batch = fixtureDb.batch();
  for (const record of records) {
    const ref = fixtureDb.collection(collection).doc(record.id);
    refs.push(ref);
    // Stored IDs cannot impersonate a different Firestore document.
    batch.set(ref, { ...record, id: 'stale-stored-id' });
  }
  await batch.commit();
}

before(async () => {
  const fixtureApp = initializeApp({ projectId: 'demo-workspace' }, 'mcp-c1-fixtures');
  fixtureDb = getFirestore(fixtureApp);
  const settings = readSettings();
  await assert.rejects(getWorkbench(settings), {
    message: 'Could not resolve WORKBENCH_OWNER_EMAIL. Check the setting and the owner account.',
  });
  await getAuth(fixtureApp).createUser({ uid: OWNER_UID, email: OWNER_EMAIL, displayName: 'Connector owner' });
  context = await getWorkbench(settings);
  await write('folders', folders);
  await write('momfolders', [
    { id: 'c1-mom-group', name: 'Archive', folderId: 'c1-board' },
    { id: 'c1-both-group', name: 'Shared workshop', folderId: 'c1-board', holds: 'both' },
    { id: 'c1-hidden-group', name: 'Other admin grouping', folderId: 'c1-board', privateTo: otherUid },
    { id: 'c1-deleted-group', name: 'Deleted grouping', folderId: 'c1-board', deleted: 123 },
    { id: 'c1-own-group', name: 'Private planning', folderId: 'c1-own', privateTo: OWNER_UID },
    { id: 'c1-locked-group', name: 'Locked grouping', folderId: 'c1-locked-child' },
  ]);
  await write('docfolders', [
    { id: 'c1-file-group', name: 'Decision files', folderId: 'c1-board', holds: 'both' },
    { id: 'c1-blank-group', name: '', folderId: 'c1-internal' },
    { id: 'c1-other-file-group', name: 'Other private files', folderId: 'c1-board', privateTo: otherUid },
  ]);
  await write('moms', [
    { id: 'c1-mom-latest', folderId: 'c1-board', title: 'Board strategy', date: 4000, content: 'never-return-content' },
    { id: 'c1-mom-second', folderId: 'c1-board', title: 'Budget planning', date: 3000 },
    { id: 'c1-mom-third', folderId: 'c1-board', title: 'Launch details', date: 2000 },
    { id: 'c1-mom-old', folderId: 'c1-board', title: 'Old search phrase', date: 1000 },
    { id: 'c1-mom-hidden', folderId: 'c1-board', title: 'Other private agenda', date: 9000, privateTo: otherUid },
    { id: 'c1-mom-deleted', folderId: 'c1-board', title: 'Deleted agenda', date: 10000, deleted: true },
    { id: 'c1-mom-private', folderId: 'c1-own', title: 'Owner agenda', date: 1000, privateTo: OWNER_UID },
    { id: 'c1-mom-locked', folderId: 'c1-locked', title: 'Secret locked agenda', date: 1000 },
    { id: 'c1-mom-child-locked', folderId: 'c1-locked-child', title: 'Secret child agenda', date: 1000 },
    { id: 'c1-mom-blank', folderId: 'c1-internal', title: ' ', created: 1000 },
  ]);
});

after(async () => {
  if (fixtureDb && refs.length) {
    const batch = fixtureDb.batch();
    for (const ref of refs) batch.delete(ref);
    await batch.commit();
  }
  await Promise.all(getApps().map(deleteApp));
});

const read = (args = {}) => listPlaces(context, args);
const ids = value => value.places.map(place => place.id);

test('the owner identity is resolved once and contains the Auth uid and display name', async t => {
  assert.deepEqual(context.owner, { uid: OWNER_UID, name: 'Connector owner' });
  const lookup = t.mock.method(context.auth, 'getUserByEmail', () => { throw new Error('a second lookup'); });
  assert.equal(await getWorkbench(readSettings()), context);
  assert.equal(lookup.mock.callCount(), 0);
});

test('another admin, deleted ancestors, missing parents and cycles are hidden; own private areas remain marked', async () => {
  const value = await read();
  for (const id of ['c1-other', 'c1-other-child', 'c1-deleted', 'c1-deleted-child', 'c1-orphan', 'c1-cycle-a', 'c1-cycle-b', 'c1-self', 'c1-invalid-privacy']) {
    assert.ok(!ids(value).includes(id), id);
  }
  assert.equal(value.places.find(place => place.id === 'c1-own').private, true);
  assert.equal(value.places.find(place => place.id === 'c1-own-child').private, true);
  assert.equal(value.places.find(place => place.id === 'c1-board').private, false);
  assert.equal(value.places.find(place => place.id === 'c1-board').path, 'Clients › Acme › Board');
  assert.equal(value.hasMore, false);
});

test('grouping kinds match the app and private or deleted groupings are omitted', async () => {
  const value = await read();
  assert.deepEqual(value.places.find(place => place.id === 'c1-board').groupings, [
    { id: 'c1-mom-group', name: 'Archive', holds: 'mom' },
    { id: 'c1-file-group', name: 'Decision files', holds: 'file' },
    { id: 'c1-both-group', name: 'Shared workshop', holds: 'both' },
  ]);
  assert.equal(value.places.find(place => place.id === 'c1-own').groupings[0].id, 'c1-own-group');
});

test('only the latest three visible MoM titles and dates are shown; direct and inherited locks hide all titles', async () => {
  const value = await read();
  assert.deepEqual(value.places.find(place => place.id === 'c1-board').recentMoms, [
    { title: 'Board strategy', date: 4000 }, { title: 'Budget planning', date: 3000 }, { title: 'Launch details', date: 2000 },
  ]);
  for (const id of ['c1-locked', 'c1-locked-child']) {
    const place = value.places.find(place => place.id === id);
    assert.equal(place.locked, true);
    assert.deepEqual(place.recentMoms, []);
  }
  const json = JSON.stringify(value);
  for (const secret of ['never-return-content', 'never-return-this-hash', 'Other private agenda', 'Deleted agenda', 'Secret locked agenda', 'Secret child agenda']) {
    assert.ok(!json.includes(secret), secret);
  }
});

test('query matches all words across paths, grouping names and titles, ignoring case, and keeps parents', async () => {
  for (const query of ['  ACME  BUDGET ', 'shared WORKSHOP', 'board strategy']) {
    assert.deepEqual(ids(await read({ query })), ['c1-clients', 'c1-acme', 'c1-board']);
  }
  assert.deepEqual(ids(await read({ query: 'acme' })), ['c1-clients', 'c1-acme', 'c1-board']);
  assert.deepEqual(await read({ query: 'no-such-topic' }), { places: [], hasMore: false });
  assert.deepEqual(await read({ query: '  ' }), await read());
  for (const query of ['Other admin private', 'Other admin grouping', 'Other private files', 'Deleted grouping', 'Other private agenda', 'Secret locked agenda', 'Secret child agenda', 'Old search phrase']) {
    assert.deepEqual(await read({ query }), { places: [], hasMore: false }, query);
  }
});

test('missing and blank labels have fallbacks; case duplicates keep separate IDs and long labels are preserved', async () => {
  const value = await read();
  assert.equal(value.places.find(place => place.id === 'c1-blank').path, 'Untitled area');
  assert.equal(value.places.find(place => place.id === 'c1-long').path, longName);
  assert.deepEqual(value.places.find(place => place.id === 'c1-internal').recentMoms, [{ title: 'Untitled meeting', date: null }]);
  assert.equal(value.places.find(place => place.id === 'c1-internal').groupings[0].name, 'Grouping');
  assert.ok(ids(value).includes('c1-clients'));
  assert.ok(ids(value).includes('c1-duplicate'));
  assert.ok(!ids(value).includes('stale-stored-id'));
});

test('renaming, moving, changing privacy and deleting a parent are reflected on the next read', async () => {
  await write('folders', [
    { id: 'c1-refresh', name: 'Before', parent: 'c1-acme' },
    { id: 'c1-refresh-child', name: 'Child', parent: 'c1-refresh' },
  ]);
  const ref = fixtureDb.collection('folders').doc('c1-refresh');
  assert.equal((await read()).places.find(place => place.id === ref.id).path, 'Clients › Acme › Before');
  await ref.update({ name: 'After', parent: 'c1-internal' });
  assert.equal((await read()).places.find(place => place.id === 'c1-refresh-child').path, 'Internal › After › Child');
  await ref.update({ privateTo: otherUid });
  assert.ok(!ids(await read()).includes('c1-refresh-child'));
  await ref.update({ privateTo: null, deleted: 123 });
  assert.ok(!ids(await read()).includes('c1-refresh-child'));
});

test('the 200-area cap reports hasMore and never returns a child without its retained parents', async () => {
  await write('folders', Array.from({ length: 205 }, (_, index) => ({
    id: `c1-cap-${index}`, name: `cap-chain ${index}`, ...(index && { parent: `c1-cap-${index - 1}` }),
  })));
  const value = await read({ query: 'cap-chain' });
  assert.equal(value.places.length, 200);
  assert.equal(value.hasMore, true);
  assert.deepEqual(ids(value), Array.from({ length: 200 }, (_, index) => `c1-cap-${index}`));
});

test('the Vercel fetch entry serves list_places through real MCP against the emulators, without writing', async () => {
  const before = await fixtureDb.collection('folders').get();
  const { response, data } = await rpcResponse(endpoint.fetch, rpc('tools/call', { name: 'list_places', arguments: { query: 'budget' } }));
  assert.equal(response.status, 200);
  assert.ok(!data.result.isError);
  assert.deepEqual(ids(data.result.structuredContent), ['c1-clients', 'c1-acme', 'c1-board']);
  assert.deepEqual(JSON.parse(data.result.content[0].text), data.result.structuredContent);
  const after = await fixtureDb.collection('folders').get();
  assert.deepEqual(after.docs.map(doc => doc.data()), before.docs.map(doc => doc.data()));
});

test('MoMs on the same day list the newest-made first, whatever their ids', async () => {
  await write('folders', [{ id: 'c1-sameday', name: 'Same day' }]);
  await write('moms', [
    { id: 'c1-sd-z', folderId: 'c1-sameday', title: 'Made first', date: 5000, created: 1 },
    { id: 'c1-sd-a', folderId: 'c1-sameday', title: 'Made third', date: 5000, created: 3 },
    { id: 'c1-sd-m', folderId: 'c1-sameday', title: 'Made second', date: 5000, created: 2 },
    { id: 'c1-sd-b', folderId: 'c1-sameday', title: 'Made last', date: 5000, created: 4 },
  ]);
  const place = (await read({ query: 'Same day' })).places.find(item => item.id === 'c1-sameday');
  assert.deepEqual(place.recentMoms.map(mom => mom.title), ['Made last', 'Made third', 'Made second']);
});
