import './setup.mjs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { CLOUD_URL, FILE, LINK, NOTES, callTool, connectClient, createPlace, saveChat, startConnector } from './http.mjs';

const owner = { uid: 'c4-protocol-owner', email: 'c4-protocol@example.test', displayName: 'C4 owner' };
const editedIds = new Set();
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
  for (const id of editedIds) {
    const backups = await db.collection('mom_backups').where('momId', '==', id).get();
    await Promise.all(backups.docs.map(doc => doc.ref.delete()));
  }
  if (place) await place.cleanup();
  if (app) await getAuth(app).deleteUser(owner.uid);
  for (const app of getApps()) await deleteApp(app);
});

test('SDK Streamable HTTP discovers eight tools and all ten instructions, then saves notes, a link and an uploaded PDF', async t => {
  const client = await connectClient(http.origin);
  t.after(() => client.close());
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name), ['list_places', 'save_mom', 'save_link', 'save_file', 'find_items', 'read_mom', 'edit_mom', 'create_area']);
  const steps = client.getInstructions().split('\n').slice(1);
  assert.equal(steps.length, 10);
  const required = [
    ['Pick the form', 'whole chat → MoM', 'web address', '→ link', 'owner uploaded', '→ file'],
    ['Call list_places', 'client, project or topic words', 'without a query if nothing matches'],
    ['form, title, full path (area › grouping)', 'one line on why', 'up to three', 'Never invent an area'],
    ["owner's yes in chat", "tool approval prompt isn't a yes", "already named the place and form, don't ask again"],
    ['curl', 'code sandbox', "can't reach the address", 'base64 under 1 MB', 'save a link instead'],
    ['After saving, give the link', 'On an error, say it plainly', "answer was lost, ask before trying again"],
    ['call find_items', 'meeting, client or topic words', 'any date the owner gave', 'relative date', 'yyyy-mm-dd', 'today in Asia/Jakarta', 'say the date used', 'latest one not in the future', 'One MoM match → read_mom', 'up to five (title, date, path)', 'ask which', 'none → say so', 'company, area or rough date', 'search again with fewer words', 'Never pick between matches yourself'],
    ['notes or exact content', 'quote what read_mom returns', 'say so when summarising instead'],
    ['read_mom first', 'new text', 'before → after', "owner's yes in chat", "tool approval prompt isn't a yes", 'Prefer append', 'only when asked to change existing text', "section isn't plain", 'formatting would be lost', 'offer to append instead', 'changed since you read it', 'read again and show the change again', 'give the link', '"undo" puts it back', "answer was lost, read the MoM again and ask before retrying"],
    ['New sub-areas', 'only when the owner asks for one', 'Call list_places to find the parent', 'ask which', 'full new path', "create_area only after the owner's yes", "already named the parent and the name, don't ask again", 'each level in turn', 'created: false'],
  ];
  required.forEach((phrases, i) => {
    assert.ok(steps[i].startsWith(`${i + 1}. `));
    for (const phrase of phrases) assert.ok(steps[i].includes(phrase), phrase);
  });
  for (const tool of tools.slice(0, 4)) {
    assert.match(tool.description, /list_places|Find visible Workbench areas/);
    assert.match(tool.description, /only after the owner says yes in chat/);
    assert.match(tool.description, /ask before retrying/);
  }
  const descriptions = Object.fromEntries(tools.map(tool => [tool.name, tool.description]));
  for (const phrase of ['meeting, client or topic', 'relative dates', 'Asia/Jakarta', 'yyyy-mm-dd', 'say the date used', 'latest date not in the future', 'One MoM match: read_mom', 'up to five', 'title, date and path', 'ask which', 'never choose yourself', 'none:', 'fewer words']) assert.ok(descriptions.find_items.includes(phrase), phrase);
  for (const phrase of ['find_items', 'quote what read_mom returns', 'summarising', 'Read before editing', 'before → after', "owner's yes in chat", 'plain: false', 'append instead']) assert.ok(descriptions.read_mom.includes(phrase), phrase);
  for (const phrase of ['read_mom first', 'new text', 'before → after', 'only after the owner says yes in chat', 'tool approval is not a yes', 'Prefer append', 'only when asked to change existing text', 'plain is false', 'formatting would be lost', 'append instead', 'expectEdited', 'read again and show the change again', 'give the link', 'undo puts it back', 'answer was lost', 'ask before retrying']) assert.ok(descriptions.edit_mom.includes(phrase), phrase);
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
  const matches = await callTool(client, 'find_items', { areaId: place.area.id, query: NOTES.title, kind: 'mom' });
  assert.deepEqual(matches.items.map(item => item.id), [mom.id]);
  const pulled = await callTool(client, 'read_mom', { id: mom.id });
  assert.equal(pulled.title, NOTES.title);
  assert.match(pulled.markdown, /# Connector minutes/);
  assert.ok(pulled.sections.every(section => section.plain));
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
  const ambiguous = await callTool(client, 'find_items', { areaId: place.area.id, query: NOTES.title.toUpperCase(), kind: 'mom' });
  assert.ok(ambiguous.total >= 2);
  for (const id of [first.id, second.id]) assert.ok(ambiguous.items.some(item => item.id === id));
});

