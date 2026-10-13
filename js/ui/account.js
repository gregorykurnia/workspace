/* Account (U3), Install as an app, and Change password. The account is the signed-in person's: the
   details, the role, the Appearance choice (per device, G_theme), and the areas they can see. */
'use strict';

/* ---------- Appearance (per device) ---------- */
const THEMES = [['light', 'Light', 'sun'], ['dark', 'Dark', 'eye'], ['system', 'Match system', 'layout']];
/* light and dark set the page's theme; "system" removes the attribute so the system setting applies. */
function applyTheme(v) {
  const t = ['light', 'dark'].includes(v) ? v : 'system';
  lsSet('G_theme', t);
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
function currentTheme() { const t = lsGet('G_theme'); return ['light', 'dark'].includes(t) ? t : 'system'; }
on('set-theme', d => { applyTheme(d.v); render(); });

/* ---------- The Account page ---------- */
VIEWS.account = {
  html() {
    const me = currentUser();
    const role = isAdmin() ? 'Admin' : 'Member';
    const roots = visibleRoots();
    const access = isAdmin()
      ? '<span class="kid">All areas</span>'
      : (roots.length ? roots.map(a => `<span class="kid">${emojiLead(a)}${esc(a.name)}</span>`).join('') : '');
    const seg = THEMES.map(([v, l]) => `<button type="button" data-act="set-theme" data-v="${v}" aria-pressed="${currentTheme() === v}">${esc(l)}</button>`).join('');
    return `<div class="page">
      <p class="eyebrow">Account</p><h1 class="h-page">${esc(me.name)}</h1>
      <div class="acct-grid">
        <div class="acct-card">
          <div class="acct-hero"><span class="avatar">${esc(me.ini)}</span><div><b class="acct-name">${esc(me.name)}</b><span class="muted">${esc(me.email)}</span><div class="acct-role">${rolePillHTML(role)}</div></div></div>
          <div class="acct-list">
            <button type="button" class="row" data-act="change-password">${ic('key')}<span class="mid"><span class="t">Change password</span><span class="p">At least 6 characters</span></span>${ic('chev-r', 'sm')}</button>
            <button type="button" class="row" data-act="install">${ic('install')}<span class="mid"><span class="t">Install ${esc(APP_NAME)}</span><span class="p">Open it on its own, like an app</span></span>${ic('chev-r', 'sm')}</button>
            <button type="button" class="row" data-act="sign-out">${ic('signout')}<span class="mid"><span class="t">Sign out</span><span class="p">On this device</span></span>${ic('chev-r', 'sm')}</button>
          </div>
        </div>
        <div class="acct-card">
          <h2 class="h2 acct-h">Appearance</h2>
          <p class="muted acct-copy">Light is the default. Dark is easier in a dim room.</p>
          <div class="seg acct-seg" role="group" aria-label="Appearance">${seg}</div>
          <div class="acct-rule"></div>
          <h2 class="h2 acct-h">Your access</h2>
          <p class="muted acct-copy">${isAdmin() ? 'As an admin you see every area.' : roots.length ? 'Areas granted to you, and everything inside them.' : 'You have no areas yet. An admin can grant access.'}</p>
          <div class="kids acct-kids">${access}</div>
          <p class="hint">${ic('info', 'sm')}Accounts are created by the workspace owner. There is no self sign-up.</p>
        </div>
      </div>
    </div>`;
  },
};
on('sign-out', () => { signOut().then(() => location.reload(), () => toast('Couldn’t sign out. Check your connection, then try again.', { icon: 'alert', tone: 'warn' })); });

/* ---------- Change password (U3) ---------- */
on('change-password', () => {
  layer({
    label: 'Change password',
    html: `<form data-form="change-pw" novalidate>${dialogHTML({
      title: 'Change password', text: 'Use at least 6 characters.',
      body: fieldHTML({ id: 'cpCur', label: 'Current password', control: inputHTML({ id: 'cpCur', name: 'current', type: 'password', autocomplete: 'current-password' }) })
        + fieldHTML({ id: 'cpNew', label: 'New password', control: inputHTML({ id: 'cpNew', name: 'next', type: 'password', autocomplete: 'new-password', hint: 'At least 6 characters' }), hint: 'At least 6 characters' })
        + fieldHTML({ id: 'cpConf', label: 'Confirm new password', control: inputHTML({ id: 'cpConf', name: 'confirm', type: 'password', autocomplete: 'new-password' }) }),
      foot: btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + btnHTML({ kind: 'primary', label: 'Change password', type: 'submit' }),
    })}</form>`,
  });
});
onForm('change-pw', f => {
  const cur = f.elements.current.value, next = f.elements.next.value, conf = f.elements.confirm.value;
  if (!cur) { fieldError(f, 'cpCur', 'Enter your current password.'); return; }
  if (next.length < 6) { fieldError(f, 'cpNew', 'Use at least 6 characters.'); return; }
  if (next !== conf) { fieldError(f, 'cpConf', 'The two new passwords don’t match.'); return; }
  changePassword(cur, next).then(() => { closeAll(); toast('Password changed', { icon: 'key' }); }, e => {
    if (e && (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential')) fieldError(f, 'cpCur', 'That isn’t your current password.');
    else toast('Couldn’t change the password. Check your connection, then try again.', { icon: 'alert', tone: 'warn' });
  });
});

/* ---------- Install as an app ---------- */
/* Browsers offer the install once; keep the offer and use it from the Account page. */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); UI.installPrompt = e; });
window.addEventListener('appinstalled', () => { UI.installPrompt = null; toast(`${APP_NAME} is installed`, { icon: 'check' }); });
on('install', () => {
  if (UI.installPrompt) { UI.installPrompt.prompt(); UI.installPrompt = null; return; }
  layer({
    label: `Install ${APP_NAME}`,
    html: dialogHTML({
      title: `Install ${APP_NAME}`, text: 'Open it from your home screen or dock, on its own, like a native app. Works without a connection for the screens you’ve seen.',
      body: `<ol class="install-steps">
        <li><span class="n">1</span><span><b>On a Mac or Windows computer</b><br>In Chrome or Edge, click the install icon at the right of the address bar, then Install.</span></li>
        <li><span class="n">2</span><span><b>On an iPhone</b><br>In Safari, tap Share, then Add to Home Screen.</span></li>
        <li><span class="n">3</span><span><b>On an Android phone</b><br>In Chrome, open the menu and tap Install app.</span></li>
      </ol>`,
      foot: btnHTML({ kind: 'primary', label: 'Got it', act: 'close' }),
    }),
  });
});
