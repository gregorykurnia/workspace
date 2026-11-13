import { OWNER_EMAIL, OWNER_UID, SECRET, rpc, rpcResponse } from './setup.mjs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHandler } from '../../api/_lib/server.mjs';
import { listPlaces } from '../../api/_lib/places.mjs';
import { createArea } from '../../api/_lib/areas.mjs';
import { saveMom } from '../../api/_lib/saves.mjs';

const otherUid = 'c8-other-admin';
const areas = [
  { id: 'c8-root', name: 'Prospects' },
  { id: 'c8-private', name: 'Planning', privateTo: OWNER_UID },
  { id: 'c8-other', name: 'Other admin', privateTo: otherUid },
  { id: 'c8-deleted', name: 'Deleted', deleted: true },
  { id: 'c8-deleted-child', name: 'Below deleted', parent: 'c8-deleted' },
  { id: 'c8-existing', name: 'Acme Corp', parent: 'c8-root' },
  { id: 'c8-hidden-twin', name: 'Hidden twin', parent: 'c8-root', privateTo: otherUid },
  { id: 'c8-deleted-twin', name: 'Gone twin', parent: 'c8-root', deleted: true },
  { id: 'c8-own-private', name: 'Café', parent: 'c8-root', privateTo: OWNER_UID },
];
let app, db, context, handler;
const env = {
  MCP_SECRET: SECRET, WORKBENCH_OWNER_EMAIL: OWNER_EMAIL,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
};
const call = async (args, handle = handler) => (await rpcResponse(handle, rpc('tools/call', { name: 'create_area', arguments: args }))).data;
const madeHere = async () => (await db.collection('folders').where('source', '==', 'claude-chat').get()).docs
  .filter(doc => String(doc.data().parent).startsWith('c8-') || made.has(doc.data().parent));
const made = new Set();
async function create(args, now) {
  const result = await createArea(context, args, now);
  made.add(result.id);
  return result;
}

before(async () => {
  app = initializeApp({ projectId: 'demo-workspace' }, 'mcp-c8-fixtures');
  db = getFirestore(app);
  context = { db, owner: { uid: OWNER_UID, name: 'Connector owner' }, origin: 'https://preview.example.test' };
  handler = createHandler({ env, getContext: async () => context });
  const batch = db.batch();
  for (const area of areas) batch.set(db.collection('folders').doc(area.id), area);
  await batch.commit();
});

after(async () => {
  if (db) {
    const batch = db.batch();
    for (const area of areas) batch.delete(db.collection('folders').doc(area.id));
    for (const doc of await madeHere()) batch.delete(doc.ref);
    const moms = await db.collection('moms').where('source', '==', 'claude-chat').get();
    for (const doc of moms.docs) if (made.has(doc.data().folderId)) batch.delete(doc.ref);
    await batch.commit();
  }
  if (app) await deleteApp(app);
});

test('a sub-area is written as the app writes one, and a sub-area of it nests below', async () => {
  const now = Date.parse('2026-11-13T03:00:00Z');
  const first = await create({ parentId: 'c8-root', name: '  abc  ' }, now);
  assert.deepEqual(first, { id: first.id, path: 'Prospects › abc', url: `${context.origin}/#/areas/${first.id}`, created: true, private: false });
  assert.deepEqual((await db.collection('folders').doc(first.id).get()).data(), {
    id: first.id, name: 'abc', icon: '🌿', parent: 'c8-root', created: now, privateTo: null,
    createdBy: context.owner, source: 'claude-chat',
  });
  const second = await create({ parentId: first.id, name: 'Kickoff' }, now);
  assert.equal(second.path, 'Prospects › abc › Kickoff');
  assert.equal(second.created, true);
  const listed = await listPlaces(context, { query: 'kickoff' });
  assert.deepEqual(listed.places.map(place => place.path), ['Prospects', 'Prospects › abc', 'Prospects › abc › Kickoff']);
  const saved = await saveMom(context, { areaId: second.id, title: 'First call', markdown: 'Notes' });
  assert.equal(saved.path, 'Prospects › abc › Kickoff');
});

