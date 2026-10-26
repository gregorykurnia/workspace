// Unit tests for privateTo on every create (plan 1.2, spec §B). Run: npm run test:unit
// Loads the classic data scripts into a sandbox with a fake Firestore; no browser, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function load(areas = [], user = null) {
  const written = [];   // [collection, id, data]
  const db = { collection: col => ({ doc: id => ({ set: data => { written.push([col, id, data]); return Promise.resolve(); } }) }) };
  const sandbox = {
    console, Promise, Date, Set, Uint32Array, Object, db, crypto: globalThis.crypto,
    navigator: { onLine: true }, window: { addEventListener() {} },
    auth: { currentUser: user },
  };
  vm.createContext(sandbox);
  for (const f of ['js/data/store.js', 'js/data/actions.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
  vm.runInContext('F.push(...__areas)', Object.assign(sandbox, { __areas: areas }));
  return { run: code => vm.runInContext(code, sandbox), written };
}

const AREAS = [
  { id: 'top', name: 'Top' },
  { id: 'priv', name: 'Private', privateTo: 'admin1' },
  { id: 'sub', name: 'Sub', parent: 'priv', privateTo: 'admin1' },
  { id: 'open', name: 'Open', privateTo: null },
];

test('privOf: the area\'s value, or null', () => {
  const { run } = load(AREAS);
  assert.equal(run("privOf('priv')"), 'admin1');
  assert.equal(run("privOf('sub')"), 'admin1');
  assert.equal(run("privOf('open')"), null);
  assert.equal(run("privOf('top')"), null, 'field missing (not backfilled yet)');
  assert.equal(run("privOf('nope')"), null, 'unknown area');
  assert.equal(run('privOf(null)'), null);
  assert.equal(run('privOf(undefined)'), null);
});

test('new top-level area gets privateTo: null', () => {
  const { run, written } = load(AREAS);
  run("sF({id:'n1',name:'New'})");
  assert.equal(written[0][0], 'folders');
  assert.equal(written[0][2].privateTo, null);
});

test('new sub-area copies its parent\'s privateTo', () => {
  const { run, written } = load(AREAS);
  run("sF({id:'n1',name:'In private',parent:'priv'})");
  run("sF({id:'n2',name:'In open',parent:'open'})");
  assert.equal(written[0][2].privateTo, 'admin1');
  assert.equal(written[1][2].privateTo, null);
});

test('new MoM copies its area\'s privateTo', () => {
  const { run, written } = load(AREAS, { uid: 'admin1', isAnonymous: false, displayName: 'A' });
  const r = run("createMom({folderId:'priv',title:'x'})");
  run("createMom({folderId:'top',title:'y'})");
  assert.ok(r.id);
  assert.deepEqual(written.map(w => [w[0], w[2].privateTo]), [['moms', 'admin1'], ['moms', null]]);
});

test('new file (link or upload) copies its area\'s privateTo', () => {
  const { run, written } = load(AREAS);
  run("sD({id:'d1',folderId:'sub',name:'f'})");
  run("sD({id:'d2',folderId:'top',name:'g'})");
  assert.deepEqual(written.map(w => [w[0], w[2].privateTo]), [['docs', 'admin1'], ['docs', null]]);
});

test('new groupings copy their area\'s privateTo', () => {
  const { run, written } = load(AREAS);
  run("sMF({id:'g1',folderId:'priv',name:'G',holds:'both'})");
  run("sDF({id:'g2',folderId:'priv',name:'H'})");
  run("sMF({id:'g3',folderId:'top',name:'I'})");
  assert.deepEqual(written.map(w => [w[0], w[2].privateTo]), [['momfolders', 'admin1'], ['docfolders', 'admin1'], ['momfolders', null]]);
});

test('a value the caller already set is kept', () => {
  const { run, written } = load(AREAS);
  run("sD({id:'d1',folderId:'priv',privateTo:null})");
  assert.equal(written[0][2].privateTo, null);
});
