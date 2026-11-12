import { OWNER_EMAIL, OWNER_UID, SECRET, request, rpc, rpcResponse } from './setup.mjs';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import endpoint from '../../api/upload/[token].mjs';
import { createHandler } from '../../api/_lib/server.mjs';
import { createUploadHandler } from '../../api/_lib/upload.mjs';
import { MAX_INLINE_BYTES, MAX_UPLOAD_BYTES, UPLOAD_LIFETIME, saveFile } from '../../api/_lib/files.mjs';

const env = {
  MCP_SECRET: SECRET, WORKBENCH_OWNER_EMAIL: OWNER_EMAIL,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
};
const areas = [
  { id: 'c3-root', name: 'Clients' }, { id: 'c3-area', name: 'Acme', parent: 'c3-root' },
  { id: 'c3-private', name: 'Planning', privateTo: OWNER_UID },
  { id: 'c3-other', name: 'Other admin', privateTo: 'c3-other-admin' },
  { id: 'c3-hidden', name: 'Hidden child', parent: 'c3-other' },
  { id: 'c3-deleted', name: 'Deleted', deleted: true },
  { id: 'c3-changing', name: 'Changing', parent: 'c3-root' },
];
const groups = [
  ['docfolders', { id: 'c3-file', name: 'Files', folderId: 'c3-area' }],
  ['momfolders', { id: 'c3-both', name: 'Workshop', folderId: 'c3-area', holds: 'both' }],
  ['momfolders', { id: 'c3-mom', name: 'Notes', folderId: 'c3-area' }],
  ['docfolders', { id: 'c3-other-group', name: 'Wrong area', folderId: 'c3-other' }],
  ['docfolders', { id: 'c3-private-group', name: 'Private', folderId: 'c3-area', privateTo: 'c3-other-admin' }],
];
let app, db, context, handler, upload;
const fixtures = [], uploads = [];
const file = (extra = {}) => ({ areaId: 'c3-area', name: 'Report.pdf', ...extra });
const savedIds = async () => (await db.collection('docs').where('folderId', '>=', 'c3-').where('folderId', '<', 'c3.').get()).docs.map(doc => doc.id).sort();
const record = async result => (await db.collection('docs').doc(result.id).get()).data();
const cloudReply = (type = 'raw') => Response.json({ secure_url: 'https://storage.example.test/report', resource_type: type });
const fakeFetch = async (url, options) => {
  uploads.push({ url, ...options });
  assert.equal(options.method, 'POST');
  assert.equal(options.body.get('upload_preset'), 'workspace_uploads');
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(options.signal.aborted, false);
  return cloudReply(url.split('/').at(-2));
};
const call = async (args, handle = handler) => (await rpcResponse(handle, rpc('tools/call', { name: 'save_file', arguments: args }))).data;
const sign = (payload, secret = SECRET) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${createHmac('sha256', secret).update(encoded).digest('base64url')}`;
};
function uploadRequest(url, { bytes = '%PDF-1.7\n', name = 'untrusted-name.png', type = 'application/pdf', form, headers = {}, signal } = {}) {
  if (!form) { form = new FormData(); form.append('file', new Blob([bytes], { type }), name); }
  return new Request(url, { method: 'POST', body: form, headers, signal });
}

before(async () => {
  app = initializeApp({ projectId: 'demo-workspace' }, 'mcp-c3-fixtures');
  db = getFirestore(app);
  const batch = db.batch();
  for (const [collection, value] of [...areas.map(value => ['folders', value]), ...groups]) {
    const ref = db.collection(collection).doc(value.id);
    fixtures.push(ref); batch.set(ref, value);
  }
  await batch.commit();
  context = { db, owner: { uid: OWNER_UID, name: 'Connector owner' }, origin: 'https://preview.example.test', uploadSecret: SECRET, uploadFetch: fakeFetch };
  handler = createHandler({ env, getContext: async () => context, uploadFetch: fakeFetch });
  upload = createUploadHandler({ env, getContext: async () => context, uploadFetch: fakeFetch });
});
beforeEach(() => { uploads.length = 0; });
after(async () => {
  if (db) {
    const batch = db.batch();
    for (const ref of [...fixtures, ...(await savedIds()).map(id => db.collection('docs').doc(id))]) batch.delete(ref);
    await batch.commit();
  }
  if (app) await deleteApp(app);
});

test('all six text formats preserve UTF-8 bytes and route SVG to image, the rest to raw', async () => {
  const text = '# Report — 日本語\n<script>file contents stay intact</script>';
  for (const ext of ['md', 'html', 'csv', 'txt', 'json', 'svg']) {
    const data = await call(file({ name: `Report.${ext}`, text, note: '  Owner notes  ', groupId: 'c3-file' }));
    assert.equal(data.result.isError, undefined);
    const result = data.result.structuredContent;
    assert.equal(result.path, 'Clients › Acme › Files');
    assert.equal(result.url, 'http://localhost/#/areas/c3-area');
    const sent = uploads.at(-1), type = ext === 'svg' ? 'image' : 'raw';
    assert.equal(sent.url, `https://api.cloudinary.com/v1_1/dgznvawnm/${type}/upload`);
    assert.equal(sent.body.get('file').name, `Report.${ext}`);
    assert.equal(await sent.body.get('file').text(), text);
    const saved = await record(result);
    assert.deepEqual(saved, {
      id: result.id, folderId: 'c3-area', docFolderId: 'c3-file', name: `Report.${ext}`, note: 'Owner notes',
      url: 'https://storage.example.test/report', cloudType: type, type, format: ext,
      uploaded: true, starred: false, added: saved.added, privateTo: null, createdBy: context.owner, source: 'claude-chat',
    });
    assert.ok(Number.isFinite(saved.added));
    assert.deepEqual(Object.keys(result).sort(), ['id', 'path', 'url']);
  }
});

