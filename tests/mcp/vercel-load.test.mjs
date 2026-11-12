// Vercel's Node runtime can't require() an ES module, while local Node can. Load each function the way Vercel
// does, so a dependency that require()s an ESM-only package (jwks-rsa 4 → jose 6, 2026-11-12) fails here first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

for (const file of ['api/mcp/[secret].mjs', 'api/upload/[token].mjs']) {
  test(`${file} loads without require() of ES modules`, () => {
    const url = pathToFileURL(resolve(file)).href;
    const run = spawnSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e', `await import(${JSON.stringify(url)})`], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr.split('\n').slice(0, 6).join('\n'));
  });
}
