// Shared by the SDK protocol test and the emulator browser test. Never talks to real Cloudinary.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHandler } from '../../api/_lib/server.mjs';
import { createUploadHandler } from '../../api/_lib/upload.mjs';
import { assertEmulatorEnv } from './emulator-guard.mjs';

export const SECRET = 'c4-local-test-only';
export const NOTES = {
  title: 'Connector notes — 日本語',
  markdown: '# Connector minutes\n\n- Board approved the proposal\n- [ ] Send the report\n\n| Owner | Status |\n| --- | --- |\n| Ayu | Ready |',
};
export const LINK = { name: 'Connector reference', url: 'https://example.test/board', note: 'Board reference' };
export const FILE = { name: 'Connector report.pdf', bytes: '%PDF-1.7\nConnector report — 日本語\n%%EOF\n' };
export const CLOUD_URL = 'https://files.example.test/connector-report.pdf';

export async function startConnector({ ownerEmail, appUrl } = {}) {
  assertEmulatorEnv();
  if (appUrl) assert.ok(['127.0.0.1', 'localhost'].includes(new URL(appUrl).hostname), 'the app must be local');
  const uploads = [];
  const uploadFetch = async (url, options) => {
    assert.equal(url, 'https://api.cloudinary.com/v1_1/dgznvawnm/raw/upload');
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('upload_preset'), 'workspace_uploads');
    uploads.push(options.body.get('file'));
    return Response.json({ secure_url: CLOUD_URL, resource_type: 'raw' });
  };
  const env = {
    MCP_SECRET: SECRET, WORKBENCH_OWNER_EMAIL: ownerEmail,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  };
  const mcp = createHandler({ env, uploadFetch });
  const upload = createUploadHandler({ env, uploadFetch });
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${server.address().port}`);
      let response;
      if (/^\/api\/(mcp|upload)\//.test(url.pathname)) {
        const abort = new AbortController();
        req.once('aborted', () => abort.abort());
        res.once('close', () => { if (!res.writableFinished) abort.abort(); });
        const request = new Request(url, {
          method: req.method, headers: req.headers, signal: abort.signal,
          ...(!['GET', 'HEAD'].includes(req.method) && { body: Readable.toWeb(req), duplex: 'half' }),
        });
        response = await (url.pathname.startsWith('/api/mcp/') ? mcp : upload)(request);
      } else if (appUrl && ['GET', 'HEAD'].includes(req.method)) {
        // Keep the returned app links on the API's actual origin, serving only the local test app.
        response = await fetch(new URL(url.pathname + url.search, appUrl), { method: req.method, redirect: 'manual' });
      } else response = new Response('Not found', { status: 404 });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) await pipeline(Readable.fromWeb(response.body), res);
      else res.end();
    } catch (error) { res.destroy(error); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`, uploads,
    close: () => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}

export async function connectClient(origin, fetcher = globalThis.fetch) {
  const client = new Client({ name: 'Workbench C4 test', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(`/api/mcp/${SECRET}`, origin), { fetch: fetcher }));
    return client;
  } catch (error) { await client.close(); throw error; }
}

export async function callTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, JSON.stringify(result.content));
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  return result.structuredContent;
}

export async function createPlace(db, prefix) {
  const root = { id: `${prefix}-root`, name: `${prefix} root`, privateTo: null, created: Date.now() };
  const area = { id: `${prefix}-area`, name: `${prefix} area`, parent: root.id, privateTo: null, created: Date.now() };
  const group = { id: `${prefix}-group`, name: 'Board', folderId: area.id, holds: 'both', privateTo: null };
  const refs = [db.collection('folders').doc(root.id), db.collection('folders').doc(area.id), db.collection('momfolders').doc(group.id)];
  const batch = db.batch();
  [root, area, group].forEach((data, i) => batch.set(refs[i], data));
  await batch.commit();
  const records = async () => (await Promise.all(['moms', 'docs'].map(collection => db.collection(collection).where('folderId', '==', area.id).get())))
    .flatMap(snapshot => snapshot.docs);
  return {
    root, area, group, path: `${root.name} › ${area.name} › ${group.name}`, records,
    cleanup: async () => {
      const batch = db.batch();
      for (const ref of [...refs, ...(await records()).map(doc => doc.ref)]) batch.delete(ref);
      await batch.commit();
    },
  };
}

export async function saveChat(client, place) {
  const destination = { areaId: place.area.id, groupId: place.group.id };
  const mom = await callTool(client, 'save_mom', { ...destination, ...NOTES, date: '2026-11-12', tags: ['chat'] });
  const link = await callTool(client, 'save_link', { ...destination, ...LINK });
  const pending = await callTool(client, 'save_file', { ...destination, name: FILE.name });
  const body = new FormData();
  body.append('file', new Blob([FILE.bytes], { type: 'application/pdf' }), FILE.name);
  const response = await fetch(pending.uploadUrl, { method: 'POST', body });
  assert.equal(response.status, 200);
  return { mom, link, file: await response.json(), pending };
}