test('base64 PDF, PNG and video use raw/image/video, preserve bytes, and save private/both groupings', async () => {
  const bytes = Buffer.from([0, 1, 254, 255, 10]);
  for (const [name, type] of [['Report.PDF', 'raw'], ['Picture.png', 'image'], ['Clip.mp4', 'video']]) {
    const result = await saveFile(context, file({ name, base64: bytes.toString('base64'), groupId: 'c3-both' }), 123456);
    assert.equal(result.path, 'Clients › Acme › Workshop');
    assert.equal(uploads.at(-1).url, `https://api.cloudinary.com/v1_1/dgznvawnm/${type}/upload`);
    assert.deepEqual(Buffer.from(await uploads.at(-1).body.get('file').arrayBuffer()), bytes);
    assert.equal((await record(result)).added, 123456);
    assert.equal((await record(result)).docFolderId, 'c3-both');
  }
  const result = await saveFile(context, file({ areaId: 'c3-private', base64: bytes.toString('base64') }));
  assert.equal((await record(result)).privateTo, OWNER_UID);
});

test('omitting contents writes nothing and returns the specified HMAC address, expiry and curl line; upload saves its bound metadata', async () => {
  const before = await savedIds(), start = Date.now();
  const args = file({ groupId: 'c3-file', name: 'Report.pdf', note: 'Board report' });
  const result = await saveFile(context, args, start);
  const exp = start + UPLOAD_LIFETIME;
  assert.ok(result.uploadUrl.startsWith(`${context.origin}/api/upload/`));
  const [payload, signature] = result.uploadUrl.split('/').pop().split('.');
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), { ...args, exp });
  assert.equal(signature, createHmac('sha256', SECRET).update(payload).digest('base64url'));
  assert.equal(result.expiresAt, new Date(exp).toISOString());
  assert.equal(result.curl, `curl -sS -F file=@<path> '${result.uploadUrl}'`);
  assert.deepEqual(await savedIds(), before);
  assert.equal(uploads.length, 0);
  assert.equal(typeof endpoint.fetch, 'function');
  const response = await upload(uploadRequest(result.uploadUrl));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const saved = await response.json();
  assert.equal(saved.path, 'Clients › Acme › Files');
  assert.equal(saved.url, `${context.origin}/#/areas/c3-area`);
  assert.equal(uploads[0].body.get('file').name, 'Report.pdf');
  assert.equal((await record(saved)).name, 'Report.pdf');
  assert.equal((await record(saved)).note, 'Board report');
  assert.equal((await record(saved)).docFolderId, 'c3-file');
  assert.equal((await record(saved)).source, 'claude-chat');
  assert.equal((await record(saved)).uploaded, true);
});

