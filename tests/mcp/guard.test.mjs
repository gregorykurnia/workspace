import './setup.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { assertEmulatorEnv } from './emulator-guard.mjs';

const safe = { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099', GCLOUD_PROJECT: 'demo-workspace' };

test('the guard accepts only local Auth and Firestore emulators with a demo project', () => {
  assert.doesNotThrow(() => assertEmulatorEnv(safe));
  assert.doesNotThrow(() => assertEmulatorEnv({ ...safe, GCLOUD_PROJECT: '', GOOGLE_CLOUD_PROJECT: 'demo-workspace' }));
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    for (const value of [undefined, '', 'live.example:8080', 'localhost.evil:8080', 'http://localhost:8080']) {
      assert.throws(() => assertEmulatorEnv({ ...safe, [name]: value }), new RegExp(name));
    }
  }
  for (const project of [undefined, '', 'greg-project-5b838', 'demo-', 'demo-\nreal']) {
    assert.throws(() => assertEmulatorEnv({ ...safe, GCLOUD_PROJECT: project }), /demo- project/);
  }
  assert.throws(() => assertEmulatorEnv({ ...safe, GOOGLE_CLOUD_PROJECT: 'real-project' }), /demo- project/);
});

test('a direct test import off the emulator exits before it can create a client', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./tests/mcp/setup.mjs')"], {
    env: { ...process.env, FIRESTORE_EMULATOR_HOST: '', FIREBASE_AUTH_EMULATOR_HOST: '' }, encoding: 'utf8',
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /FIRESTORE_EMULATOR_HOST must name a local emulator/);
});