test('a sub-area of a private area stays private to the owner', async () => {
  const result = await create({ parentId: 'c8-private', name: 'Board' });
  assert.equal(result.path, 'Planning › Board');
  assert.equal(result.private, true);
  assert.equal((await db.collection('folders').doc(result.id).get()).data().privateTo, OWNER_UID);
  const nested = await create({ parentId: result.id, name: 'Q4' });
  assert.equal((await db.collection('folders').doc(nested.id).get()).data().privateTo, OWNER_UID);
});

test('the same name under the same parent returns the existing visible sub-area and writes nothing', async () => {
  const before = (await madeHere()).length;
  const result = await create({ parentId: 'c8-root', name: ' acme CORP ' });
  assert.deepEqual(result, { id: 'c8-existing', path: 'Prospects › Acme Corp', url: `${context.origin}/#/areas/c8-existing`, created: false, private: false });
  assert.equal((await madeHere()).length, before);
  const made = await create({ parentId: 'c8-root', name: 'Retry me' });
  const again = await create({ parentId: 'c8-root', name: 'RETRY ME' });
  assert.deepEqual([again.id, again.created, again.path], [made.id, false, 'Prospects › Retry me']);
  // The same letters in another Unicode form (e + combining accent) are the same name, and an
  // existing private sibling is reported as private.
  const accent = await create({ parentId: 'c8-root', name: 'cafe\u0301' });
  assert.deepEqual([accent.id, accent.created, accent.private], ['c8-own-private', false, true]);
  assert.equal((await madeHere()).length, before + 1);
});

test('a hidden or deleted sibling with the same name does not stop a new visible sub-area', async () => {
  for (const name of ['Hidden twin', 'Gone twin']) {
    const result = await create({ parentId: 'c8-root', name });
    assert.equal(result.created, true, name);
    assert.ok(!['c8-hidden-twin', 'c8-deleted-twin'].includes(result.id));
  }
});

test('a missing, hidden or deleted parent is refused with nothing written', async () => {
  const before = (await madeHere()).length;
  for (const parentId of ['c8-missing', 'c8-other', 'c8-deleted', 'c8-deleted-child']) {
    await assert.rejects(createArea(context, { parentId, name: 'New' }), /Choose an existing, visible Workbench area/, parentId);
  }
  for (const input of [{ parentId: 'c8-root', name: '   ' }, { parentId: 'c8-root', name: 'x'.repeat(201) }, { parentId: 'c8-root', name: 'Q4 › Board' }, { parentId: 'c8-root', name: 'Two\nlines' }, { parentId: 'c8/root', name: 'New' }, { name: 'New' }]) {
    await assert.rejects(createArea(context, input), /Check create_area inputs/);
  }
  assert.equal((await madeHere()).length, before);
});

test('HTTP advertises create_area, returns structured results and rejects invalid input before Firebase', async () => {
  const listed = (await rpcResponse(handler, rpc('tools/list'))).data.result.tools;
  const tool = listed.find(tool => tool.name === 'create_area');
  assert.equal(tool.annotations.readOnlyHint, false);
  assert.equal(tool.annotations.destructiveHint, false);
  assert.ok(tool.description.includes('only after the owner says yes in chat'));
  const response = (await call({ parentId: 'c8-root', name: 'Over HTTP' })).result;
  made.add(response.structuredContent.id);
  assert.deepEqual(JSON.parse(response.content[0].text), response.structuredContent);
  assert.equal(response.structuredContent.url, `http://localhost/#/areas/${response.structuredContent.id}`);
  const hidden = (await call({ parentId: 'c8-other', name: 'Nope' })).result;
  assert.equal(hidden.isError, true);
  assert.match(hidden.content[0].text, /Choose an existing, visible Workbench area/);
  const noContext = createHandler({ env, getContext: () => assert.fail('Invalid input reached Firebase') });
  for (const input of [{}, { parentId: 'c8-root' }, { parentId: 'c8-root', name: '' }, { parentId: 'a/b', name: 'x' }, { parentId: 'c8-root', name: 5 }, { parentId: 'c8-root', name: 'a›b' }]) {
    assert.equal((await call(input, noContext)).error.code, -32602);
  }
});