test('MCP save_file without contents returns an upload address on the request origin', async () => {
  const result = (await call(file())).result.structuredContent;
  assert.match(result.uploadUrl, /^http:\/\/localhost\/api\/upload\//);
  assert.ok(Date.parse(result.expiresAt) > Date.now());
  assert.equal((await upload(uploadRequest(result.uploadUrl))).status, 200);
});

test('expired, edited, wrongly signed, malformed and invalid signed payloads give 403 before settings, reads or uploads', async () => {
  const before = await savedIds();
  const payload = { ...file(), note: '', exp: Date.now() + UPLOAD_LIFETIME };
  const token = sign(payload), signature = token.split('.')[1];
  const invalid = [
    '', 'wrong', token + 'x', token + '.extra', '%ZZ',
    sign(payload, 'wrong-key'), sign({ ...payload, exp: Date.now() - 1 }),
    ...['areaId', 'groupId', 'name', 'note', 'exp'].map(key => `${Buffer.from(JSON.stringify({ ...payload, [key]: 'edited' })).toString('base64url')}.${signature}`),
    ...[null, [], {}, { ...payload, exp: 'later' }, { ...payload, name: '' }, { ...payload, areaId: 'x/y' },
      { ...payload, base64: 'unexpected' }].map(value => sign(value)),
  ];
  let reads = 0;
  const forbidden = createUploadHandler({ env: { MCP_SECRET: SECRET }, getContext: () => { reads++; throw new Error('must not read'); }, uploadFetch: fakeFetch });
  for (const value of invalid) {
    const response = await forbidden(uploadRequest(`${context.origin}/api/upload/${value}`));
    assert.equal(response.status, 403);
    const body = await response.text();
    assert.match(body, /invalid or expired/);
    assert.ok(!body.includes(SECRET));
  }
  for (const value of [undefined, '', ' ']) {
    assert.equal((await createUploadHandler({ env: { MCP_SECRET: value } })(uploadRequest(`${context.origin}/api/upload/${token}`))).status, 403);
  }
  assert.equal(reads, 0);
  assert.equal(uploads.length, 0);
  assert.deepEqual(await savedIds(), before);
});

test('upload accepts POST only, one multipart file, and rejects incomplete or incorrectly named fields', async () => {
  const before = await savedIds(), { uploadUrl } = await saveFile(context, file());
  for (const method of ['GET', 'PUT', 'HEAD', 'DELETE', 'OPTIONS']) {
    const response = await upload(new Request(uploadUrl, { method }));
    assert.equal(response.status, 405); assert.equal(response.headers.get('Allow'), 'POST');
  }
  assert.equal((await upload(new Request(uploadUrl, { method: 'POST', body: 'data' }))).status, 415);
  const forms = [new FormData(), new FormData(), new FormData(), new FormData(), new FormData()];
  forms[1].append('file', 'text is not a file');
  forms[2].append('other', new Blob(['file']), 'a.pdf');
  forms[3].append('file', new Blob(['first']), 'a.pdf'); forms[3].append('file', new Blob(['second']), 'b.pdf');
  forms[4].append('file', new Blob(['first']), 'a.pdf'); forms[4].append('note', 'unbound note');
  for (const form of forms) assert.equal((await upload(uploadRequest(uploadUrl, { form }))).status, 400);
  const malformed = new Request(uploadUrl, { method: 'POST', body: 'not-multipart', headers: { 'Content-Type': 'multipart/form-data; boundary=missing' } });
  assert.equal((await upload(malformed)).status, 400);
  assert.equal(uploads.length, 0); assert.deepEqual(await savedIds(), before);
});

test('1 MB inline limit counts decoded/UTF-8 bytes; malformed data and missing or blank metadata never upload or save', async () => {
  const before = await savedIds();
  for (const args of [
    {}, file({ name: '' }), file({ name: '   ' }), file({ name: 'no-extension' }), file({ name: '.pdf' }),
    file({ name: 'path/file.pdf' }), file({ name: 'a\nb.pdf' }), file({ areaId: 'bad/id' }),
    file({ text: '', base64: '' }), file({ name: 'Report.pdf', text: 'PDF is not a text format' }),
    ...['%', 'A', 'A===', 'YWJj=', 'AB==', 'data:application/pdf;base64,YQ=='].map(base64 => file({ base64 })),
  ]) {
    const data = await call(args);
    assert.ok(data.error || data.result.isError, JSON.stringify(args));
  }
  for (const args of [
    file({ name: 'Report.txt', text: 'é'.repeat(MAX_INLINE_BYTES / 2 + 1) }),
    file({ base64: Buffer.alloc(MAX_INLINE_BYTES + 1).toString('base64') }),
  ]) {
    const data = await call(args);
    assert.match(data.result.content[0].text, /at most 1 MB/);
  }
  assert.equal(uploads.length, 0); assert.deepEqual(await savedIds(), before);
  for (const args of [
    file({ name: 'Boundary.txt', text: 'é'.repeat(MAX_INLINE_BYTES / 2) }),
    file({ base64: Buffer.alloc(MAX_INLINE_BYTES).toString('base64') }),
  ]) {
    await saveFile(context, args);
    assert.equal(uploads.at(-1).body.get('file').size, MAX_INLINE_BYTES);
  }
});

test('4 MB upload boundary succeeds; oversized file, forged length and oversized streamed body give 413 without a save', async () => {
  const { uploadUrl } = await saveFile(context, file());
  const accepted = await upload(uploadRequest(uploadUrl, { bytes: Buffer.alloc(MAX_UPLOAD_BYTES) }));
  assert.equal(accepted.status, 200); assert.equal(uploads[0].body.get('file').size, MAX_UPLOAD_BYTES);
  const before = await savedIds(), calls = uploads.length;
  for (const headers of [{}, { 'Content-Length': '1' }, { 'Content-Length': String(MAX_UPLOAD_BYTES + 100000) }]) {
    const response = await upload(uploadRequest(uploadUrl, { bytes: Buffer.alloc(MAX_UPLOAD_BYTES + 1), headers }));
    assert.equal(response.status, 413); assert.match((await response.json()).error, /save it as a link instead/);
  }
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { cancelled = true; throw new Error('sensitive-cancel-error'); },
  });
  const response = await upload(new Request(uploadUrl, { method: 'POST', body: stream, duplex: 'half', headers: { 'Content-Type': 'multipart/form-data; boundary=test' } }));
  assert.equal(response.status, 413); assert.equal(cancelled, true);
  assert.equal(uploads.length, calls); assert.deepEqual(await savedIds(), before);
});

