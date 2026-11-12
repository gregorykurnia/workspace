import { request, rpc, rpcResponse, SECRET, OWNER_EMAIL } from './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../../api/_lib/server.mjs';
import { readSettings } from '../../api/_lib/firebase.mjs';

const env = {
  MCP_SECRET: SECRET, WORKBENCH_OWNER_EMAIL: OWNER_EMAIL,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
};
const handle = createHandler({ env });

test('wrong, missing, differently sized and malformed secrets give 404 before configuration or JSON parsing', async () => {
  for (const secret of ['', 'wrong', SECRET + 'longer', '%ZZ', 'x'.repeat(2000)]) {
    const response = await createHandler({ env: { MCP_SECRET: SECRET } })(request('{', { secret, raw: true }));
    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'Not found');
  }
  for (const value of [undefined, '', '   ']) {
    assert.equal((await createHandler({ env: { MCP_SECRET: value } })(request(rpc('ping')))).status, 404);
  }
  const response = await handle(new Request(`http://localhost/api/mcp?secret=${SECRET}`));
  assert.equal(response.status, 404);
});

test('all non-POST methods with the right secret give 405 and Allow: POST', async () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'DELETE', 'PUT', 'PATCH']) {
    const response = await handle(request(rpc('ping'), { method }));
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get('Allow'), 'POST');
  }
});

test('JSON media types are case insensitive and may include a charset', async () => {
  const response = await handle(request(rpc('ping'), { headers: { 'Content-Type': 'Application/JSON; charset=utf-8' } }));
  assert.equal(response.status, 200);
});

test('bad content types, broken JSON, batches and malformed RPC are rejected before the SDK', async () => {
  const unsupported = await handle(request(rpc('ping'), { headers: { 'Content-Type': 'text/plain' } }));
  assert.equal(unsupported.status, 415);
  const broken = await handle(request('{', { raw: true }));
  assert.equal((await broken.json()).error.code, -32700);
  for (const body of [null, [], [rpc('ping')], { method: 'ping', id: 1 }, { jsonrpc: '2.0', method: 1, id: 1 }]) {
    const response = await handle(request(body));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, -32600);
  }
  const { response, data } = await rpcResponse(handle, rpc('tools/call', { name: 'list_places', arguments: { query: 12 } }, 'bad-query'));
  assert.equal(response.status, 400);
  assert.equal(data.id, 'bad-query');
  assert.equal(data.error.code, -32602);
  const malformedName = await rpcResponse(handle, rpc('tools/call', { name: { toString: null }, arguments: {} }));
  assert.equal(malformedName.data.error.code, -32602);
});

test('missing settings name only the setting and preserve the RPC id', async () => {
  const sensitive = 'never-return-this-value';
  for (const name of ['WORKBENCH_OWNER_EMAIL', 'FIREBASE_SERVICE_ACCOUNT']) {
    for (const value of [undefined, '', '   ']) {
      const settings = { MCP_SECRET: SECRET, WORKBENCH_OWNER_EMAIL: sensitive, FIREBASE_SERVICE_ACCOUNT: sensitive, [name]: value };
      const { response, data } = await rpcResponse(createHandler({ env: settings }), rpc('ping', {}, 'config'));
      assert.equal(response.status, 500);
      assert.equal(data.id, 'config');
      assert.equal(data.error.message, `Missing setting: ${name}.`);
      assert.ok(!JSON.stringify(data).includes(sensitive));
      assert.ok(!JSON.stringify(data).includes(SECRET));
    }
  }
});

test('malformed credentials and partial emulator settings never reveal their values', () => {
  const base = { WORKBENCH_OWNER_EMAIL: OWNER_EMAIL };
  for (const credential of ['invalid-private-value', Buffer.from('{"private_key":"never-return-this-key"}').toString('base64'), Buffer.from('null').toString('base64'),
    Buffer.from(JSON.stringify({ project_id: 'private-project', client_email: 'secret@example.test', private_key: 'never-return-this-key' })).toString('base64')]) {
    assert.throws(() => readSettings({ ...base, FIREBASE_SERVICE_ACCOUNT: credential }), {
      message: 'Invalid setting: FIREBASE_SERVICE_ACCOUNT. Use base64-encoded service-account JSON.',
    });
  }
  assert.throws(() => readSettings({ ...base, FIRESTORE_EMULATOR_HOST: 'localhost:8085' }), /Missing setting: FIREBASE_AUTH_EMULATOR_HOST/);
  assert.throws(() => readSettings({ ...base, FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' }), /Missing setting: FIRESTORE_EMULATOR_HOST/);
  assert.throws(() => readSettings({ ...base, FIRESTORE_EMULATOR_HOST: 'sensitive-host:8085', FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' }), {
    message: 'Invalid setting: FIRESTORE_EMULATOR_HOST. Use a local emulator.',
  });
  assert.deepEqual(readSettings({ ...env, FIREBASE_SERVICE_ACCOUNT: 'ignored-on-emulators' }), { email: OWNER_EMAIL, projectId: 'demo-workspace' });
});

test('initialize advertises the confirmation instructions and tools/list exposes the implemented tools', async () => {
  const { response, data } = await rpcResponse(handle, rpc('initialize', {
    protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'C1 tests', version: '1.0' },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('mcp-session-id'), null);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  for (const phrase of ['MoM', 'list_places', 'up to three', 'Never invent an area', "tool approval prompt isn't a yes", 'already named', 'curl', 'base64 under 1 MB', "answer was lost, ask before trying again"]) {
    assert.ok(data.result.instructions.includes(phrase), phrase);
  }
  const listed = await rpcResponse(handle, rpc('tools/list'));
  assert.deepEqual(listed.data.result.tools.map(tool => tool.name), ['list_places', 'save_mom', 'save_link', 'save_file', 'find_items', 'read_mom']);
  assert.equal(listed.data.result.tools[0].annotations.readOnlyHint, true);
  for (const tool of listed.data.result.tools.slice(1, 4)) {
    assert.equal(tool.annotations.readOnlyHint, false);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.annotations.idempotentHint, false);
    assert.ok(tool.description.includes('only after the owner says yes in chat'));
    assert.ok(tool.description.includes('ask before retrying'));
  }
  for (const tool of listed.data.result.tools.slice(4)) {
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.idempotentHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
  }
});

test('an incomplete read returns no partial places or internal error and a retry can succeed', async () => {
  let calls = 0;
  const fake = createHandler({ env, getContext: async () => ({
    owner: { uid: 'test-owner' },
    db: { collection: name => ({ select: () => ({ get: async () => {
      if (name === 'moms' && calls++ === 0) throw new Error('private-key-and-database-address');
      return { docs: name === 'folders' ? [{ id: 'public', data: () => ({ name: 'Public' }) }] : [] };
    } }) }) },
  }) });
  const body = rpc('tools/call', { name: 'list_places', arguments: {} });
  const failed = (await rpcResponse(fake, body)).data.result;
  assert.equal(failed.isError, true);
  assert.deepEqual(failed.content, [{ type: 'text', text: 'Could not read Workbench places. Try again shortly.' }]);
  assert.ok(!('structuredContent' in failed));
  const retried = (await rpcResponse(fake, body)).data.result;
  assert.equal(retried.structuredContent.places[0].id, 'public');
});
