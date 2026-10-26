// Runs before `npm run rules:deploy` (plan O5). Refuses the deploy when it would lock people out:
//  - the app still reads one of the five item collections without a privateTo filter (the rules refuse
//    those list reads, so the live app would load nothing until plan 2.1 has shipped), or
//  - the approved list is empty (nobody could open the workspace).
// Usage: node scripts/admin/rules-preflight.mjs   (reads the approved list; writes nothing)
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIVATE_COLLECTIONS, UserError, getDb, run } from './lib.mjs';
import { listEmails } from './allowlist.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');

// Collections read as a whole list straight off db.collection('<name>'), with no where() in between.
export function unfilteredReads(src) {
  const names = PRIVATE_COLLECTIONS.join('|');
  const re = new RegExp(`collection\\(\\s*['"](${names})['"]\\s*\\)\\s*\\.\\s*(onSnapshot|get)\\(`, 'g');
  return [...src.matchAll(re)].map(m => m[1]);
}

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? jsFiles(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : []);
}

async function main() {
  const found = jsFiles(join(ROOT, 'js')).flatMap(f =>
    unfilteredReads(readFileSync(f, 'utf8')).map(c => `${relative(ROOT, f)}: ${c}`));
  if (found.length) {
    throw new UserError(`Not deploying: the app still lists these without a privateTo filter (plan 2.1): ${found.join(', ')}`);
  }
  const emails = await listEmails(await getDb());
  if (!emails.length) throw new UserError('Not deploying: the approved list is empty (node scripts/admin/allowlist.mjs add ...).');
  console.log(`Preflight passed: every list read is filtered, ${emails.length} approved emails.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run(main);