test('hidden areas, parents and invalid groupings cannot issue an address or upload inline data', async () => {
  const before = await savedIds();
  for (const target of [
    ...['c3-other', 'c3-hidden', 'c3-deleted', 'c3-missing'].map(areaId => ({ areaId })),
    ...['c3-mom', 'c3-other-group', 'c3-private-group', 'c3-missing'].map(groupId => ({ groupId })),
  ]) {
    for (const contents of [{}, { base64: 'YQ==' }]) await assert.rejects(saveFile(context, file({ ...target, ...contents })), /visible/);
  }
  assert.equal(uploads.length, 0); assert.deepEqual(await savedIds(), before);
});

test('deleted/private areas or ancestors, and changed groupings, invalidate an existing upload address before Cloudinary', async () => {
  const before = await savedIds();
  const changes = [
    ['folders', 'c3-changing', { deleted: true }], ['folders', 'c3-changing', { privateTo: 'c3-other-admin' }],
    ['folders', 'c3-changing', null], ['folders', 'c3-root', { privateTo: 'c3-other-admin' }],
    ['folders', 'c3-root', { deleted: true }],
    ['momfolders', 'c3-both', { holds: 'mom' }], ['momfolders', 'c3-both', { folderId: 'c3-other' }],
    ['momfolders', 'c3-both', { deleted: true }],
  ];
  for (const [collection, id, fields] of changes) {
    const args = file(id === 'c3-both' ? { groupId: id } : { areaId: 'c3-changing' });
    const { uploadUrl } = await saveFile(context, args);
    const ref = db.collection(collection).doc(id), original = (await ref.get()).data();
    try {
      if (fields) await ref.update(fields); else await ref.delete();
      assert.equal((await upload(uploadRequest(uploadUrl))).status, 403);
    } finally { await ref.set(original); }
  }
  assert.equal(uploads.length, 0); assert.deepEqual(await savedIds(), before);
});

