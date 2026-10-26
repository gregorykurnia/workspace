// Security rules (plan 1.4, spec §D) against the Firestore emulator. Run with npm run test:rules.
// One test per cell of §D's table, for each of the five item collections, plus the extra cases §D lists.
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { setLogLevel } from 'firebase/firestore';

setLogLevel('silent');   // refused writes are expected here; the client would log each one

const PROJECT = 'demo-workspace';
const ITEMS = ['folders', 'moms', 'docs', 'docfolders', 'momfolders'];

// People. Email users sign in by email (provider 'password', which email-link sign-in also reports).
const person = (uid, email, verified = true) => ({ uid, token: { email, email_verified: verified, firebase: { sign_in_provider: 'password' } } });
const ADMIN = person('admin1', 'admin1@example.test');
const ADMIN2 = person('admin2', 'admin2@example.test');
const MEMBER = person('member', 'Member@Example.test');   // mixed case: the list is keyed by lowercased email
const UNVERIFIED = person('unverified', 'unverified@example.test', false);
const UNAPPROVED = person('unapproved', 'unapproved@example.test');
const VISITOR = { uid: 'visitor', token: { provider_id: 'anonymous', firebase: { sign_in_provider: 'anonymous' } } };

let env;
const as = p => (p ? env.authenticatedContext(p.uid, p.token) : env.unauthenticatedContext()).firestore();

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { host, port: Number(port), rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(() => env?.cleanup());

// Fresh data for every test: the approved list, roles, grants, and in each item collection a team item
// ('open'), one private to admin1 ('mine') and one not yet backfilled ('old', no privateTo field).
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    for (const p of [ADMIN, ADMIN2, MEMBER, UNVERIFIED]) {
      const email = p.token.email.toLowerCase();
      await db.doc(`allowed_emails/${email}`).set({ email, addedAt: 1 });
    }
    await db.doc('users/admin1').set({ uid: 'admin1', email: ADMIN.token.email, role: 'admin' });
    await db.doc('users/admin2').set({ uid: 'admin2', email: ADMIN2.token.email, role: 'admin' });
    await db.doc('users/member').set({ uid: 'member', email: 'member@example.test', role: 'member' });
    await db.doc('folder_access/g1').set({ id: 'g1', uid: 'member', folderId: 'open' });
    await db.doc('other/x').set({ a: 1 });
    for (const c of ITEMS) {
      await db.doc(`${c}/open`).set({ name: 'Team', privateTo: null });
      await db.doc(`${c}/mine`).set({ name: 'Private', privateTo: 'admin1' });
      await db.doc(`${c}/old`).set({ name: 'Old' });
    }
  });
});

