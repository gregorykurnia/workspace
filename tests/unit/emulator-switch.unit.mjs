// Unit tests for the emulator switch in js/data/firebase.js (plan 1.3, spec §C). Run: npm run test:unit
// The switch must be dead everywhere except localhost / 127.0.0.1 with ?emulator in the URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function load(location) {
  const calls = { auth: [], db: [], init: [], persistence: 0 };   // arrays and objects are copied out of the sandbox as plain JSON
  const db = { useEmulator: (...a) => calls.db.push(JSON.parse(JSON.stringify(a))), enablePersistence: () => { calls.persistence++; return Promise.resolve(); } };
  const authObj = { useEmulator: (...a) => calls.auth.push(JSON.parse(JSON.stringify(a))) };
  const firebase = { initializeApp: c => calls.init.push(JSON.parse(JSON.stringify(c))), firestore: () => db, auth: () => authObj };
  const sandbox = { firebase, location, console, URLSearchParams, document: { currentScript: { dataset: { persist: 'on' } } } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync('js/data/firebase.js', 'utf8'), sandbox, { filename: 'js/data/firebase.js' });
  return { calls, run: code => vm.runInContext(code, sandbox) };
}
const at = (hostname, search = '') => ({ hostname, search });
const LIVE_PROJECT = 'greg-project-5b838';

test('localhost with ?emulator points Auth and Firestore at the emulators, under a demo- project', () => {
  for (const host of ['localhost', '127.0.0.1']) {
    const { calls } = load(at(host, '?emulator'));
    assert.deepEqual(calls.auth, [['http://127.0.0.1:9099', { disableWarnings: true }]]);
    assert.deepEqual(calls.db, [['127.0.0.1', 8085]]);
    assert.equal(calls.init[0].projectId, 'demo-workspace');
    assert.equal(calls.persistence, 0);
  }
});

test('?emulator can sit among other parameters', () => {
  assert.equal(load(at('localhost', '?x=1&emulator')).calls.db.length, 1);
  assert.equal(load(at('localhost', '?emulator=1')).calls.db.length, 1);
});

test('localhost without ?emulator stays on the live project', () => {
  for (const search of ['', '?emulators', '?x=emulator']) {
    const { calls } = load(at('localhost', search));
    assert.deepEqual([calls.auth, calls.db], [[], []]);
    assert.equal(calls.init[0].projectId, LIVE_PROJECT);
    assert.equal(calls.persistence, 1);
  }
});

test('off localhost the switch is dead, whatever the URL says', () => {
  const hosts = ['workspace-mzyz.vercel.app', 'greg-project-5b838.firebaseapp.com', 'localhost.evil.com',
    '127.0.0.1.evil.com', 'evil-localhost', 'LOCALHOST.example', '0.0.0.0', '[::1]', '127.0.0.2', ''];
  for (const host of hosts) {
    for (const search of ['?emulator', '?emulator=1&x=2', '?mom=abc&emulator']) {
      const { calls, run } = load(at(host, search));
      assert.deepEqual([calls.auth, calls.db], [[], []], `${host}${search}`);
      assert.equal(calls.init[0].projectId, LIVE_PROJECT, `${host}${search}`);
      assert.equal(run('EMULATOR'), false);
    }
  }
});

test('with no location at all the switch is off', () => {
  const { calls } = load(undefined);
  assert.deepEqual([calls.auth, calls.db], [[], []]);
  assert.equal(calls.init[0].projectId, LIVE_PROJECT);
});