test('privacy change while Cloudinary is answering is checked again before saving the file record', async () => {
  const before = await savedIds(), ref = db.collection('folders').doc('c3-changing');
  const lateChange = createUploadHandler({ env, getContext: async () => context, uploadFetch: async (...args) => {
    const response = await fakeFetch(...args);
    await ref.update({ privateTo: 'c3-other-admin' });
    return response;
  } });
  const { uploadUrl } = await saveFile(context, file({ areaId: 'c3-changing' }));
  try { assert.equal((await lateChange(uploadRequest(uploadUrl))).status, 403); }
  finally { await ref.set(areas.find(area => area.id === 'c3-changing')); }
  assert.equal(uploads.length, 1); assert.deepEqual(await savedIds(), before);
});

test('empty files, unpadded/wrapped base64, long names/notes, and case-variant duplicates stay explicit separate saves', async () => {
  for (const args of [file({ name: 'Empty.txt', text: '' }), file({ base64: '' })]) {
    await saveFile(context, args); assert.equal(uploads.at(-1).body.get('file').size, 0);
  }
  await saveFile(context, file({ base64: 'YQ' })); assert.equal(await uploads.at(-1).body.get('file').text(), 'a');
  await saveFile(context, file({ base64: 'Y Q\n=\r=\t' })); assert.equal(await uploads.at(-1).body.get('file').text(), 'a');
  const name = 'Report 日本語 '.repeat(200) + '.pdf', note = 'Notes '.repeat(1000);
  const first = await saveFile(context, file({ name, note, base64: 'YQ==' }));
  const second = await saveFile(context, file({ name: name.toUpperCase(), base64: 'YQ==' }));
  assert.notEqual(first.id, second.id);
  assert.equal((await record(first)).name, name); assert.equal((await record(first)).note, note.trim());
  assert.equal((await record(second)).name, name.toUpperCase());
});

test('Cloudinary size/type errors, bad replies, network loss and timeouts are plain errors with no file record or automatic retry', async () => {
  const before = await savedIds(), sensitive = 'private-key-token-and-address';
  const failures = [
    [() => Response.json({ error: { message: 'File size too large ' + sensitive } }, { status: 400 }), /too large.*save it as a link instead/],
    [() => Response.json({}, { status: 413 }), /save it as a link instead/],
    [() => new Response(sensitive, { status: 413 }), /too large.*save it as a link instead/],
    [() => Response.json({ error: { message: 'Invalid file format ' + sensitive } }, { status: 400 }), /type is not accepted/],
    [() => Response.json({ error: { message: sensitive } }, { status: 401 }), /storage is unavailable/],
    [() => new Response(sensitive, { status: 503 }), /storage is unavailable/],
    [() => { throw new Error(sensitive); }, /Could not upload/],
    [() => { throw new DOMException(sensitive, 'TimeoutError'); }, /Could not upload/],
    [() => Response.json({ secure_url: 'javascript:' + sensitive, resource_type: 'raw' }), /usable file address/],
    [() => Response.json({ secure_url: 'https://example.test', resource_type: 'image' }), /usable file address/],
    [() => new Response(sensitive), /usable file address/],
  ];
  for (const [reply, message] of failures) {
    let calls = 0;
    const uploadFetch = () => { calls++; return reply(); };
    const handle = createHandler({ env, getContext: async () => context, uploadFetch });
    const failed = await call(file({ base64: 'YQ==' }), handle);
    assert.equal(failed.result.isError, true); assert.match(failed.result.content[0].text, message);
    assert.ok(!JSON.stringify(failed).includes(sensitive)); assert.equal(calls, 1);
    const { uploadUrl } = await saveFile(context, file());
    const response = await createUploadHandler({ env, getContext: async () => context, uploadFetch })(uploadRequest(uploadUrl));
    assert.ok([413, 502].includes(response.status));
    const body = await response.text(); assert.match(body, message); assert.ok(!body.includes(sensitive)); assert.equal(calls, 2);
  }
  assert.deepEqual(await savedIds(), before);
});

