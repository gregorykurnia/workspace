import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, parseEmails, missingPrivateTo, readKey, UserError, DEFAULT_KEY_PATH } from './lib.mjs';
import { addEmails, removeEmails, listEmails } from './allowlist.mjs';
import { backfill } from './backfill-private.mjs';
import { removeTestData } from './remove-test-data.mjs';
import { unfilteredReads } from './rules-preflight.mjs';

// Minimal in-memory Firestore: collection(name).doc(id) / .get(), db.batch().
function fakeDb(data = {}) {
  const cols = {};
  for (const [n, docs] of Object.entries(data)) cols[n] = new Map(Object.entries(docs));
  const col = n => (cols[n] ??= new Map());
  const ref = (n, id) => ({
    n, id,
    get: async () => ({ exists: col(n).has(id), id, data: () => col(n).get(id) }),
    set: async v => { col(n).set(id, v); },
    delete: async () => { col(n).delete(id); },
  });
  return {
    cols,
    collection: n => ({
      doc: id => ref(n, id),
      get: async () => ({ docs: [...col(n)].map(([id, v]) => ({ id, data: () => v })) }),
    }),
    batch() {
      const ops = [];
      return {
        update: (r, v) => ops.push(() => col(r.n).set(r.id, { ...col(r.n).get(r.id), ...v })),
        delete: r => ops.push(() => col(r.n).delete(r.id)),
        commit: async () => ops.forEach(f => f()),
      };
    },
  };
}

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  Greg@Example.COM '), 'greg@example.com');
});

test('parseEmails dedupes, normalizes and rejects bad input', () => {
  assert.deepEqual(parseEmails(['A@x.io', ' a@x.io', 'b@x.io']), ['a@x.io', 'b@x.io']);
  assert.throws(() => parseEmails(['nope']), UserError);
  assert.throws(() => parseEmails(['a@b']), UserError);
});

test('missingPrivateTo treats null as present', () => {
  const docs = [{ id: 'a', data: { privateTo: null } }, { id: 'b', data: {} }, { id: 'c', data: { privateTo: 'u1' } }];
  assert.deepEqual(missingPrivateTo(docs), ['b']);
});

test('readKey: missing file gives a one-line UserError', () => {
  const read = () => { const e = new Error('x'); e.code = 'ENOENT'; throw e; };
  assert.throws(() => readKey({}, read), e => e instanceof UserError && !e.message.includes('\n'));
  assert.throws(() => readKey({ WORKBENCH_ADMIN_KEY: '/nope' }, read), /\/nope/);
});

test('readKey: env path wins over the default; bad JSON is a UserError', () => {
  let seen;
  readKey({ WORKBENCH_ADMIN_KEY: '/k.json' }, p => (seen = p, '{}'));
  assert.equal(seen, '/k.json');
  readKey({}, p => (seen = p, '{}'));
  assert.equal(seen, DEFAULT_KEY_PATH);
  assert.throws(() => readKey({}, () => 'not json'), UserError);
});

test('allowlist add / list / remove', async () => {
  const db = fakeDb();
  const when = new Date('2026-10-26');
  assert.deepEqual(await addEmails(db, ['b@x.io', 'a@x.io'], () => when), { added: ['b@x.io', 'a@x.io'], existing: [] });
  assert.deepEqual(db.cols.allowed_emails.get('a@x.io'), { email: 'a@x.io', addedAt: when });
  assert.deepEqual(await listEmails(db), ['a@x.io', 'b@x.io']);
  // re-adding keeps the first addedAt
  const r = await addEmails(db, ['a@x.io'], () => new Date('2030-01-01'));
  assert.deepEqual(r, { added: [], existing: ['a@x.io'] });
  assert.equal(db.cols.allowed_emails.get('a@x.io').addedAt, when);
  assert.deepEqual(await removeEmails(db, ['a@x.io', 'z@x.io']), { removed: ['a@x.io'], missing: ['z@x.io'] });
  assert.deepEqual(await listEmails(db), ['b@x.io']);
});

test('backfill: dry run counts and writes nothing; apply sets only missing privateTo', async () => {
  const mk = () => fakeDb({
    folders: { f1: { name: 'A' }, f2: { name: 'B', privateTo: 'u1' } },
    moms: { m1: { title: 'x', privateTo: null }, m2: { title: 'y' } },
    docs: {},
  });
  const db = mk();
  const dry = await backfill(db);
  assert.deepEqual(dry.folders, { total: 2, missing: 1 });
  assert.deepEqual(dry.moms, { total: 2, missing: 1 });
  assert.deepEqual(dry.docs, { total: 0, missing: 0 });
  assert.deepEqual(Object.keys(dry), ['folders', 'moms', 'docs', 'docfolders', 'momfolders']);
  assert.ok(!('privateTo' in db.cols.folders.get('f1')));

  await backfill(db, { apply: true });
  assert.deepEqual(db.cols.folders.get('f1'), { name: 'A', privateTo: null });
  assert.equal(db.cols.folders.get('f2').privateTo, 'u1');
  assert.deepEqual(db.cols.moms.get('m2'), { title: 'y', privateTo: null });
  assert.equal((await backfill(db)).folders.missing, 0);
});

test('rules preflight: finds unfiltered list reads of the item collections only', () => {
  const src = `db.collection('folders').onSnapshot(opt,f);
    db.collection("moms") . get();
    db.collection('docs').where('privateTo','==',null).onSnapshot(f);
    db.collection('moms').doc(id).onSnapshot(f);
    db.collection('users').onSnapshot(f);`;
  assert.deepEqual(unfilteredReads(src), ['folders', 'moms']);
});

test('remove-test-data: finds tagged areas, their sub-areas and contents, and tagged items; dry run deletes nothing', async () => {
  const db = fakeDb({
    folders: { t: { name: '[TEST-1] Area' }, sub: { name: 'Plain sub', parent: 't' }, deep: { name: 'Deeper', parent: 'sub' }, real: { name: 'Clients' }, near: { name: 'TEST plan' } },
    moms: { m1: { title: 'Kickoff', folderId: 'deep' }, m2: { title: 'Real', folderId: 'real' }, m3: { title: '[TEST-2] Stray', folderId: 'real' } },
    docs: { d1: { name: 'x.pdf', folderId: 't' }, d2: { name: 'y.pdf', folderId: 'real' } },
    docfolders: { g1: { name: 'Group', folderId: 'sub' } },
    momfolders: {},
  });
  const dry = await removeTestData(db);
  const ids = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.map(x => x.id).sort()]));
  assert.deepEqual(ids(dry), { folders: ['deep', 'sub', 't'], moms: ['m1', 'm3'], docs: ['d1'], docfolders: ['g1'], momfolders: [] });
  assert.equal(db.cols.folders.size, 5);

  await removeTestData(db, { apply: true });
  assert.deepEqual([...db.cols.folders.keys()].sort(), ['near', 'real']);
  assert.deepEqual([...db.cols.moms.keys()], ['m2']);
  assert.deepEqual([...db.cols.docs.keys()], ['d2']);
  assert.equal(db.cols.docfolders.size, 0);
});