test('Streamable HTTP finds and reads a MoM, appends, replaces one numbered section, and undoes the replacement', async t => {
  const client = await connectClient(http.origin);
  t.after(() => client.close());
  const saved = await callTool(client, 'save_mom', {
    areaId: place.area.id, groupId: place.group.id, title: 'C7 section workflow',
    markdown: '# Agenda\n\nKeep the agenda.\n\n## Decisions\n\nOriginal decision.\n\n## Decisions\n\nKeep the other section.',
  });
  editedIds.add(saved.id);
  const ref = db.collection('moms').doc(saved.id);
  const before = (await ref.get()).data();
  const matches = await callTool(client, 'find_items', { query: 'C7 section workflow', areaId: place.area.id, kind: 'mom' });
  assert.deepEqual(matches.items.map(item => item.id), [saved.id]);
  assert.equal(matches.total, 1);
  const read = await callTool(client, 'read_mom', { id: matches.items[0].id });
  assert.equal(read.edited, before.edited);

  const appended = await callTool(client, 'edit_mom', { id: read.id, expectEdited: read.edited, mode: 'append', markdown: 'C7 appended paragraph — 日本語.' });
  const afterAppend = (await ref.get()).data();
  assert.ok(afterAppend.content.startsWith(before.content));
  assert.match(afterAppend.content, /<p>C7 appended paragraph — 日本語\.<\/p>/);
  assert.equal(afterAppend.prevEdited, read.edited);
  assert.deepEqual(afterAppend.editedBy, { uid: owner.uid, name: owner.displayName });
  const bodyMatch = await callTool(client, 'find_items', { query: 'C7 appended paragraph', areaId: place.area.id });
  assert.deepEqual(bodyMatch.items.map(item => item.id), [read.id]);
  assert.equal(bodyMatch.items[0].matchedIn, 'body');
  assert.match(bodyMatch.items[0].snippet, /C7 appended paragraph/);

  const withAppend = await callTool(client, 'read_mom', { id: read.id });
  assert.equal(withAppend.edited, appended.edited);
  const repeated = withAppend.sections.filter(section => section.heading === 'Decisions');
  assert.equal(repeated.length, 2);
  assert.equal(repeated[0].plain, true);
  const replaced = await callTool(client, 'edit_mom', {
    id: read.id, expectEdited: withAppend.edited, mode: 'replace_section', section: repeated[0].n,
    markdown: '## Decisions\n\nC7 replacement approved.',
  });
  const withReplacement = await callTool(client, 'read_mom', { id: read.id });
  assert.equal(withReplacement.edited, replaced.edited);
  assert.match(withReplacement.sections[repeated[0].n].markdown, /C7 replacement approved/);
  assert.equal(withReplacement.sections[repeated[1].n].markdown, repeated[1].markdown);
  assert.doesNotMatch(withReplacement.markdown, /Original decision/);
  assert.match(withReplacement.markdown, /Keep the agenda/);

  const undone = await callTool(client, 'edit_mom', { id: read.id, expectEdited: withReplacement.edited, mode: 'undo' });
  const afterUndo = await callTool(client, 'read_mom', { id: read.id });
  assert.equal(afterUndo.edited, undone.edited);
  assert.equal(afterUndo.markdown, withAppend.markdown);
  assert.equal((await ref.get()).data().content, afterAppend.content);
  for (const result of [appended, replaced, undone]) assert.equal(result.url, saved.url);
  const history = (await db.collection('mom_backups').where('momId', '==', read.id).get()).docs
    .map(doc => doc.data()).sort((a, b) => a.afterEdited - b.afterEdited);
  assert.deepEqual(history.map(backup => backup.mode), ['append', 'replace_section', 'undo']);
  assert.equal(history[0].content, before.content);
  assert.equal(history[1].content, afterAppend.content);
  assert.equal(history[2].afterEdited, undone.edited);
});

test('a lost HTTP edit reply survives reconnecting; retrying the stale read cannot append twice', async t => {
  let loseReply = false;
  const client = await connectClient(http.origin, async (url, init) => {
    const response = await fetch(url, init);
    if (loseReply && JSON.parse(init.body || '{}').params?.name === 'edit_mom') {
      loseReply = false;
      await response.arrayBuffer();
      throw new TypeError('C7 deliberately lost the edit reply');
    }
    return response;
  });
  t.after(() => client.close());
  const saved = await callTool(client, 'save_mom', { areaId: place.area.id, title: 'C7 lost edit reply', markdown: '# Kept' });
  editedIds.add(saved.id);
  const read = await callTool(client, 'read_mom', { id: saved.id });
  const args = { id: read.id, expectEdited: read.edited, mode: 'append', markdown: 'C7 exactly once.' };
  loseReply = true;
  await assert.rejects(callTool(client, 'edit_mom', args), /lost the edit reply/);
  await client.close();
  const reconnected = await connectClient(http.origin);
  t.after(() => reconnected.close());
  const recovered = await callTool(reconnected, 'read_mom', { id: read.id });
  assert.equal(recovered.markdown.match(/C7 exactly once/g)?.length, 1);
  const retry = await reconnected.callTool({ name: 'edit_mom', arguments: args });
  assert.equal(retry.isError, true);
  assert.match(retry.content[0].text, /changed since you read it/);
  assert.deepEqual(await callTool(reconnected, 'read_mom', { id: read.id }), recovered);
  assert.equal((await db.collection('mom_backups').where('momId', '==', read.id).get()).size, 1);
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
