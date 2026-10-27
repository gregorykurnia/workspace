// Unit tests for sign-in by email link (plan 3.1, spec §H). Run: npm run test:unit
// session.js runs in a sandbox with the real Firebase Auth SDK's link parser (so pasted and returned addresses are
// judged as the page will judge them) and a fake mailer, fake storage and fake Firestore. The screen logic in
// core.js and home.js is lifted out by function name and run with stand-ins for what it draws. No browser, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
firebase.initializeApp({ apiKey: 'unit-test', projectId: 'demo-workspace', authDomain: 'demo.firebaseapp.com' });
const realAuth = firebase.auth();

const tick = () => new Promise(r => setTimeout(r, 0));
const FIREBASE_LINK = 'https://greg-project-5b838.firebaseapp.com/__/auth/action?apiKey=AIza&mode=signIn&oobCode=abc123&continueUrl=https%3A%2F%2Fworkspace-mzyz.vercel.app%2F&lang=en';
const RETURNED_LINK = 'https://workspace-mzyz.vercel.app/?apiKey=AIza&oobCode=abc123&mode=signIn&lang=en';

// A fake Firestore for the approved-list check: allowed[email] = true means that entry exists; a string means that
// error code; anything missing is a missing entry.
function load({ user = null, allowed = {}, href = 'https://workspace-mzyz.vercel.app/', emulator = false, store = {}, sendError = null, signInError = null } = {}) {
  const log = [], gets = [], handlers = [];
  const storage = { ...store };
  const auth = {
    currentUser: user,
    isSignInWithEmailLink: u => realAuth.isSignInWithEmailLink(u),
    sendSignInLinkToEmail: (email, settings) => { log.push(['send', email, settings]); return sendError ? Promise.reject({ code: sendError }) : Promise.resolve(); },
    setPersistence: kind => { log.push(['persist', kind]); return Promise.resolve(); },
    signInWithEmailLink: (email, link) => { log.push(['signin', email, link]); return signInError ? Promise.reject({ code: signInError }) : Promise.resolve({ user: { email } }); },
    onAuthStateChanged: fn => { handlers.push(fn); return () => {}; },
    signInAnonymously: () => Promise.resolve(),
  };
  const db = {
    collection: col => ({
      doc: id => ({
        get: () => {
          gets.push(col + '/' + id);
          const a = allowed[id];
          if (typeof a === 'string') return Promise.reject({ code: a });
          return Promise.resolve({ exists: !!a });
        },
        onSnapshot: (a, b) => { const err = typeof a === 'function' ? b : (typeof b === 'function' ? null : null); return () => {}; },
        set: () => Promise.resolve(),
      }),
      onSnapshot: () => () => {},
      where: () => ({ onSnapshot: () => () => {} }),
    }),
  };
  const url = new URL(href);
  const sandbox = {
    console, Promise, Date, Set, Map, Array, Object, JSON, URLSearchParams, setTimeout, db, crypto: globalThis.crypto,
    navigator: { onLine: true },
    window: { addEventListener() {}, location: url },
    location: url,
    EMULATOR: emulator,
    localStorage: { getItem: k => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); }, removeItem: k => { delete storage[k]; } },
    firebase: { auth: Object.assign(() => auth, { Auth: { Persistence: { LOCAL: 'local', SESSION: 'session' } } }), firestore: { FieldValue: {} } },
    _w: p => p,
  };
  vm.createContext(sandbox);
  for (const f of ['js/data/store.js', 'js/data/session.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f });
  const events = [];
  sandbox.__push = (w, i) => events.push(w);
  vm.runInContext('Store.onChange(__push)', sandbox);
  const run = code => vm.runInContext(code, sandbox);
  return { run, log, gets, storage, events, auth, handlers, sandbox };
}
const asUser = (email, extra = {}) => ({ uid: 'u1', email, isAnonymous: false, ...extra });

// ---------- Reading a link ----------
test('signInLinkIn finds the link in what was pasted, from either address the email can give', () => {
  const { run } = load();
  const cases = [
    FIREBASE_LINK,
    RETURNED_LINK,
    `  ${FIREBASE_LINK}\n`,
    `<${FIREBASE_LINK}>`,
    `Sign in to Workbench: ${RETURNED_LINK} Thanks`,
    RETURNED_LINK.replace(/&/g, '&amp;'),
  ];
  for (const text of cases) {
    const link = run(`signInLinkIn(${JSON.stringify(text)})`);
    assert.match(link, /^https:\/\/[^\s<>]+oobCode=abc123/, `link found in: ${text.slice(0, 40)}`);
    assert.ok(!/[<>\s]/.test(link) && !link.includes('&amp;'));
  }
});

test('signInLinkIn refuses anything that is not a sign-in link', () => {
  const { run } = load();
  for (const text of ['', '   ', 'hello', 'https://workspace-mzyz.vercel.app/#/today', 'https://example.com/?mode=resetPassword&oobCode=abc', 'oobCode=abc&mode=signIn', null, undefined]) {
    assert.equal(run(`signInLinkIn(${JSON.stringify(text === undefined ? null : text)})`), '', String(text));
  }
});

test('cleanEmail trims a good address and refuses the rest', () => {
  const { run } = load();
  assert.equal(run(`cleanEmail('  Thania@Deushcs.com ')`), 'Thania@Deushcs.com');
  for (const bad of ['', 'thania', 'thania@', '@deushcs.com', 'a b@c.com', 'a@b']) assert.equal(run(`cleanEmail(${JSON.stringify(bad)})`), '', bad);
});

// ---------- Asking for the link ----------
test('sendSignInLink asks Firebase to mail a link that comes back to this page, and remembers the email', async () => {
  const t = load({ href: 'https://workspace-mzyz.vercel.app/index.html#/signin' });
  await t.run(`sendSignInLink('thania@deushcs.com', true)`);
  assert.deepEqual(JSON.parse(JSON.stringify(t.log)), [['send', 'thania@deushcs.com', { url: 'https://workspace-mzyz.vercel.app/index.html', handleCodeInApp: true }]]);   // through JSON: made in the sandbox
  assert.equal(t.run('pendingSignInEmail()'), 'thania@deushcs.com');
  assert.equal(t.storage.G_signin_email, 'thania@deushcs.com');
  assert.equal(t.storage.G_signin_stay, '1');
});

test('on the emulator the link comes back with ?emulator, so the page keeps talking to it', async () => {
  const t = load({ href: 'http://localhost:5000/', emulator: true });
  await t.run(`sendSignInLink('admin@example.test')`);
  assert.equal(t.log[0][2].url, 'http://localhost:5000/?emulator');
});

test('"Stay signed in" off is remembered as 0, and a resend does not change the choice', async () => {
  const t = load();
  await t.run(`sendSignInLink('a@b.co', false)`);
  assert.equal(t.storage.G_signin_stay, '0');
  await t.run(`sendSignInLink('a@b.co')`);
  assert.equal(t.storage.G_signin_stay, '0');
});

test('a link that could not be sent remembers nothing', async () => {
  const t = load({ sendError: 'auth/network-request-failed' });
  await assert.rejects(t.run(`sendSignInLink('a@b.co', true)`), { code: 'auth/network-request-failed' });
  assert.equal(t.run('pendingSignInEmail()'), '');
  assert.deepEqual(Object.keys(t.storage), []);
});

// ---------- Using the link ----------
test('signInWithLink keeps the session on the device and forgets the pending email', async () => {
  const t = load({ store: { G_signin_email: 'a@b.co', G_signin_stay: '1' } });
  await t.run(`signInWithLink('a@b.co', ${JSON.stringify(RETURNED_LINK)})`);
  assert.deepEqual(t.log, [['persist', 'local'], ['signin', 'a@b.co', RETURNED_LINK]]);
  assert.deepEqual(Object.keys(t.storage), []);
});

test('with "Stay signed in" off the session ends when the browser closes', async () => {
  const t = load({ store: { G_signin_email: 'a@b.co', G_signin_stay: '0' } });
  await t.run(`signInWithLink('a@b.co', ${JSON.stringify(RETURNED_LINK)})`);
  assert.equal(t.log[0][1], 'session');
});

test('a link opened on another device has no stored choice: it stays signed in', async () => {
  const t = load();
  await t.run(`signInWithLink('a@b.co', ${JSON.stringify(RETURNED_LINK)})`);
  assert.equal(t.log[0][1], 'local');
});

test('a link that fails keeps the pending email, so the same link can be tried again', async () => {
  const t = load({ store: { G_signin_email: 'a@b.co' }, signInError: 'auth/network-request-failed' });
  await assert.rejects(t.run(`signInWithLink('a@b.co', ${JSON.stringify(RETURNED_LINK)})`), { code: 'auth/network-request-failed' });
  assert.equal(t.storage.G_signin_email, 'a@b.co');
});

test('linkProblem tells a spent link, another address and a passing failure apart', () => {
  const { run } = load();
  const why = code => run(`linkProblem(${JSON.stringify({ code })})`);
  assert.equal(why('auth/invalid-action-code'), 'expired');
  assert.equal(why('auth/expired-action-code'), 'expired');
  assert.equal(why('auth/invalid-email'), 'email');
  assert.equal(why('auth/network-request-failed'), 'retry');
  assert.equal(why('auth/internal-error'), 'retry');
  assert.equal(run('linkProblem(null)'), 'retry');
});

// ---------- An email that is not on the list ----------
const PERMISSION = { code: 'permission-denied' };
const deny = async (t, err = PERMISSION) => { t.sandbox.__e = err; t.run(`Store._emit('error', __e)`); await tick(); await tick(); };

test('a permission error from an email that is not on the list turns the "can\'t open" state on', async () => {
  const t = load({ user: asUser('Stranger@Example.test') });
  await deny(t);
  assert.deepEqual(t.gets, ['allowed_emails/stranger@example.test']);   // the entry is looked up by the lowercased email
  assert.equal(t.run('ACCESS_DENIED'), true);
  assert.ok(t.events.includes('denied'));
});

test('a permission error from an approved email is not "denied": something else went wrong', async () => {
  const t = load({ user: asUser('thania@deushcs.com'), allowed: { 'thania@deushcs.com': true } });
  await deny(t);
  assert.equal(t.run('ACCESS_DENIED'), false);
  assert.ok(!t.events.includes('denied'));
});

test('an entry the rules refuse to show (unverified email) counts as not approved', async () => {
  const t = load({ user: asUser('a@b.co'), allowed: { 'a@b.co': 'permission-denied' } });
  await deny(t);
  assert.equal(t.run('ACCESS_DENIED'), true);
});

test('no connection while checking proves nothing: not denied', async () => {
  const t = load({ user: asUser('a@b.co'), allowed: { 'a@b.co': 'unavailable' } });
  await deny(t);
  assert.equal(t.run('ACCESS_DENIED'), false);
});

test('other errors, guests and signed-out pages never start the check', async () => {
  for (const [user, err] of [[asUser('a@b.co'), { code: 'unavailable' }], [asUser('a@b.co', { isAnonymous: true }), PERMISSION], [null, PERMISSION], [asUser('a@b.co'), null]]) {
    const t = load({ user });
    await deny(t, err);
    assert.deepEqual(t.gets, []);
    assert.equal(t.run('ACCESS_DENIED'), false);
  }
});

test('five failing listeners make one check', async () => {
  const t = load({ user: asUser('a@b.co') });
  t.sandbox.__e = PERMISSION;
  for (let i = 0; i < 5; i++) t.run(`Store._emit('error', __e)`);
  await tick(); await tick();
  assert.equal(t.gets.length, 1);
});

test('a new sign-in is judged afresh', async () => {
  const t = load({ user: asUser('a@b.co') });
  t.run('startSession()');
  await deny(t);
  assert.equal(t.run('ACCESS_DENIED'), true);
  t.auth.currentUser = null;
  t.handlers.forEach(h => h(null));
  assert.equal(t.run('ACCESS_DENIED'), false);
});

// ---------- The screens' logic: who goes where ----------
// Lifts `function name(...) {...}` out of a classic script by counting braces (none of these hold a brace in a string).
function lift(file, name) {
  const src = fs.readFileSync(file, 'utf8');
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} in ${file}`);
  let depth = 0, i = src.indexOf('{', at);
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    if (src[j] === '}' && --depth === 0) return src.slice(at, j + 1);
  }
  throw new Error(`unclosed ${name}`);
}

function core({ user = { isAnonymous: false, uid: 'u1' }, ui = {}, role = 'member', denied = false } = {}) {
  const sandbox = { UI: { authReady: true, roleReady: true, accessReady: true, sharedHome: null, ...ui }, auth: { currentUser: user }, CURR_USER_ROLE: role, FA: [{ uid: 'u1' }], ACCESS_DENIED: denied };
  vm.createContext(sandbox);
  for (const n of ['sessionRole', 'guard']) vm.runInContext(lift('js/ui/core.js', n), sandbox);
  return { role: () => vm.runInContext('sessionRole()', sandbox), guard: name => vm.runInContext(`guard({ name: ${JSON.stringify(name)} })`, sandbox) };
}

test('an unapproved email is "denied", before anything of theirs has loaded', () => {
  const c = core({ denied: true, ui: { roleReady: false } });
  assert.equal(c.role(), 'denied');
});

test('denied is for people signed in with an email, not guests or signed-out pages', () => {
  assert.equal(core({ denied: true, user: { isAnonymous: true } }).role(), 'visitor');
  assert.equal(core({ denied: true, user: null }).role(), 'signedout');
  assert.equal(core({ denied: false }).role(), 'member');
});

test('a denied person is kept on the sign-in address, where the "can\'t open" screen shows', () => {
  const c = core({ denied: true });
  assert.equal(c.guard('signin'), null);
  for (const name of ['today', 'areas', 'account', 'shared', 'newmember', 'mom']) assert.equal(c.guard(name), '#/signin', name);
});

test('signed out: the sign-in screen and share addresses open, the old reset address and the rest go to sign-in', () => {
  const c = core({ user: null });
  assert.equal(c.guard('signin'), null);
  assert.equal(c.guard('shared'), null);
  for (const name of ['today', 'reset', 'account']) assert.equal(c.guard(name), '#/signin', name);
});

test('signed in: the sign-in address goes on to Today', () => {
  assert.equal(core().guard('signin'), '#/today');
});

test('the old reset address is gone from the router', () => {
  const sandbox = { location: { hash: '#/reset' }, unesc: s => s, URLSearchParams };
  vm.createContext(sandbox);
  vm.runInContext(lift('js/ui/core.js', 'route'), sandbox);
  assert.equal(vm.runInContext('route().name', sandbox), 'missing');
});

// The link on load and its failures, lifted from home.js with stand-ins for what they call.
function home({ pending = '', signIn = () => Promise.resolve(), href = RETURNED_LINK + '&emulator' } = {}) {
  const url = new URL(href);
  const calls = [];
  const SIGNIN = { step: 'email', email: '', link: '', notice: null, err: '', focus: false };
  const sandbox = {
    SIGNIN, URLSearchParams, location: url,
    history: { replaceState: (a, b, u) => { calls.push(['url', u]); } },
    pendingSignInEmail: () => pending,
    signInWithLink: (email, link) => { calls.push(['signInWithLink', email, link]); return signIn(); },
    linkProblem: vm.runInContext('(' + lift('js/data/session.js', 'linkProblem') + ')', vm.createContext({})),
    go: h => calls.push(['go', h]),
    showSignin: (step, o = {}) => { Object.assign(SIGNIN, { step, notice: null, err: '', focus: true }, o); calls.push(['show', step]); },
  };
  vm.createContext(sandbox);
  for (const n of ['openSignInLink', 'finishLink']) vm.runInContext(lift('js/ui/home.js', n), sandbox);
  return { SIGNIN, calls, open: () => vm.runInContext(`openSignInLink(${JSON.stringify(href)})`, sandbox), finish: (email, link) => { sandbox.__a = [email, link]; return vm.runInContext('finishLink(...__a)', sandbox); } };
}

test('opened from the email on the same device: the link is used at once and leaves the address', async () => {
  const h = home({ pending: 'a@b.co' });
  h.open();
  await tick();
  assert.deepEqual(h.calls[0], ['url', '/?emulator#/signin']);   // the link's parameters are gone; ?emulator stays
  assert.equal(h.calls[1][0], 'signInWithLink');
  assert.equal(h.calls[1][1], 'a@b.co');
  assert.match(h.calls[1][2], /oobCode=abc123/);
  assert.deepEqual(h.calls.at(-1), ['go', '#/today']);
});

test('opened on another device (no pending email): ask for the email again, keeping the link', () => {
  const h = home({ pending: '' });
  h.open();
  assert.equal(h.SIGNIN.step, 'confirm');
  assert.match(h.SIGNIN.link, /oobCode=abc123/);
  assert.ok(!h.calls.some(c => c[0] === 'signInWithLink'));
});

test('a spent link goes back to the first screen with a note, and forgets the link', async () => {
  const h = home({ signIn: () => Promise.reject({ code: 'auth/invalid-action-code' }) });
  await h.finish('a@b.co', RETURNED_LINK);
  assert.equal(h.SIGNIN.step, 'email');
  assert.equal(h.SIGNIN.link, '');
  assert.equal(h.SIGNIN.notice.title, 'That link has expired');
});

test('another address than the one asked for stays on the confirm screen, with the field marked', async () => {
  const h = home({ signIn: () => Promise.reject({ code: 'auth/invalid-email' }) });
  await h.finish('wrong@b.co', RETURNED_LINK);
  assert.equal(h.SIGNIN.step, 'confirm');
  assert.equal(h.SIGNIN.email, 'wrong@b.co');
  assert.match(h.SIGNIN.err, /isn’t the email this link was sent to/);
});

test('a failure that passes (no connection) lets the same link be tried again', async () => {
  const h = home({ signIn: () => Promise.reject({ code: 'auth/network-request-failed' }) });
  await h.finish('a@b.co', RETURNED_LINK);
  assert.equal(h.SIGNIN.step, 'confirm');
  assert.equal(h.SIGNIN.email, 'a@b.co');
  assert.equal(h.SIGNIN.notice.title, 'Couldn’t sign you in');
});