for (const c of ITEMS) {
  describe(`${c}: read`, () => {
    test('team item: approved can read', () => assertSucceeds(as(MEMBER).doc(`${c}/open`).get()));
    test('team item: visitor can read', () => assertSucceeds(as(VISITOR).doc(`${c}/open`).get()));
    test('team item: signed out is refused', () => assertFails(as(null).doc(`${c}/open`).get()));
    test('team item: unverified email is refused', () => assertFails(as(UNVERIFIED).doc(`${c}/open`).get()));
    test('team item: unapproved email is refused', () => assertFails(as(UNAPPROVED).doc(`${c}/open`).get()));
    test('private item: its owner can read', () => assertSucceeds(as(ADMIN).doc(`${c}/mine`).get()));
    test('private item: a member is refused', () => assertFails(as(MEMBER).doc(`${c}/mine`).get()));
    test('private item: another admin is refused', () => assertFails(as(ADMIN2).doc(`${c}/mine`).get()));
    test('private item: visitor is refused', () => assertFails(as(VISITOR).doc(`${c}/mine`).get()));
    test('list where privateTo == null: approved and visitor can', async () => {
      await assertSucceeds(as(MEMBER).collection(c).where('privateTo', '==', null).get());
      await assertSucceeds(as(VISITOR).collection(c).where('privateTo', '==', null).get());
    });
    test('list where privateTo == own uid: approved can', () =>
      assertSucceeds(as(ADMIN).collection(c).where('privateTo', '==', 'admin1').get()));
    test("list where privateTo == someone else's uid is refused", async () => {
      await assertFails(as(ADMIN2).collection(c).where('privateTo', '==', 'admin1').get());
      await assertFails(as(VISITOR).collection(c).where('privateTo', '==', 'visitor').get());
    });
    test('list without the privateTo filter is refused', async () => {
      await assertFails(as(ADMIN).collection(c).get());
      await assertFails(as(MEMBER).collection(c).get());
      await assertFails(as(VISITOR).collection(c).get());
    });
  });

  describe(`${c}: write`, () => {
    test('approved creates a team item', () => assertSucceeds(as(MEMBER).doc(`${c}/n`).set({ name: 'N', privateTo: null })));
    test('admin creates an item in their private area', () => assertSucceeds(as(ADMIN).doc(`${c}/n`).set({ name: 'N', privateTo: 'admin1' })));
    test('member creating a private item is refused', () => assertFails(as(MEMBER).doc(`${c}/n`).set({ name: 'N', privateTo: 'member' })));
    test("creating an item private to someone else is refused", () => assertFails(as(ADMIN2).doc(`${c}/n`).set({ name: 'N', privateTo: 'admin1' })));
    test('create without privateTo is refused', () => assertFails(as(MEMBER).doc(`${c}/n`).set({ name: 'N' })));
    test('approved edits a team item', () => assertSucceeds(as(MEMBER).doc(`${c}/open`).update({ name: 'Renamed' })));
    test('approved deletes a team item', () => assertSucceeds(as(MEMBER).doc(`${c}/open`).delete()));
    test('admin makes a team item private (null → own uid)', () => assertSucceeds(as(ADMIN).doc(`${c}/open`).update({ privateTo: 'admin1' })));
    test('member making a team item private is refused', () => assertFails(as(MEMBER).doc(`${c}/open`).update({ privateTo: 'member' })));
    test("making a team item private to someone else is refused", () => assertFails(as(ADMIN2).doc(`${c}/open`).update({ privateTo: 'admin1' })));
    test('owner edits their private item', () => assertSucceeds(as(ADMIN).doc(`${c}/mine`).update({ name: 'Renamed' })));
    test('owner makes their private item visible (own uid → null)', () => assertSucceeds(as(ADMIN).doc(`${c}/mine`).update({ privateTo: null })));
    test('owner deletes their private item', () => assertSucceeds(as(ADMIN).doc(`${c}/mine`).delete()));
    test("another admin can't edit, unprivate, take over or delete a private item", async () => {
      await assertFails(as(ADMIN2).doc(`${c}/mine`).update({ name: 'X' }));
      await assertFails(as(ADMIN2).doc(`${c}/mine`).update({ privateTo: null }));
      await assertFails(as(ADMIN2).doc(`${c}/mine`).set({ name: 'X', privateTo: 'admin2' }));
      await assertFails(as(ADMIN2).doc(`${c}/mine`).delete());
    });
    test("member can't write a private item", async () => {
      await assertFails(as(MEMBER).doc(`${c}/mine`).update({ privateTo: null }));
      await assertFails(as(MEMBER).doc(`${c}/mine`).delete());
    });
    test('removing privateTo from an item is refused', () =>
      assertFails(as(ADMIN).doc(`${c}/open`).set({ name: 'No field' })));
    test('item not yet backfilled: a write that adds privateTo works, one that leaves it out is refused', async () => {
      await assertFails(as(MEMBER).doc(`${c}/old`).update({ name: 'X' }));
      await assertSucceeds(as(MEMBER).doc(`${c}/old`).update({ name: 'X', privateTo: null }));
    });
    test("visitor's writes are refused", async () => {
      await assertFails(as(VISITOR).doc(`${c}/n`).set({ name: 'N', privateTo: null }));
      await assertFails(as(VISITOR).doc(`${c}/open`).update({ name: 'X' }));
      await assertFails(as(VISITOR).doc(`${c}/open`).delete());
    });
    test('signed out, unverified and unapproved writes are refused', async () => {
      for (const p of [null, UNVERIFIED, UNAPPROVED]) {
        await assertFails(as(p).doc(`${c}/n`).set({ name: 'N', privateTo: null }));
        await assertFails(as(p).doc(`${c}/open`).update({ name: 'X' }));
        await assertFails(as(p).doc(`${c}/open`).delete());
      }
    });
  });
}

