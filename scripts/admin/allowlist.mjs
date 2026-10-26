// Approved emails: allowed_emails/{email}  (doc id = trimmed, lowercased email; fields email, addedAt)
// Usage: node scripts/admin/allowlist.mjs list | add <email>... | remove <email>...
import { fileURLToPath } from 'node:url';
import { ALLOWLIST, UserError, getDb, parseEmails, run } from './lib.mjs';

const USAGE = 'Usage: allowlist.mjs list | add <email>... | remove <email>...';

export async function listEmails(db) {
  const snap = await db.collection(ALLOWLIST).get();
  return snap.docs.map(d => d.id).sort();
}

// Adds each email; one already on the list keeps its original addedAt.
export async function addEmails(db, emails, now = () => new Date()) {
  const added = [], existing = [];
  for (const email of emails) {
    const ref = db.collection(ALLOWLIST).doc(email);
    if ((await ref.get()).exists) { existing.push(email); continue; }
    await ref.set({ email, addedAt: now() });
    added.push(email);
  }
  return { added, existing };
}

export async function removeEmails(db, emails) {
  const removed = [], missing = [];
  for (const email of emails) {
    const ref = db.collection(ALLOWLIST).doc(email);
    if (!(await ref.get()).exists) { missing.push(email); continue; }
    await ref.delete();
    removed.push(email);
  }
  return { removed, missing };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!['list', 'add', 'remove'].includes(cmd)) throw new UserError(USAGE);
  if (cmd !== 'list' && rest.length === 0) throw new UserError(USAGE);
  const emails = cmd === 'list' ? [] : parseEmails(rest);
  const db = await getDb();
  if (cmd === 'add') {
    const { added, existing } = await addEmails(db, emails);
    added.forEach(e => console.log(`added ${e}`));
    existing.forEach(e => console.log(`already listed ${e}`));
  } else if (cmd === 'remove') {
    const { removed, missing } = await removeEmails(db, emails);
    removed.forEach(e => console.log(`removed ${e}`));
    missing.forEach(e => console.log(`not on the list ${e}`));
  }
  const all = await listEmails(db);
  console.log(`${all.length} approved email${all.length === 1 ? '' : 's'}:`);
  all.forEach(e => console.log(`  ${e}`));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run(main);