test('interrupted request body does not reach Cloudinary or write a file', async () => {
  const before = await savedIds(), { uploadUrl } = await saveFile(context, file());
  const stream = new ReadableStream({ start(controller) { controller.error(new Error('sensitive-stream-details')); } });
  const response = await upload(new Request(uploadUrl, { method: 'POST', body: stream, duplex: 'half', headers: { 'Content-Type': 'multipart/form-data; boundary=test' } }));
  assert.equal(response.status, 400); assert.match((await response.json()).error, /upload was interrupted/);
  assert.equal(uploads.length, 0); assert.deepEqual(await savedIds(), before);
});

test('failure while committing after Cloudinary leaves no record; lost acknowledgement warns and explicit retry creates a second item', async t => {
  const before = await savedIds(), original = db.runTransaction.bind(db);
  const { uploadUrl } = await saveFile(context, file());
  let transactions = 0;
  let patch = t.mock.method(db, 'runTransaction', callback => original(async transaction => {
    const result = await callback(transaction);
    if (++transactions === 2) throw new Error('sensitive-staged-write');
    return result;
  }));
  let response = await upload(uploadRequest(uploadUrl));
  patch.mock.restore();
  assert.equal(response.status, 500); assert.match((await response.json()).error, /Check Workbench before retrying; it may have saved/);
  assert.deepEqual(await savedIds(), before);
  transactions = 0;
  patch = t.mock.method(db, 'runTransaction', async callback => {
    const result = await original(callback);
    if (++transactions === 2) throw new Error('sensitive-lost-ack');
    return result;
  });
  response = await upload(uploadRequest(uploadUrl));
  patch.mock.restore();
  assert.equal(response.status, 500); assert.match((await response.json()).error, /Check Workbench before retrying; it may have saved/);
  assert.equal((await savedIds()).length, before.length + 1);
  response = await upload(uploadRequest(uploadUrl));
  assert.equal(response.status, 200); assert.equal((await savedIds()).length, before.length + 2);
});

test('caller closing just after commit leaves exactly one complete file record', async t => {
  const { uploadUrl } = await saveFile(context, file()), before = await savedIds(), abort = new AbortController();
  const original = db.runTransaction.bind(db);
  let transactions = 0;
  const patch = t.mock.method(db, 'runTransaction', async callback => {
    const result = await original(callback);
    if (++transactions === 2) abort.abort();
    return result;
  });
  try { await upload(uploadRequest(uploadUrl, { signal: abort.signal })); }
  catch { /* A closed caller may receive no response. */ }
  finally { patch.mock.restore(); }
  assert.equal(abort.signal.aborted, true);
  const added = (await savedIds()).filter(id => !before.includes(id));
  assert.equal(added.length, 1);
  const saved = await record({ id: added[0] });
  assert.equal(saved.uploaded, true); assert.equal(saved.source, 'claude-chat');
  assert.equal(saved.privateTo, null); assert.deepEqual(saved.createdBy, context.owner);
});
