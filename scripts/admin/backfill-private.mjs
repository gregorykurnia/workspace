// Adds privateTo: null to items that lack the field. Dry run unless --apply. Never changes anything else.
// Usage: node scripts/admin/backfill-private.mjs [--apply]
import { fileURLToPath } from 'node:url';
import { PRIVATE_COLLECTIONS, UserError, getDb, missingPrivateTo, run } from './lib.mjs';

const BATCH = 400;

// Counts per collection; with apply, sets privateTo: null on the ones missing it.
export async function backfill(db, { apply = false, collections = PRIVATE_COLLECTIONS } = {}) {
  const report = {};
  for (const name of collections) {
    const snap = await db.collection(name).get();
    const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    const ids = missingPrivateTo(docs);
    if (apply) {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = db.batch();
        ids.slice(i, i + BATCH).forEach(id => batch.update(db.collection(name).doc(id), { privateTo: null }));
        await batch.commit();
      }
    }
    report[name] = { total: docs.length, missing: ids.length };
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter(a => a !== '--apply');
  if (unknown.length) throw new UserError('Usage: backfill-private.mjs [--apply]');
  const apply = args.includes('--apply');
  const db = await getDb();
  const report = await backfill(db, { apply });
  console.log(apply ? 'APPLY: setting privateTo: null' : 'DRY RUN: nothing is written (pass --apply to write)');
  let missing = 0;
  for (const [name, r] of Object.entries(report)) {
    missing += r.missing;
    console.log(`  ${name.padEnd(11)} ${String(r.total).padStart(5)} items, ${String(r.missing).padStart(5)} ${apply ? 'updated' : 'missing privateTo'}`);
  }
  console.log(`${missing} item${missing === 1 ? '' : 's'} ${apply ? 'updated' : 'would be updated'}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run(main);
