# Email-link sign-in and private areas

AI Build Log project: workspace

**Goal.** (1) People sign in by typing their email and tapping a link in their inbox, and only emails on an
approved list get into the workspace. (2) Any admin can make an area private: it and everything inside it
can be read only by that admin, enforced by Firestore security rules, not just hidden on screen.

**Why rules matter.** Today every signed-in person (and every share-link visitor) downloads all areas, MoMs
and files; access grants and password locks only hide them on screen. Visitors can also write. The rules in
this plan close that for private areas and for writes.

**Pushes go to production.** This project pushes `main` after every change (Vercel deploys it). The task
order below keeps every push safe: nothing depends on a rule or data change that hasn't happened yet.

## Before the run (owner)
- [ ] O1 *owner*: Firebase console → Authentication → Sign-in method → Email/Password → turn on **Email link (passwordless sign-in)**. Under Settings → Authorized domains, check the live Vercel domain is listed.
- [x] O2 *owner*: admin key at `~/.config/workbench/firebase-admin.json` (service account `firebase-adminsdk-fbsvc`, mode 600, 2026-10-26). Never commit it, print it or copy it elsewhere.
- [x] O3 *owner*: approved emails listed in `.approved-emails.txt` (git-ignored, one per line, never committed). The owner asked for them to be added (2026-10-26): task 1.1 does it.

