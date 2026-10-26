// Unit tests for setPrivate and move inheritance (plan 2.2, spec §F). Run: npm run test:unit
// Loads the classic data scripts into a sandbox with a fake Firestore whose batches change the
// in-memory items, so a move and its Undo can be checked against the data they leave behind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const DEL = { del: true };

// data: { folders: [...], moms: [...], docs: [...], docfolders: [...], momfolders: [...] }.
// Items with deleted: true go to the Deleted lists, as the listeners do.
function load(data, { uid = 'admin1', role = 'admin', anon = false } = {}) {
  const byKey = new Map(), commits = [];
  for (const [col, list] of Object.entries(data)) for (const x of list) byKey.set(col + '/' + x.id, x);
  const db = {
    collection: col => ({ doc: id => ({ key: col + '/' + id }) }),
    batch() {
      const ups = [];
      return {
        update(ref, d) { ups.push([ref.key, d]); },
        commit() {
          if (ups.length > 500) return Promise.reject(new Error('batch too large'));
          commits.push(ups.map(u => [u[0], { ...u[1] }]));
          for (const [k, d] of ups) {
            const x = byKey.get(k); assert.ok(x, 'update of a missing doc ' + k);
            for (const [f, val] of Object.entries(d)) { if (val === DEL) delete x[f]; else x[f] = val; }
          }
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
  vm.createContext(sandbox);
  for (const f of ['js/data/store.js', 'js/data/actions.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
  const lists = { folders: ['F', 'TF'], moms: ['M', 'TM'], docs: ['D', 'TD'], docfolders: ['DF', 'TDF'], momfolders: ['MF', 'TMF'] };
  sandbox.__data = data;
  for (const [col, [live, gone]] of Object.entries(lists)) {
    vm.runInContext(`${live}=(__data.${col}||[]).filter(x=>!x.deleted);${gone}=(__data.${col}||[]).filter(x=>x.deleted);`, sandbox);
  }
  const priv = col => Object.fromEntries((data[col] || []).map(x => [x.id, x.privateTo]));
  return { run: code => vm.runInContext(code, sandbox), commits, priv, sandbox };
}

// top ─ A ─ A1 ─ A1a       (A1a deleted)
//     │    └ mA, fA, dfA, mfA, mA-gone (deleted)
//     ├ B (private to admin1) ─ B1
//     │    └ mB, fB
//     └ C ─ P (private to admin1, nested in a public area) ─ mP
function world() {
  return {
    folders: [
      { id: 'A', name: 'A', privateTo: null },
      { id: 'A1', name: 'A1', parent: 'A', privateTo: null },
      { id: 'A1a', name: 'A1a', parent: 'A1', privateTo: null, deleted: true, deletedAt: 1 },
      { id: 'B', name: 'B', privateTo: 'admin1', shared: false },
      { id: 'B1', name: 'B1', parent: 'B', privateTo: 'admin1' },
      { id: 'C', name: 'C', privateTo: null },
      { id: 'P', name: 'P', parent: 'C', privateTo: 'admin1' },
    ],
    moms: [
      { id: 'mA', folderId: 'A1', privateTo: null },
      { id: 'mA-gone', folderId: 'A', privateTo: null, deleted: true, deletedAt: 1 },
      { id: 'mInGone', folderId: 'A1a', privateTo: null, deleted: true, deletedAt: 1 },
      { id: 'mB', folderId: 'B1', privateTo: 'admin1', momFolderId: 'mfB' },
      { id: 'mP', folderId: 'P', privateTo: 'admin1' },
      { id: 'mTop', folderId: 'C', privateTo: null },
    ],
    docs: [
      { id: 'fA', folderId: 'A', privateTo: null, docFolderId: 'dfA' },
      { id: 'fB', folderId: 'B', privateTo: 'admin1' },
      { id: 'fOld', folderId: 'A1' },   // not backfilled yet: no privateTo field
    ],
    docfolders: [{ id: 'dfA', folderId: 'A', privateTo: null }],
    momfolders: [{ id: 'mfA', folderId: 'A1', privateTo: null }, { id: 'mfB', folderId: 'B1', privateTo: 'admin1' }],
  };
}
const written = commits => commits.flat().map(u => u[0]).sort();

test('setPrivate on: the whole subtree, deleted items too, and the link goes off', async () => {
  const w = world(), { run, commits, priv } = load(w);
  const r = run("setPrivate('A',true)");
  assert.equal(r.ok, true);
  await r.done;
  assert.deepEqual(priv('folders'), { A: 'admin1', A1: 'admin1', A1a: 'admin1', B: 'admin1', B1: 'admin1', C: null, P: 'admin1' });
  assert.deepEqual(priv('moms'), { mA: 'admin1', 'mA-gone': 'admin1', mInGone: 'admin1', mB: 'admin1', mP: 'admin1', mTop: null });
  assert.deepEqual(priv('docs'), { fA: 'admin1', fB: 'admin1', fOld: 'admin1' });
  assert.equal(w.docfolders[0].privateTo, 'admin1');
  assert.equal(w.momfolders[0].privateTo, 'admin1');
  assert.equal(w.folders[0].shared, false);
  assert.equal(commits.length, 1, 'a small subtree is one all-or-nothing batch');
  assert.ok(!written(commits).some(k => /^(folders\/[BCP]|moms\/m[BPT])/.test(k)), 'nothing outside A is written');
});

test('setPrivate off: the subtree goes back to null and the link stays off', async () => {
  const w = world(), { run, priv } = load(w);
  await run("setPrivate('B',false)").done;
  assert.equal(priv('folders').B, null);
  assert.equal(priv('folders').B1, null);
  assert.equal(priv('moms').mB, null);
  assert.equal(priv('docs').fB, null);
  assert.equal(w.momfolders[1].privateTo, null);
  assert.equal(w.folders[3].shared, false);
});

test('nested private: a sub-area of a public area can be made private; one inside a private area cannot', async () => {
  const w = world(), { run, priv } = load(w);
  const sub = run("setPrivate('A1',true)");
  assert.equal(sub.ok, true);
  await sub.done;
  assert.equal(priv('folders').A, null, 'the area above stays public');
  assert.equal(priv('folders').A1, 'admin1');
  assert.equal(priv('folders').A1a, 'admin1');
  assert.equal(priv('moms').mA, 'admin1');
  const inside = run("setPrivate('B1',true)");
  assert.equal(inside.ok, false);
  assert.equal(inside.reason, 'inside');
  await assert.rejects(inside.done);
  assert.equal(run("setPrivate('B1',false)").reason, 'inside', 'and it can\'t be made visible on its own');
});

test('setPrivate refuses members, visitors, missing areas and someone else\'s private area', () => {
  assert.equal(load(world(), { role: 'member' }).run("setPrivate('A',true)").reason, 'admin');
  assert.equal(load(world(), { anon: true }).run("setPrivate('A',true)").reason, 'admin');
  assert.equal(load(world(), { uid: null }).run("setPrivate('A',true)").reason, 'admin');
  assert.equal(load(world()).run("setPrivate('nope',true)").reason, 'missing');
  assert.equal(load(world(), { uid: 'admin2' }).run("setPrivate('B',false)").reason, 'owner');
});

test('setPrivate again finishes a half-done write, and writes only what differs', async () => {
  const w = world();
  w.folders[0].privateTo = 'admin1';   // A done, its contents not yet
  const { run, commits, priv } = load(w);
  await run("setPrivate('A',true)").done;
  assert.equal(priv('moms').mA, 'admin1');
  assert.ok(!written(commits).includes('moms/mP') && !written(commits).includes('folders/B'));
});

test('a large subtree goes in batches of 400, contents before the area when making private', async () => {
  const moms = Array.from({ length: 950 }, (_, i) => ({ id: 'm' + i, folderId: 'A', privateTo: null }));
  const { run, commits } = load({ folders: [{ id: 'A', name: 'A', privateTo: null }], moms });
  await run("setPrivate('A',true)").done;
  assert.deepEqual(commits.map(c => c.length), [400, 400, 151]);
  assert.equal(commits.at(-1).at(-1)[0], 'folders/A', 'the area turns private last');
  const off = load({ folders: [{ id: 'A', name: 'A', privateTo: 'admin1' }], moms: moms.map(m => ({ ...m, privateTo: 'admin1' })) });
  await off.run("setPrivate('A',false)").done;
  assert.equal(off.commits[0][0][0], 'folders/A', 'the area turns public first');
});

test('move in: a MoM and a file moved into a private area take its value; Undo puts it back', async () => {
  const w = world(), { run, priv } = load(w);
  const mv = run("moveItems(['m:mTop','f:fA'],{area:'B1',group:null})");
  assert.equal(mv.ok, true);
  await mv.done;
  assert.equal(priv('moms').mTop, 'admin1');
  assert.equal(priv('docs').fA, 'admin1');
  assert.equal(w.moms.find(m => m.id === 'mTop').folderId, 'B1');
  await mv.undo();
  assert.equal(priv('moms').mTop, null);
  assert.equal(priv('docs').fA, null);
  assert.equal(w.moms.find(m => m.id === 'mTop').folderId, 'C');
  assert.equal(w.docs.find(d => d.id === 'fA').docFolderId, 'dfA');
});

test('move in: an area and everything inside it, deleted items too', async () => {
  const w = world(), before = JSON.stringify(w), { run, priv } = load(w);
  const mv = run("moveItems(['a:A'],{area:'B'})");
  await mv.done;
  assert.equal(w.folders[0].parent, 'B');
  for (const id of ['A', 'A1', 'A1a']) assert.equal(priv('folders')[id], 'admin1', id);
  for (const id of ['mA', 'mA-gone', 'mInGone']) assert.equal(priv('moms')[id], 'admin1', id);
  assert.equal(priv('docs').fOld, 'admin1');
  assert.equal(w.docfolders[0].privateTo, 'admin1');
  await mv.undo();
  assert.equal(w.docs.find(d => d.id === 'fOld').privateTo, null, 'a missing field comes back as null');
  delete w.docs.find(d => d.id === 'fOld').privateTo;
  assert.deepEqual(JSON.parse(JSON.stringify(w)), JSON.parse(before), 'Undo restores every place and privateTo');
});

test('move out: a sub-area leaving a private area becomes visible with its contents; Undo makes it private again', async () => {
  const w = world(), { run, priv } = load(w);
  const mv = run("moveItems(['a:B1'],{area:'C'})");
  await mv.done;
  assert.equal(priv('folders').B1, null);
  assert.equal(priv('moms').mB, null);
  assert.equal(w.momfolders[1].privateTo, null);
  assert.equal(priv('folders').B, 'admin1', 'the area it left stays private');
  await mv.undo();
  assert.equal(priv('folders').B1, 'admin1');
  assert.equal(priv('moms').mB, 'admin1');
  assert.equal(w.momfolders[1].privateTo, 'admin1');
  assert.equal(w.folders.find(a => a.id === 'B1').parent, 'B');
});

test('move out: a MoM leaving a private area takes the destination\'s null', async () => {
  const w = world(), { run, priv } = load(w);
  const mv = run("moveItems(['m:mB'],{area:'A'})");
  await mv.done;
  assert.equal(priv('moms').mB, null);
  assert.equal('momFolderId' in w.moms.find(m => m.id === 'mB'), false);
  await mv.undo();
  assert.equal(priv('moms').mB, 'admin1');
  assert.equal(w.moms.find(m => m.id === 'mB').momFolderId, 'mfB');
});

test('an area private in its own right stays private when moved somewhere public or to the top', async () => {
  const w = world(), { run, priv, commits } = load(w);
  await run("moveItems(['a:P'],{area:'A'})").done;
  assert.equal(priv('folders').P, 'admin1');
  assert.equal(priv('moms').mP, 'admin1');
  assert.deepEqual(written(commits), ['folders/P'], 'its contents are not rewritten');
  await run("moveItems(['a:B'],{area:null})").done;
  assert.equal(priv('folders').B, 'admin1');
});

test('a public area moved somewhere public keeps its private sub-areas private', async () => {
  const w = world(), { run, priv, commits } = load(w);
  await run("moveItems(['a:C'],{area:'A'})").done;
  assert.equal(priv('folders').P, 'admin1');
  assert.equal(priv('moms').mP, 'admin1');
  assert.deepEqual(written(commits), ['folders/C']);
});

test('selected items inside a moved area keep their own destination', async () => {
  const w = world(), { run, priv } = load(w);
  // mA is selected along with its area: it goes where it was sent, not along with A.
  const mv = run("moveItems(['a:A','m:mA'],{area:'B'})");
  await mv.done;
  assert.equal(priv('moms').mA, 'admin1');
  assert.equal(w.moms.find(m => m.id === 'mA').folderId, 'B');
  const top = run("moveItems(['a:B1','m:mB'],{area:null})");   // MoMs can't go to the top level: mB follows B1
  await top.done;
  assert.equal(priv('folders').B1, null);
  assert.equal(priv('moms').mB, null);
  assert.equal(w.moms.find(m => m.id === 'mB').folderId, 'B1');
});

test('an area can\'t move into itself', async () => {
  const { run, commits } = load(world());
  const mv = run("moveItems(['a:A'],{area:'A1'})");
  assert.equal(mv.ok, false);
  await assert.rejects(mv.done);
  assert.equal(commits.length, 0);
});

// R2 review: share links inside, and sub-areas private in their own right (privateRoot).
test('setPrivate on turns off the links of what is inside too, and marks the area; off removes the mark', async () => {
  const w = world();
  w.folders[1].shared = true; w.moms[0].shared = true; w.docs[0].shared = false;
  const { run, commits } = load(w);
  await run("setPrivate('A',true)").done;
  assert.equal(w.folders[1].shared, false);
  assert.equal(w.moms[0].shared, false);
  assert.equal(w.folders[0].privateRoot, true);
  assert.ok(!commits.flat().some(u => u[0] === 'docs/fA' && 'shared' in u[1]), 'a link already off is not rewritten');
  await run("setPrivate('A',false)").done;
  assert.equal('privateRoot' in w.folders[0], false);
  assert.equal(w.moms[0].shared, false, 'links stay off once visible again');
});

test('a sub-area made private on its own stays private when the area around it is made private, then visible', async () => {
  const w = world(), { run, priv } = load(w);
  await run("setPrivate('A1',true)").done;
  await run("setPrivate('A',true)").done;
  await run("setPrivate('A',false)").done;
  assert.equal(priv('folders').A, null);
  assert.equal(priv('docs').fA, null);
  assert.equal(priv('folders').A1, 'admin1');
  assert.equal(priv('folders').A1a, 'admin1');
  assert.equal(priv('moms').mA, 'admin1');
});

test('moving out of a private area: a sub-area private on its own stays private, inside a moved area too', async () => {
  const w = world();
  w.folders.push({ id: 'B2', name: 'B2', parent: 'B1', privateTo: 'admin1', privateRoot: true }, { id: 'B3', name: 'B3', parent: 'B', privateTo: 'admin1', privateRoot: true });
  w.moms.push({ id: 'mB2', folderId: 'B2', privateTo: 'admin1' });
  const { run, priv } = load(w);
  assert.deepEqual([...run("moveExposes(['a:B3','a:B1'],{area:'A'})")], ['a:B1'], 'only B1 gets the warning');
  await run("moveItems(['a:B3'],{area:'A'})").done;
  assert.equal(priv('folders').B3, 'admin1');
  await run("moveItems(['a:B1'],{area:'A'})").done;
  assert.equal(priv('folders').B1, null);
  assert.equal(priv('moms').mB, null);
  assert.equal(priv('folders').B2, 'admin1');
  assert.equal(priv('moms').mB2, 'admin1');
});