describe('users', () => {
  test('approved can read and list', async () => {
    await assertSucceeds(as(MEMBER).doc('users/admin1').get());
    await assertSucceeds(as(MEMBER).collection('users').get());
  });
  test('visitor, signed out, unverified and unapproved are refused', async () => {
    for (const p of [VISITOR, null, UNVERIFIED, UNAPPROVED]) await assertFails(as(p).collection('users').get());
  });
  test('creates own record as a member, or with no role', async () => {
    const fresh = person('fresh', 'fresh@example.test');
    await env.withSecurityRulesDisabled(ctx => ctx.firestore().doc('allowed_emails/fresh@example.test').set({ email: 'fresh@example.test' }));
    await assertSucceeds(as(fresh).doc('users/fresh').set({ uid: 'fresh', email: 'fresh@example.test', role: 'member' }));
    await env.withSecurityRulesDisabled(ctx => ctx.firestore().doc('users/fresh').delete());
    await assertSucceeds(as(fresh).doc('users/fresh').set({ recent: [] }, { merge: true }));
  });
  test('creating own record as an admin is refused', async () => {
    const fresh = person('fresh', 'fresh@example.test');
    await env.withSecurityRulesDisabled(ctx => ctx.firestore().doc('allowed_emails/fresh@example.test').set({ email: 'fresh@example.test' }));
    await assertFails(as(fresh).doc('users/fresh').set({ uid: 'fresh', role: 'admin' }));
  });
  test("creating or editing someone else's record is refused", async () => {
    await assertFails(as(MEMBER).doc('users/someone').set({ uid: 'someone', role: 'member' }));
    await assertFails(as(MEMBER).doc('users/admin1').update({ displayName: 'X' }));
    await assertFails(as(ADMIN).doc('users/member').update({ role: 'admin' }));
  });
  test('updates own record (Recent) without touching role', () =>
    assertSucceeds(as(MEMBER).doc('users/member').set({ recent: [{ k: 'm', id: 'open', at: 1 }] }, { merge: true })));
  test('changing own role is refused, up or down', async () => {
    await assertFails(as(MEMBER).doc('users/member').update({ role: 'admin' }));
    await assertFails(as(ADMIN).doc('users/admin1').update({ role: 'member' }));
  });
  test('deleting a record is refused', () => assertFails(as(MEMBER).doc('users/member').delete()));
  test('unapproved email creating its record is refused', () =>
    assertFails(as(UNAPPROVED).doc('users/unapproved').set({ uid: 'unapproved', role: 'member' })));
  test("visitor can't write", () => assertFails(as(VISITOR).doc('users/visitor').set({ uid: 'visitor', role: 'member' })));
});

describe('folder_access', () => {
  test('approved can read and list', async () => {
    await assertSucceeds(as(MEMBER).doc('folder_access/g1').get());
    await assertSucceeds(as(MEMBER).collection('folder_access').get());
  });
  test('visitor, signed out and unapproved are refused', async () => {
    for (const p of [VISITOR, null, UNAPPROVED]) await assertFails(as(p).collection('folder_access').get());
  });
  test('admin can grant and revoke', async () => {
    await assertSucceeds(as(ADMIN).doc('folder_access/g2').set({ id: 'g2', uid: 'member', folderId: 'x' }));
    await assertSucceeds(as(ADMIN).doc('folder_access/g1').delete());
  });
  test('member and visitor writes are refused', async () => {
    await assertFails(as(MEMBER).doc('folder_access/g2').set({ id: 'g2', uid: 'member', folderId: 'x' }));
    await assertFails(as(MEMBER).doc('folder_access/g1').delete());
    await assertFails(as(VISITOR).doc('folder_access/g2').set({ id: 'g2' }));
  });
});

describe('allowed_emails', () => {
  test('a person can get their own entry (lowercased)', () => assertSucceeds(as(MEMBER).doc('allowed_emails/member@example.test').get()));
  test('an unapproved person can check their own (missing) entry', () => assertSucceeds(as(UNAPPROVED).doc('allowed_emails/unapproved@example.test').get()));
  test("getting someone else's entry is refused", () => assertFails(as(MEMBER).doc('allowed_emails/admin1@example.test').get()));
  test('listing is refused, even for an admin', () => assertFails(as(ADMIN).collection('allowed_emails').get()));
  test('visitor and unverified email are refused', async () => {
    await assertFails(as(VISITOR).doc('allowed_emails/member@example.test').get());
    await assertFails(as(UNVERIFIED).doc('allowed_emails/unverified@example.test').get());
  });
  test('nobody writes, not even an admin', async () => {
    await assertFails(as(ADMIN).doc('allowed_emails/new@example.test').set({ email: 'new@example.test' }));
    await assertFails(as(ADMIN).doc('allowed_emails/member@example.test').delete());
    await assertFails(as(UNAPPROVED).doc('allowed_emails/unapproved@example.test').set({ email: 'unapproved@example.test' }));
  });
});

describe('anything else', () => {
  test('nobody reads or writes, not even an admin', async () => {
    await assertFails(as(ADMIN).doc('other/x').get());
    await assertFails(as(ADMIN).collection('other').get());
    await assertFails(as(ADMIN).doc('other/y').set({ a: 1 }));
    await assertFails(as(VISITOR).doc('other/x').get());
  });
});