## Phase 1: Groundwork (no visible change)
- [x] 1.1 Admin scripts in `scripts/admin/` (spec §A): `allowlist.mjs list|add|remove`, `backfill-private.mjs` (dry run by default). Add `firebase-admin` as a dev dependency. Done when: `node --test scripts/admin` passes, the dry run prints counts per collection, and `allowlist.mjs add $(cat .approved-emails.txt)` then `allowlist.mjs list` shows all five emails (adding to the list is harmless before the rules go live) · Sonnet 5.5 High: small scripts, but they touch production data. Code done 2026-10-26 (8f2e878); the production steps are O3b (unattended sessions can't reach production)
- [x] 1.2 Every create writes `privateTo` (spec §B): areas, MoMs, files and groupings copy their area's value, `null` at the top level. Files: `js/data/actions.js`, `js/data/store.js`, the `sF(` call in `js/ui/area.js`. Done when: unit tests for `privOf()` and each create path pass · Sonnet 5.5 High: a few small, clear edits. Done 2026-10-26: `privOf()` in store.js, stamping in the `sF/sM/sD/sDF/sMF` setters, `npm run test:unit`
- [x] 1.3 Emulator mode for tests (spec §C): `?emulator` on localhost points Auth and Firestore at the local emulators, a seed script creates an admin, a member, an unapproved user and sample data. Add `firebase-tools` as a dev dependency, `firebase.json`, `.firebaserc`. Done when: `npm run test:emu -- tests/smoke.spec.js` signs in on the emulator and the switch is provably dead off localhost (unit test) · Sonnet 5.5 High: config and wiring. Done 2026-10-26: `js/data/firebase.js`, `scripts/emu/`, `tests/unit/emulator-switch.unit.mjs`; Firestore emulator on 8085 (8080 is code-server here)
- [x] 1.4 Security rules (spec §D) in `firestore.rules`, with emulator tests in `tests/rules/` run by `npm run test:rules`. Done when: every case in §D's table passes · Opus 5.5 High: silent failures lock people out or leak data. Done 2026-10-26: 181 cases pass; the tests load the rules themselves, `firebase.json` doesn't name them yet
- [x] 1.5 *(Note from 1.4: the rules refuse the current app's unfiltered listeners (spec §D), so they only pass here after 2.1; to load them, add `"firestore": {"rules": "firestore.rules"}` to `firebase.json`.)* Phase 1 end-to-end: on the emulator with the new rules loaded, the current app (still password sign-in) works for the seeded admin and member: open areas, create a MoM, add a file by link, move both, and a share-link visitor reads but can't write. Done when: `npm run test:emu` passes for these flows · Sonnet 5.5 High: test writing. Done 2026-10-26: `tests/phase1-rules.spec.js`, rules loaded in `firebase.json`; the current app's unfiltered listeners are refused, so `tests/emu-support.js` serves store.js with the `privateTo == null` filter until 2.1 (delete it there)
- [x] R1 Phase 1 review: read the diff of 1.1–1.5, run the full checks once, fix what it finds · Opus 5.5 High: phase review. Done 2026-10-26: unit, rules (181), emulator suite pass; added `rules:deploy` with a lockout preflight, split O3b out of 1.1
- [ ] O3b *owner*: `node scripts/admin/allowlist.mjs add $(cat .approved-emails.txt)`, then `node scripts/admin/allowlist.mjs list` shows all five; then `node scripts/admin/backfill-private.mjs` (dry run) prints counts per collection.
- [ ] O4 *owner*: run `node scripts/admin/backfill-private.mjs --apply` (after reading its dry run). It only adds `privateTo: null` to items missing it; the current app ignores the field.

## Phase 2: Private areas
- [ ] 2.1 Load by visibility (spec §E): each of the five collections listens with `where('privateTo','==',null)` plus, for a signed-in non-visitor, `where('privateTo','==',uid)`, merged by id before the existing snapshot handling (pending, added, purge, sync state unchanged). First check O4 is ticked (unattended sessions can't read production to run the dry run themselves): if not, stop and log "waiting on O4" without pushing. Files: `js/data/store.js`. Done when: data-layer unit tests with fake snapshots pass and the emulator smoke run loads everything · Opus 5.5 High: the core data path
- [ ] 2.2 `setPrivate(areaId, on)` and move inheritance (spec §F) in `js/data/actions.js`: writes `privateTo` across the whole subtree, including deleted items, in batches of 400; `moveItems` gives moved items and their subtrees the destination's value. Done when: unit tests for subtree, nested private, move in, move out and Undo pass · Opus 5.5 High: data writes across many items
- [ ] 2.3 Private-area screens (spec §G): ⋯ menu "Make private" / "Make visible to the team", confirm dialogs, a "Private" badge in the area header and tree, Share and Access hidden inside private areas, a warning when moving something out of a private area. Reuse existing components only. Done when: unit tests for the menu rules pass and screenshots at desktop and phone width look right · Sonnet 5.5 xHigh: presentation work
- [ ] 2.4 Phase 2 end-to-end on the emulator, new spec `tests/private-areas.spec.js`: admin makes an area private → member and visitor can't see it, and a direct read of one of its MoMs by the member is refused; moving a MoM in and out; making it visible again. Done when: the spec passes · Sonnet 5.5 High: test writing
- [ ] R2 Phase 2 review · Opus 5.5 High: phase review

## Phase 3: Email-link sign-in
- [ ] 3.1 Sign-in by link (spec §H, approved mockup `docs/mockups/signin-states.js`): this push removes password sign-in on the live site, so first check O1 is ticked; if not, change nothing, log "waiting on O1" and stop. Email field → "Send sign-in link" → "Check your inbox"; finishing the link on load; email asked again when the link is opened on another device; "Paste the link from your email" for the iPhone home-screen app; a "This email can't open the workspace" screen with Sign out on a permission error. Remove the password form, Reset, and Change password. Files: `js/data/session.js`, `js/ui/home.js`, `js/ui/account.js`, `js/ui/core.js`. Done when: unit tests for the link handling pass, screenshots look right · Sonnet 5.5 xHigh: presentation-heavy flow
- [ ] 3.2 Phase 3 end-to-end on the emulator, spec `tests/signin-link.spec.js` (link read from the Auth emulator's `oobCodes`): approved email signs in, unapproved email lands on the "can't open" screen, link on another device, pasted link, sign out. Update `tests/support.js` so `signIn()` uses the link on the emulator. Done when: this spec plus `private-areas.spec.js` pass · Sonnet 5.5 High: test writing
- [ ] R3 Phase 3 review: full emulator suite once, rules tests, accessibility scan of the new screens · Opus 5.5 High: phase review
- [ ] O5 *owner*: say "deploy the rules". Claude runs `npm run rules:deploy -- --dry-run`, then the real deploy (its preflight refuses while the app has an unfiltered list read or the approved list is empty). From then on: everyone signs in once more by email link (password sessions stop working), and only approved emails get in.
- [ ] O6 *owner*: on your iPhone, sign in from the home-screen app with the pasted link, make one area private, and check from a member's account that it's gone.

## Spec

**§A Admin scripts.** Key from `WORKBENCH_ADMIN_KEY` or `~/.config/workbench/firebase-admin.json`; missing key → one-line message, exit 1. Approved emails live in `allowed_emails/{email}` (doc id = trimmed, lowercased email; fields `email`, `addedAt`). `backfill-private.mjs` covers `folders`, `moms`, `docs`, `docfolders`, `momfolders`; it only sets `privateTo: null` where the field is missing, never changes anything else, and prints counts.

**§B Field.** `privateTo`: the uid of the admin who made the area private, or `null`. Every item in a private area (sub-areas, MoMs, files, groupings, deleted ones too) carries the same value. `privOf(areaId)` returns the area's value or `null`.

**§C Emulator mode.** Only when `location.hostname` is `localhost` or `127.0.0.1` and the URL has `?emulator`: `auth.useEmulator('http://127.0.0.1:9099')`, `db.useEmulator('127.0.0.1', 8085)` (8080 is taken by code-server on the dev machine; the emulator also uses the `demo-workspace` project). Cloudinary uploads are not part of emulator tests. `npm run test:emu` = `firebase emulators:exec --only auth,firestore` around the seed script and Playwright. Start nothing else; the emulators stop when the run ends. npm 11 holds back the install scripts of `re2`, `protobufjs` and `@firebase/util`; firebase-tools works without them, so leave them unapproved.

**§D Rules.** `approved` = signed in, not anonymous, `email_verified`, and `allowed_emails/{lowercased email}` exists. `visitor` = anonymous.

| Collection | Read | Write |
|---|---|---|
| folders, moms, docs, docfolders, momfolders | `privateTo == null`: approved or visitor. Otherwise: approved and `privateTo == uid` | approved; and the item's old and new `privateTo` are each `null` or the caller's uid; turning it from `null` to a uid needs role `admin` |
| users | approved | create/update own doc only; `role` can't be set above `member` or changed by the client |
| folder_access | approved | admin |
| allowed_emails | `get` of your own email's doc only | nobody (console or scripts) |
| anything else | nobody | nobody |

Tests cover each cell, plus: unverified email, unapproved email, a list query without the `privateTo` filter (refused), a visitor's write (refused), an admin reading another admin's private item (refused).

**§E Listeners.** The `null` query and the `uid` query feed one map per collection; the existing `_onSnap` logic runs on the merged list. Visitors and signed-out users run only the `null` query. A permission error emits `'error'` as today.

**§F Making private.** Only an admin, only on an area whose `privateTo` is `null` and whose parent's is `null` (making a sub-area private is fine; nesting inside someone else's private area is impossible because they're invisible). Making private sets the subtree to the caller's uid, and turns off `shared` links inside (`shared: false` on the area). Making visible sets the subtree back to `null` and leaves links off. Folder-access grants on the area stay but have no effect while it's private.

**§G Wording (defaults, no design gaps to ask about).** Menu: "Make private" / "Make visible to the team". Confirm: "Only you will see *{area}* and everything inside it. Team members lose access, and its share links stop working." / "Everyone with access to the area above will see *{area}* again." Badge: lock icon + "Private". Move-out warning: "This will be visible to the team." Use the existing lock icon, menu, dialog and badge components.

**§H Sign-in wording and storage.** The wording, icons, buttons and order of the four screens (enter email, check your inbox with the paste-the-link field, confirm your email on another device, can't open the workspace) are exactly those in `docs/mockups/signin-states.js`, approved by the owner. "Send it again" resends to the same email; "Use a different email" goes back to the first screen (signing out first on the can't-open screen). Pending email stored in localStorage `G_signin_email` (add it to `CLAUDE.md`'s key list; removed once signed in). Sessions stay signed in on the device (LOCAL persistence). Firebase sends a link to any address typed; access is decided by the rules, so the screen never reveals whether an email is on the list.

**Known limits (accepted).** Uploaded files live on Cloudinary at public addresses: a private file's entry is hidden, but anyone who already has the file's exact link can open it. Items downloaded to a device before an area was made private can stay in that device's offline copy until its next sync. Share-link visitors can still read every non-private item; narrowing that is a follow-up.
