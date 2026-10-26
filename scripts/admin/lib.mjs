// Shared helpers for the admin scripts (spec §A of docs/IMPLEMENTATION_PLAN.md).
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_KEY_PATH = join(homedir(), '.config', 'workbench', 'firebase-admin.json');
export const ALLOWLIST = 'allowed_emails';
export const PRIVATE_COLLECTIONS = ['folders', 'moms', 'docs', 'docfolders', 'momfolders'];

export class UserError extends Error {}

// Doc id and stored email: trimmed, lowercased.
export function normalizeEmail(raw) {
  return String(raw ?? '').trim().toLowerCase();
}

// Same loose shape check the sign-in form needs; the real check is the approved-list lookup.
export function isEmail(s) {
  return /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(s);
}

// Unique, valid, normalized emails from the command line. Throws on any invalid one.
export function parseEmails(args) {
  const out = [];
  for (const a of args) {
    const e = normalizeEmail(a);
    if (!isEmail(e)) throw new UserError(`Not an email address: ${a}`);
    if (!out.includes(e)) out.push(e);
  }
  return out;
}

// Ids of docs in `docs` (array of { id, data }) whose data lacks the privateTo field.
export function missingPrivateTo(docs) {
  return docs.filter(d => !Object.prototype.hasOwnProperty.call(d.data, 'privateTo')).map(d => d.id);
}

export function readKey(env = process.env, read = readFileSync) {
  const path = env.WORKBENCH_ADMIN_KEY || DEFAULT_KEY_PATH;
  try {
    return JSON.parse(read(path, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new UserError(`Admin key not found at ${path}. Set WORKBENCH_ADMIN_KEY or put it at ${DEFAULT_KEY_PATH}.`);
    }
    throw new UserError(`Admin key at ${path} could not be read as JSON.`);
  }
}

export async function getDb() {
  const key = readKey();
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(key) });
  return getFirestore();
}

// Runs a script's main(); a UserError prints one line and exits 1.
export async function run(main) {
  try {
    await main();
  } catch (e) {
    if (e instanceof UserError) {
      console.error(e.message);
      process.exit(1);
    }
    console.error(e?.message || e);
    process.exit(1);
  }
}
