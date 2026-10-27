// Removes what end-to-end tests left in the live workspace: every area named "[TEST…]", its sub-areas, everything
// inside them, and any other item whose own name starts with "[TEST". Dry run unless --apply. Deletes for good.
// Usage: node scripts/admin/remove-test-data.mjs [--apply]
import { fileURLToPath } from 'node:url';
import { PRIVATE_COLLECTIONS, UserError, getDb, run } from './lib.mjs';

const BATCH = 400;
const TAG = /^\[TEST\b/;
const label = x => x.name ?? x.title ?? '';

// data: { collection: [{ id, data }] }. Returns { collection: [{ id, name }] } of what to remove.
export function findTestData(data) {
  const folders = data.folders ?? [];
  const areas = new Set(folders.filter(f => TAG.test(label(f.data))).map(f => f.id));
  for (let grew = true; grew;) {   // sub-areas of a test area, however deep
    grew = false;
    for (const f of folders) if (!areas.has(f.id) && areas.has(f.data.parent)) { areas.add(f.id); grew = true; }
  }
  const out = {};
  for (const [name, docs] of Object.entries(data)) {
    const hit = name === 'folders' ? d => areas.has(d.id) : d => areas.has(d.data.folderId) || TAG.test(label(d.data));
    out[name] = docs.filter(hit).map(d => ({ id: d.id, name: label(d.data) }));
  }
  return out;
}

export async function removeTestData(db, { apply = false, collections = PRIVATE_COLLECTIONS } = {}) {
  const data = {};
  for (const name of collections) {
    const snap = await db.collection(name).get();
    data[name] = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  }
  const found = findTestData(data);
  if (apply) {
    for (const [name, items] of Object.entries(found)) {
      for (let i = 0; i < items.length; i += BATCH) {
        const batch = db.batch();
        items.slice(i, i + BATCH).forEach(x => batch.delete(db.collection(name).doc(x.id)));
        await batch.commit();
      }
    }
  }
  return found;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--apply')) throw new UserError('Usage: remove-test-data.mjs [--apply]');
  const apply = args.includes('--apply');
  const found = await removeTestData(await getDb(), { apply });
  console.log(apply ? 'APPLY: deleting for good' : 'DRY RUN: nothing is deleted (pass --apply to delete)');
  let total = 0;
  for (const [name, items] of Object.entries(found)) {
    total += items.length;
    console.log(`  ${name.padEnd(11)} ${String(items.length).padStart(5)}`);
    if (name === 'folders') items.forEach(x => console.log(`      ${x.name}`));
  }
  console.log(`${total} item${total === 1 ? '' : 's'} ${apply ? 'deleted' : 'would be deleted'}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run(main);
