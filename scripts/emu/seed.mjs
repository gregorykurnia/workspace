// Fills the running Auth and Firestore emulators: an admin, a member, an unapproved user, sample data.
// Refuses to run unless both emulator hosts are set and local, so it can never write to the live project.
import { pathToFileURL } from 'node:url';
import { ADMIN, MEMBER, STRANGER, PASSWORD, PROJECT, AREA, AREA2, ACCESS, MOM, FILE } from './accounts.mjs';

const LOCAL = /^(127\.0\.0\.1|localhost):\d+$/;

export function assertEmulatorEnv(env = process.env) {
  for (const k of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!LOCAL.test(env[k] || '')) throw new Error(`${k} must point at a local emulator (got "${env[k] || ''}"). Run through npm run test:emu.`);
  }
}

export async function seed() {
  assertEmulatorEnv();
  const { initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ projectId: PROJECT }, `seed-${Date.now()}`);
  const auth = getAuth(app), db = getFirestore(app);
  for (const u of [ADMIN, MEMBER, STRANGER]) {
    await auth.createUser({ uid: u.uid, email: u.email, emailVerified: true, password: PASSWORD, displayName: u.name });
  }
  const batch = db.batch();
  for (const u of [ADMIN, MEMBER]) {
    batch.set(db.collection('users').doc(u.uid), { uid: u.uid, email: u.email, displayName: u.name, role: u.role });
    batch.set(db.collection('allowed_emails').doc(u.email), { email: u.email, addedAt: Date.now() });
  }
  batch.set(db.collection('folders').doc(AREA.id), AREA);
  batch.set(db.collection('folders').doc(AREA2.id), AREA2);
  for (const g of ACCESS) batch.set(db.collection('folder_access').doc(g.id), g);
  batch.set(db.collection('moms').doc(MOM.id), MOM);
  batch.set(db.collection('docs').doc(FILE.id), FILE);
  await batch.commit();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed().then(() => console.log('Seeded the emulators.'), e => { console.error(e.message); process.exit(1); });
}
