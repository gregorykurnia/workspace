// Unit tests for the private-area menu rules (plan 2.3, spec §F–§G). Run: npm run test:unit
// privateAction (which ⋯ entry an area gets), isPrivate (Share and Access are off), moveExposes (the move-out
// warning). Loads the classic data scripts into a sandbox with a fake Firestore; no browser, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const DEL = { del: true };

// live: PRIVATE_LIVE on (the rules are deployed). emulator: the page runs on the emulator, which has the rules.
function load(data, { uid = 'admin1', role = 'admin', anon = false, live = true, emulator = false } = {}) {
  const byKey = new Map();
  for (const [col, list] of Object.entries(data)) for (const x of list) byKey.set(col + '/' + x.id, x);
  const db = {
    collection: col => ({ doc: id => ({ key: col + '/' + id }) }),
    batch() {
      const ups = [];
      return {
        update(ref, d) { ups.push([ref.key, d]); },
        commit() {
          for (const [k, d] of ups) for (const [f, val] of Object.entries(d)) { if (val === DEL) delete byKey.get(k)[f]; else byKey.get(k)[f] = val; }
          return Promise.resolve();
        },
      };
    },
  };
  const sandbox = {
    console, Promise, Date, Set, Map, Uint32Array, Object, db, crypto: globalThis.crypto,
    navigator: { onLine: true }, window: { addEventListener() {} },
    auth: { currentUser: uid ? { uid, isAnonymous: anon, displayName: 'A' } : null },
    firebase: { firestore: { FieldValue: { delete: () => DEL } } },
    CURR_USER_ROLE: role, FA: [],
  };
  if (emulator) sandbox.EMULATOR = true;   // firebase.js defines it in the page
  vm.createContext(sandbox);
  for (const f of ['js/data/store.js', 'js/data/actions.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
  vm.runInContext(`PRIVATE_LIVE=${live}`, sandbox);
  const lists = { folders: ['F', 'TF'], moms: ['M', 'TM'], docs: ['D', 'TD'], docfolders: ['DF', 'TDF'], momfolders: ['MF', 'TMF'] };
  sandbox.__data = data;
  for (const [col, [live, gone]] of Object.entries(lists)) {
    vm.runInContext(`${live}=(__data.${col}||[]).filter(x=>!x.deleted);${gone}=(__data.${col}||[]).filter(x=>x.deleted);`, sandbox);
  }
  // An array made inside the sandbox has the sandbox's prototype; copy it so deepEqual compares like with like.
  return { run: code => { const r = vm.runInContext(code, sandbox); return Array.isArray(r) ? Array.from(r) : r; }, data };
}

// A ─ A1 (public)
// B (private to admin1) ─ B1 ─ B1a, mB, fB, fBold (no privateTo yet: not backfilled)
// C ─ P (private to admin1 in its own right) ─ mP
// X (private to admin2)
const world = () => ({
  folders: [
    { id: 'A', name: 'A', privateTo: null },
    { id: 'A1', name: 'A1', parent: 'A', privateTo: null },
    { id: 'B', name: 'B', privateTo: 'admin1' },
    { id: 'B1', name: 'B1', parent: 'B', privateTo: 'admin1' },
    { id: 'B1a', name: 'B1a', parent: 'B1', privateTo: 'admin1' },
    { id: 'C', name: 'C' },   // no field at all: not backfilled
    { id: 'P', name: 'P', parent: 'C', privateTo: 'admin1' },
    { id: 'X', name: 'X', privateTo: 'admin2' },
  ],
  moms: [
    { id: 'mA', folderId: 'A1', privateTo: null },
    { id: 'mB', folderId: 'B1', privateTo: 'admin1' },
    { id: 'mP', folderId: 'P', privateTo: 'admin1' },
    { id: 'mC', folderId: 'C' },
  ],
  docs: [
    { id: 'fA', folderId: 'A', privateTo: null },
    { id: 'fB', folderId: 'B', privateTo: 'admin1' },
    { id: 'fBold', folderId: 'B1' },
  ],
});

test('privateAction: an admin gets "make" on a public area and "release" on their own private one', () => {
  const { run } = load(world());
  assert.equal(run("privateAction('A')"), 'make');
  assert.equal(run("privateAction('A1')"), 'make', 'a sub-area of a public area can be made private');
  assert.equal(run("privateAction('C')"), 'make', 'a missing privateTo counts as public');
  assert.equal(run("privateAction('B')"), 'release');
  assert.equal(run("privateAction('P')"), 'release', 'private in its own right inside a public area');
});

test('privateAction: nothing inside a private area, on someone else\'s, or for an unknown area', () => {
  const { run } = load(world());
  assert.equal(run("privateAction('B1')"), null);
  assert.equal(run("privateAction('B1a')"), null);
  assert.equal(run("privateAction('X')"), null, 'private to another admin');
  assert.equal(run("privateAction('nope')"), null);
  assert.equal(run('privateAction(null)'), null);
});

test('privateAction: not offered on the live site until PRIVATE_LIVE is on, always on the emulator', () => {
  assert.equal(load(world(), { live: false }).run("privateAction('A')"), null);
  assert.equal(load(world(), { live: false }).run("privateAction('B')"), null, 'nor "release"');
  assert.equal(load(world(), { live: false, emulator: true }).run("privateAction('A')"), 'make');
  assert.equal(load(world(), { live: true }).run("privateAction('A')"), 'make');
  assert.equal(fs.readFileSync('js/data/store.js', 'utf8').match(/^var PRIVATE_LIVE=(\w+);/m)[1], 'false', 'the file ships with it off until O5');
});

test('privateAction: nothing for members, visitors or signed-out people', () => {
  assert.equal(load(world(), { role: 'member' }).run("privateAction('A')"), null);
  assert.equal(load(world(), { role: 'member' }).run("privateAction('B')"), null);
  assert.equal(load(world(), { anon: true, role: 'member' }).run("privateAction('A')"), null);
  assert.equal(load(world(), { uid: null, role: 'member' }).run("privateAction('A')"), null);
  assert.equal(load(world(), { anon: true }).run("privateAction('A')"), null, 'even a visitor whose role says admin');
});

test('privateAction agrees with setPrivate: what it offers is what setPrivate accepts, and nothing else', () => {
  for (const id of ['A', 'A1', 'B', 'B1', 'B1a', 'C', 'P', 'X']) {
    const { run } = load(world());
    const offer = run(`privateAction('${id}')`);
    const on = run(`setPrivate('${id}',true)`), off = run(`setPrivate('${id}',false)`);
    on.done.catch(() => {}); off.done.catch(() => {});
    assert.equal(offer === 'make' || offer === 'release', on.ok || off.ok, id);
    if (offer === 'release') assert.equal(off.ok, true, id);
  }
});

test('isPrivate: areas, and MoMs and files inside a private area, hide Share and Access', () => {
  const { run } = load(world());
  for (const id of ['B', 'B1', 'B1a', 'P', 'X']) assert.equal(run(`isPrivate('a',gf('${id}'))`), true, id);
  for (const id of ['A', 'A1', 'C']) assert.equal(run(`isPrivate('a',gf('${id}'))`), false, id);
  assert.equal(run("isPrivate('m',M.find(x=>x.id==='mB'))"), true);
  assert.equal(run("isPrivate('m',M.find(x=>x.id==='mP'))"), true);
  assert.equal(run("isPrivate('m',M.find(x=>x.id==='mA'))"), false);
  assert.equal(run("isPrivate('m',M.find(x=>x.id==='mC'))"), false, 'a missing field in a public area');
  assert.equal(run("isPrivate('f',D.find(x=>x.id==='fB'))"), true);
  assert.equal(run("isPrivate('f',D.find(x=>x.id==='fBold'))"), true, 'no privateTo yet, but its area is private');
  assert.equal(run("isPrivate('f',D.find(x=>x.id==='fA'))"), false);
  assert.equal(run("isPrivate('a',undefined)"), false);
  assert.equal(run("isPrivate('m',null)"), false);
});

test('moveExposes: a MoM or file leaving a private area for a public one is flagged', () => {
  const { run } = load(world());
  assert.deepEqual(run("moveExposes(['m:mB','f:fB'],{area:'A'})"), ['m:mB', 'f:fB']);
  assert.deepEqual(run("moveExposes(['f:fBold'],{area:'A1',group:'g'})"), ['f:fBold'], 'a file whose own field is missing still counts');
  assert.deepEqual(run("moveExposes(['m:mP'],{area:'C'})"), ['m:mP'], 'into an area with no value at all');
});

test('moveExposes: nothing flagged when it stays private or was public already', () => {
  const { run } = load(world());
  assert.deepEqual(run("moveExposes(['m:mB'],{area:'P'})"), [], 'private to private');
  assert.deepEqual(run("moveExposes(['m:mA','f:fA'],{area:'B'})"), [], 'public into private');
  assert.deepEqual(run("moveExposes(['m:mA'],{area:'A'})"), [], 'public to public');
  assert.deepEqual(run("moveExposes(['a:A1'],{area:null})"), [], 'a public area to the top level');
  assert.deepEqual(run("moveExposes([],{area:'A'})"), []);
});

test('moveExposes: an area inside a private area is flagged, one private in its own right is not', () => {
  const { run } = load(world());
  assert.deepEqual(run("moveExposes(['a:B1'],{area:'A'})"), ['a:B1'], 'a sub-area of a private area');
  assert.deepEqual(run("moveExposes(['a:B1'],{area:null})"), ['a:B1'], 'to the top level');
  assert.deepEqual(run("moveExposes(['a:B1'],{area:'B'})"), [], 'within the same private area');
  assert.deepEqual(run("moveExposes(['a:P'],{area:'A'})"), [], 'private in its own right stays private somewhere public');
  assert.deepEqual(run("moveExposes(['a:P'],{area:null})"), [], 'and at the top level');
  assert.deepEqual(run("moveExposes(['a:B'],{area:'A'})"), [], 'a top-level private area stays private');
});

test('moveExposes: a mixed selection lists only the ones it exposes; things moveItems skips are left out', () => {
  const { run } = load(world());
  assert.deepEqual(run("moveExposes(['m:mA','m:mB','a:B1','a:P','f:nope','m:nope'],{area:'A'})"), ['m:mB', 'a:B1']);
  assert.deepEqual(run("moveExposes(['m:mB','f:fB'],{area:null})"), [], 'a MoM or file can\'t go to the top level, so nothing moves');
});

test('moveExposes matches what moveItems writes: an item loses its value exactly when it is flagged', async () => {
  const cases = [
    [['m:mB', 'f:fB', 'm:mA'], { area: 'A' }], [['a:B1'], { area: 'C' }], [['a:B1'], { area: null }], [['a:P'], { area: 'A' }],
    [['a:P'], { area: null }], [['m:mP', 'f:fBold'], { area: 'A1' }], [['m:mA'], { area: 'B' }], [['a:A1'], { area: 'B' }],
    [['a:B1', 'a:P', 'm:mA'], { area: 'A1' }], [['m:mB'], { area: 'P' }],
  ];
  for (const [keys, dest] of cases) {
    const { run, data } = load(world());
    const flagged = run(`moveExposes(${JSON.stringify(keys)},${JSON.stringify(dest)})`);
    const item = k => data[k[0] === 'a' ? 'folders' : k[0] === 'm' ? 'moms' : 'docs'].find(x => x.id === k.slice(2));
    const holder = x => data.folders.find(a => a.id === (x.folderId || x.parent));
    const was = Object.fromEntries(keys.map(k => [k, !!item(k).privateTo || !!(holder(item(k)) || {}).privateTo]));
    const mv = run(`moveItems(${JSON.stringify(keys)},${JSON.stringify(dest)})`);
    await mv.done;
    const exposed = keys.filter(k => was[k] && !item(k).privateTo);
    assert.deepEqual(flagged, exposed, JSON.stringify([keys, dest]));
  }
});
