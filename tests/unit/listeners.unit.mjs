// Unit tests for loading by visibility (plan 2.1, spec §E). Run: npm run test:unit
// Loads the data scripts into a sandbox with a fake Firestore whose listeners the tests feed fake snapshots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { unfilteredReads } from '../../scripts/admin/rules-preflight.mjs';

const COLS = ['folders', 'moms', 'docs', 'docfolders', 'momfolders'];
const tick = () => new Promise(r => setTimeout(r, 0));

function load(user) {
  const listeners = [];   // { col, value, next, error, off }
  const db = {
    collection: col => ({
      where: (field, op, value) => {
        assert.equal(field, 'privateTo'); assert.equal(op, '==');
        return {
          onSnapshot: (opt, next, error) => {
            const l = { col, value, next, error, off: false };
            listeners.push(l);
            return () => { l.off = true; };
          },
        };
      },
      doc: () => ({ set: () => Promise.resolve(), delete: () => Promise.resolve() }),
    }),
  };
  const events = [];
  const sandbox = {
    console, Promise, Date, Set, Map, Array, Uint32Array, Object, db, setTimeout, crypto: globalThis.crypto,
    navigator: { onLine: true }, window: { addEventListener() {} },
    auth: { currentUser: user },
  };
  vm.createContext(sandbox);
  for (const f of ['js/data/store.js', 'js/data/actions.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
  // Values made in the sandbox come back through JSON, so deepEqual compares them with this realm's arrays.
  const run = code => { const v = vm.runInContext(code, sandbox); return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; };
  sandbox.__push = (w, i) => events.push([w, i && JSON.parse(JSON.stringify(i))]);
  run('Store.onChange(__push)');
  const live = (col, value) => listeners.filter(l => !l.off && l.col === col && (value === undefined || l.value === value));
  // Feeds one fake snapshot to the live listener for col/value: the full list of docs plus what changed.
  const feed = (col, value, items, { changes, fromCache = false } = {}) => {
    const ls = live(col, value);
    assert.equal(ls.length, 1, `one live ${col} listener for privateTo == ${value}`);
    const doc = it => ({ id: it.id, data: () => it, metadata: { hasPendingWrites: false } });
    const docs = items.map(doc);
    const ch = (changes || items.map(it => ['added', it])).map(([type, it]) => ({ type, doc: doc(it) }));
    ls[0].next({ metadata: { fromCache }, docs, docChanges: () => ch });
  };
  // A first server snapshot for every collection and query, empty unless given.
  const feedAll = (values, lists = {}) => { for (const c of COLS) for (const v of values) feed(c, v, (lists[c] || {})[v] || []); };
  return { run, listeners, live, feed, feedAll, events, sandbox };
}

const admin = { uid: 'admin1', isAnonymous: false };

test('a visitor listens with privateTo == null only, on all five collections', async () => {
  const s = load({ uid: 'anon', isAnonymous: true });
  s.run('startListeners()');
  assert.deepEqual(s.listeners.map(l => [l.col, l.value]), COLS.map(c => [c, null]));
  s.feedAll([null], { folders: { null: [{ id: 'a', name: 'A', privateTo: null }] } });
  await tick();
  assert.equal(s.run('F.length'), 1);
  assert.equal(s.run('LOADED.f&&LOADED.m&&LOADED.d&&LOADED.df&&LOADED.mf'), true);
  assert.equal(s.events.filter(e => e[0] === 'loaded').length, 1);
});

test('a signed-in person listens with null and their uid; nothing loads until both have arrived', async () => {
  const s = load(admin);
  s.run('startListeners()');
  assert.deepEqual(s.listeners.map(l => [l.col, l.value]), COLS.flatMap(c => [[c, null], [c, 'admin1']]));
  s.feed('moms', null, [{ id: 'm1', privateTo: null }]);
  await tick();
  assert.equal(s.run('LOADED.m'), false, 'waits for the uid query');
  s.feed('moms', 'admin1', [{ id: 'm2', privateTo: 'admin1' }, { id: 'm0', privateTo: 'admin1', deleted: true }]);
  await tick();
  assert.equal(s.run('LOADED.m'), true);
  assert.deepEqual(s.run('M.map(m=>m.id)'), ['m1', 'm2']);
  assert.deepEqual(s.run('TM.map(m=>m.id)'), ['m0'], 'deleted items of both queries reach the Deleted list');
  assert.equal(s.events.some(e => e[0] === 'added'), false, 'the first load is not news');
});

test('an item that moves from one query to the other stays, updated, and is not reported as added', async () => {
  const s = load(admin);
  s.run('startListeners()');
  const m = { id: 'm1', title: 'Plan', privateTo: null };
  s.feedAll([null, 'admin1'], { moms: { null: [m] } });
  await tick();
  s.events.length = 0;
  const priv = { ...m, privateTo: 'admin1' };
  // Made private: the null query drops it and the uid query gets it, in two snapshots raised together.
  s.feed('moms', null, [], { changes: [['removed', m]] });
  s.feed('moms', 'admin1', [priv], { changes: [['added', priv]] });
  await tick();
  assert.deepEqual(s.run('M.map(m=>[m.id,m.privateTo])'), [['m1', 'admin1']]);
  assert.equal(s.events.filter(e => e[0] === 'moms').length, 1, 'one redraw');
  assert.equal(s.events.some(e => e[0] === 'added'), false);
  // And back, in the other order.
  s.feed('moms', null, [m], { changes: [['added', m]] });
  s.feed('moms', 'admin1', [], { changes: [['removed', priv]] });
  await tick();
  assert.deepEqual(s.run('M.map(m=>[m.id,m.privateTo])'), [['m1', null]]);
  assert.equal(s.events.some(e => e[0] === 'added'), false);
});

test('an item is dropped only when neither query has it', async () => {
  const s = load(admin);
  s.run('startListeners()');
  const a = { id: 'a', privateTo: null }, b = { id: 'b', privateTo: 'admin1' };
  s.feedAll([null, 'admin1'], { docs: { null: [a], admin1: [b] } });
  await tick();
  s.feed('docs', 'admin1', [], { changes: [['removed', b]] });
  await tick();
  assert.deepEqual(s.run('D.map(d=>d.id)'), ['a']);
});

test('a new MoM or file from elsewhere after the first load is reported once', async () => {
  const s = load(admin);
  s.run('startListeners()');
  s.feedAll([null, 'admin1']);
  await tick();
  const n = { id: 'n1', title: 'New', privateTo: 'admin1' };
  s.feed('moms', 'admin1', [n], { changes: [['added', n]] });
  await tick();
  const added = s.events.filter(e => e[0] === 'added');
  assert.equal(added.length, 1);
  assert.equal(added[0][1].col, 'moms');
  assert.deepEqual(added[0][1].items.map(i => i.id), ['n1']);
});

test('a metadata-only snapshot changes the sync state but not the data', async () => {
  const s = load(admin);
  s.run('startListeners()');
  const f = { id: 'a', privateTo: null };
  s.feedAll([null, 'admin1'], { folders: { null: [f] } });
  await tick();
  assert.equal(s.run('Store.sync'), 'ok');
  s.events.length = 0;
  s.feed('folders', 'admin1', [], { changes: [], fromCache: true });
  await tick();
  assert.equal(s.run('Store.sync'), 'catchup', 'one query not confirmed by the server is enough');
  assert.equal(s.events.some(e => e[0] === 'folders'), false);
  s.feed('folders', 'admin1', [], { changes: [] });
  await tick();
  assert.equal(s.run('Store.sync'), 'ok');
});

test('the week-old purge waits for the server copy of both queries', async () => {
  const s = load(admin);
  s.run('startListeners()');
  for (const c of COLS) { s.feed(c, null, []); s.feed(c, 'admin1', [], { fromCache: true }); }
  await tick();
  assert.equal(s.run('_purged'), false);
  for (const c of COLS) s.feed(c, 'admin1', [], { changes: [] });
  await tick();
  assert.equal(s.run('_purged'), true);
});

test('a visitor who signs in gets their own queries, with no news for what was already there', async () => {
  const user = { uid: 'anon', isAnonymous: true };
  const s = load(user);
  s.run('startListeners()');
  const a = { id: 'a', privateTo: null };
  s.feedAll([null], { moms: { null: [a] } });
  await tick();
  s.sandbox.auth.currentUser = admin;
  s.run('startListeners()');
  assert.equal(s.listeners.filter(l => !l.off && l.value === null).length, 5, 'the visitor\'s listeners were stopped');
  assert.equal(s.live('moms', 'admin1').length, 1);
  s.run('startListeners()');
  assert.equal(s.listeners.length, 15, 'the same person again starts nothing new');
  s.events.length = 0;
  const p = { id: 'p', privateTo: 'admin1' };
  s.feedAll([null, 'admin1'], { moms: { null: [a], admin1: [p] } });
  await tick();
  assert.deepEqual(s.run('M.map(m=>m.id)'), ['a', 'p']);
  const added = s.events.filter(e => e[0] === 'added');
  assert.deepEqual(added.flatMap(e => e[1].items.map(i => i.id)), ['p'], 'only the newly visible item is new');
});

test('a refused query emits error', () => {
  const s = load(admin);
  s.run('startListeners()');
  s.live('folders', 'admin1')[0].error(new Error('permission-denied'));
  assert.equal(s.events.filter(e => e[0] === 'error').length, 1);
});

test('the app has no list read without a privateTo filter (the rules-deploy preflight)', () => {
  const files = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') && files.push(path.join(d, e.name)));
  walk('js');
  assert.deepEqual(files.flatMap(f => unfilteredReads(fs.readFileSync(f, 'utf8')).map(c => `${f}: ${c}`)), []);
});
