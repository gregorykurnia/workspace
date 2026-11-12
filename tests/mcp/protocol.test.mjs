import './setup.mjs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { CLOUD_URL, FILE, LINK, NOTES, callTool, connectClient, createPlace, saveChat, startConnector } from './http.mjs';

const owner = { uid: 'c4-protocol-owner', email: 'c4-protocol@example.test', displayName: 'C4 owner' };
let app, db, place, http;

before(async () => {
  app = initializeApp({ projectId: 'demo-workspace' }, 'c4-protocol-fixtures');
  db = getFirestore(app);
  await getAuth(app).createUser(owner);
  place = await createPlace(db, 'c4-protocol');
  http = await startConnector({ ownerEmail: owner.email });
});
after(async () => {
  if (http) await http.close();
  if (place) await place.cleanup();
  if (app) await getAuth(app).deleteUser(owner.uid);
  for (const app of getApps()) await deleteApp(app);
});

test('SDK Streamable HTTP discovers four tools and all six instructions, then saves notes, a link and an uploaded PDF', async t => {
  const client = await connectClient(http.origin);
  t.after(() => client.close());
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name), ['list_places', 'save_mom', 'save_link', 'save_file']);
  const steps = client.getInstructions().split('\n').slice(1);
  assert.equal(steps.length, 6);
  const required = [
    ['Pick the form', 'whole chat → MoM', 'web address', '→ link', 'owner uploaded', '→ file'],
    ['Call list_places', 'client, project or topic words', 'without a query if nothing matches'],
    ['form, title, full path (area › grouping)', 'one line on why', 'up to three', 'Never invent an area'],
    ["owner's yes in chat", "tool approval prompt isn't a yes", "already named the place and form, don't ask again"],
    ['curl', 'code sandbox', "can't reach the address", 'base64 under 1 MB', 'save a link instead'],
    ['After saving, give the link', 'On an error, say it plainly', "answer was lost, ask before trying again"],
  ];
  required.forEach((phrases, i) => {
    assert.ok(steps[i].startsWith(`${i + 1}. `));
    for (const phrase of phrases) assert.ok(steps[i].includes(phrase), phrase);
  });
  for (const tool of tools) {
    assert.match(tool.description, /list_places|Find visible Workbench areas/);
    assert.match(tool.description, /only after the owner says yes in chat/);
    assert.match(tool.description, /ask before retrying/);
  }
  const places = await callTool(client, 'list_places', { query: place.area.name });
  const found = places.places.find(area => area.id === place.area.id);
  assert.equal(found.path, `${place.root.name} › ${place.area.name}`);
  assert.deepEqual(found.groupings, [{ id: place.group.id, name: place.group.name, holds: 'both' }]);

  const { mom, link, file, pending } = await saveChat(client, place);
  for (const item of [mom, link, file]) {
    assert.equal(item.path, place.path);
    assert.equal(item.url, `${http.origin}/#/${item === mom ? `mom/${mom.id}` : `areas/${place.area.id}`}`);
    const saved = (await db.collection(item === mom ? 'moms' : 'docs').doc(item.id).get()).data();
    assert.equal(saved.folderId, place.area.id);
    assert.equal(saved[item === mom ? 'momFolderId' : 'docFolderId'], place.group.id);
    assert.equal(saved.source, 'claude-chat');
    assert.deepEqual(saved.createdBy, { uid: owner.uid, name: owner.displayName });
  }
  const note = (await db.collection('moms').doc(mom.id).get()).data();
  for (const html of ['<h1>Connector minutes</h1>', '<ul>', '☐ Send the report', '<table>']) assert.ok(note.content.includes(html), html);
  assert.equal(note.title, NOTES.title);
  assert.equal((await db.collection('docs').doc(link.id).get()).data().url, LINK.url);
  assert.equal((await db.collection('docs').doc(file.id).get()).data().url, CLOUD_URL);
  assert.equal(http.uploads.length, 1);
  assert.equal(await http.uploads[0].text(), FILE.bytes);
  assert.equal(pending.curl, `curl -sS -F file=@<path> '${pending.uploadUrl}'`);
  assert.ok(Date.parse(pending.expiresAt) > Date.now());
  // The new MoM must also ripple into place suggestions, including its title and grouping.
  const refreshed = await callTool(client, 'list_places', { query: NOTES.title });
  assert.ok(refreshed.places.find(area => area.id === place.area.id).recentMoms.some(item => item.title === NOTES.title));
});

test('HTTP validation rejects missing, blank and oversized input without writing; duplicates keep distinct IDs', async t => {
  const client = await connectClient(http.origin);
  t.after(() => client.close());
  const before = (await place.records()).length;
  for (const args of [{}, { areaId: place.area.id, title: '   ', markdown: '' }]) {
    await assert.rejects(client.callTool({ name: 'save_mom', arguments: args }), /nonempty title/);
  }
  const oversized = await client.callTool({ name: 'save_mom', arguments: { areaId: place.area.id, title: 'Too long', markdown: 'x'.repeat(500 * 1024 + 1) } });
  assert.equal(oversized.isError, true);
  assert.match(oversized.content[0].text, /over 500 KB/);
  const missing = await client.callTool({ name: 'save_link', arguments: { areaId: 'c4-missing', ...LINK } });
  assert.equal(missing.isError, true);
  assert.equal((await place.records()).length, before);
  const first = await callTool(client, 'save_mom', { areaId: place.area.id, ...NOTES });
  const second = await callTool(client, 'save_mom', { areaId: place.area.id, ...NOTES, title: NOTES.title.toLowerCase() });
  assert.notEqual(first.id, second.id);
  assert.equal((await place.records()).length, before + 2);
});

test('a lost HTTP save reply leaves one record; reconnecting discovers it without automatically retrying', async t => {
  let loseReply = false;
  const client = await connectClient(http.origin, async (url, init) => {
    const response = await fetch(url, init);
    if (loseReply && JSON.parse(init.body || '{}').method === 'tools/call') {
      loseReply = false;
      await response.arrayBuffer(); // The handler committed; only its answer is lost.
      throw new TypeError('C4 deliberately lost the save reply');
    }
    return response;
  });
  t.after(() => client.close());
  const before = (await place.records()).length;
  const title = 'C4 lost reply';
  loseReply = true;
  await assert.rejects(callTool(client, 'save_mom', { areaId: place.area.id, title, markdown: '# Kept' }), /lost the save reply/);
  await client.close();
  const reconnected = await connectClient(http.origin);
  t.after(() => reconnected.close());
  const places = await callTool(reconnected, 'list_places', { query: title });
  assert.equal(places.places.find(area => area.id === place.area.id).recentMoms.filter(mom => mom.title === title).length, 1);
  assert.equal((await place.records()).length, before + 1);
});
