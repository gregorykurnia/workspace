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

/* ---------- Guest views (V1–V4): shared links, no account, read only ---------- */
/* What a guest may see comes from the data layer (shareRootOf, visitorCanMom, visitorCanFile,
   visitorLockedArea, visitorGate). Whoever opens a share address sees exactly this, signed in or
   not, so a colleague checking a link sees what a guest would. */
const guestPage = inner => visitorHeadHTML() + inner;
const guestUnavailable = () => guestPage(unavailableHTML());
const guestAddress = (kind, id) => `#/s/${kind}/${encodeURIComponent(id)}`;
/* A link inside a note to another MoM: opens it when the guest may see it, else plain text. */
const guestMomHref = id => { const m = mom(id); return m && visitorCanMom(m) ? guestAddress('m', id) : ''; };
/* A restricted area on the way, shown as the password gate. */
const guestAreaGate = (a, targetName = '') => guestPage(`<div class="vpage">${lockedGateHTML({ id: a.id, name: a.name, targetName }).replace('<div class="page">', '<div>')}</div>`);

VIEWS.shared = {
  html(r) {
    if (sessionRole() === 'signedout') return guestUnavailable();   // only reached when the anonymous sign-in failed
    const kind = r.kind, id = r.id;
    Store.visitRoot = null;
    document.title = APP_NAME;
    if (!id || !['a', 'm', 'f'].includes(kind)) return guestUnavailable();
    if (kind === 'a') return guestAreaHTML(id);
    if (kind === 'm') return guestMomHTML(id);
    return guestFileHTML(id);
  },
  mount(r, el) {
    if (r.kind === 'm') fillGuestMom(r.id, el);
    if (r.kind === 'f') { const i = $('#visPw', el); if (i) requestAnimationFrame(() => i.focus()); }   // after the page itself takes focus
  },
};
function guestAreaHTML(id) {
  const a = area(id), root = a && shareRootOf(id);
  if (!root) return guestUnavailable();
  Store.visitRoot = root.id;
  document.title = `${a.name} — ${APP_NAME}`;
  const gate = visitorLockedArea(id);
  if (gate) return guestAreaGate(gate);
  const chain = areaChain(id), path = chain.slice(Math.max(0, chain.findIndex(x => x.id === root.id)));
  const moms = momsOf(id).filter(visitorCanMom).sort((x, y) => (y.date || 0) - (x.date || 0));
  const files = docsOf(id).filter(visitorCanFile).sort((x, y) => (y.added || 0) - (x.added || 0));
  const subs = kids(id).filter(s => visitorCanArea(s.id) && !visitorLockedArea(s.id)).sort((x, y) => (x.name || '').localeCompare(y.name || '', undefined, { sensitivity: 'base' }));
  const sep = `<span class="crumb-sep" aria-hidden="true">${ic('chev-r', 'sm')}</span>`;
  const crumbs = path.length > 1 ? `<nav class="crumbs" aria-label="Where you are">${path.map((x, i) => `${i ? sep : ''}<a class="crumb" href="${guestAddress('a', x.id)}"${x.id === id ? ' aria-current="page"' : ''}>${emojiLead(x)}${esc(x.name)}</a>`).join('')}</nav>` : '';
  const momCard = m => `<div class="cw"><a class="mcard" href="${guestAddress('m', m.id)}"><span class="d">${ic('calendar', 'sm')}${esc(m.date ? relDate(isoOf(m.date)) : '')}</span><span class="t">${esc(m.title || 'Untitled meeting')}</span><span class="s">${esc(notePreview(m.content, m.id))}</span>${(m.tags || []).length ? `<span class="tags">${m.tags.map(tagHTML).join('')}</span>` : ''}</a></div>`;
  const fileTile = f => {
    const k = KINDS[docKind(f)], locked = !!f.pw && !UD.has(f.id), thumb = docKind(f) === 'image' ? thumbUrl(f) : '';
    return `<a class="ftile" href="${guestAddress('f', f.id)}" aria-label="${esc(f.name || 'Untitled file')}, ${k.label}"><span class="thumb ${locked ? '' : k.tile}">${thumb && !locked ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : ''}${locked ? `<span class="lockbig">${ic('lock', 'xl')}</span>` : `<span class="big-ic">${ic(k.icon, 'lg')}</span>`}<span class="ext">${k.ext}</span></span><span class="fbody"><span class="t">${esc(f.name || 'Untitled file')}</span><span class="p">${locked ? 'Password needed' : esc(f.note || k.label)}</span></span></a>`;
  };
  const section = (sid, title, count, body) => `<section class="section" aria-labelledby="${sid}"><div class="section-head"><h2 class="h2" id="${sid}">${title}${count ? ` <span class="count">${count}</span>` : ''}</h2></div>${body}</section>`;
  const nothing = !moms.length && !files.length && !subs.length;
  return guestPage(`<div class="vpage">
    ${crumbs}
    <div class="ahead"><span class="blob ${tintOf(a)}">${esc(areaEmoji(a))}</span><div class="ttl"><p class="eyebrow">Shared area</p><h1 class="h-page vtitle">${esc(a.name)}</h1><div class="meta"><span>${plural(moms.length, 'MoM')}</span><span class="sep"></span><span>${plural(files.length, 'file')}</span></div></div></div>
    ${subs.length ? section('vsubs', 'Sub-areas', 0, `<div class="subgrid">${subs.map(s => `<a class="subcard" href="${guestAddress('a', s.id)}"><span class="blob ${tintOf(s)}">${esc(areaEmoji(s))}</span><span><b>${esc(s.name)}</b><small>${plural(momsOf(s.id).filter(visitorCanMom).length, 'MoM')}</small></span></a>`).join('')}</div>`) : ''}
    ${moms.length ? section('vmoms', 'Meeting notes', moms.length, `<div class="cards">${moms.map(momCard).join('')}</div>`) : ''}
    ${files.length ? section('vfiles', 'Files and links', files.length, `<div class="ftiles">${files.map(fileTile).join('')}</div>`) : ''}
    ${nothing ? `<div class="vempty">${emptyHTML({ icon: 'doc', title: 'Nothing shared inside yet', text: 'The owner hasn’t added anything to this area yet.' })}</div>` : ''}
    <p class="hint">${ic('info', 'sm')}You can read this area and what’s inside it. Nothing outside it is shown.</p>
  </div>`);
}
function guestMomHTML(id) {
  const m = mom(id);
  if (!m || !visitorCanMom(m)) return guestUnavailable();
  const gate = visitorGate('m', m);
  if (gate && gate.area) return guestAreaGate(gate.area, m.title || 'Untitled meeting');
  Store.visitRoot = (shareRootOf(m.folderId) || {}).id || null;
  document.title = `${m.title || 'Untitled meeting'} — ${APP_NAME}`;
  const a = visitorCanArea(m.folderId) ? area(m.folderId) : null;   // the area is named only when the guest can see it
  const eyebrow = [m.date ? fmtDate(isoOf(m.date)) : '', a ? a.name : ''].filter(Boolean).join(' · ');
  const body = isDeltaContent(m.content) ? '' : safeNoteHTML(m.content, { momHref: guestMomHref });   // an old Quill note is converted on mount
  return guestPage(`<div class="vpage"><article class="vcard">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1 class="h-page">${esc(m.title || 'Untitled meeting')}</h1>
    ${(m.tags || []).length ? `<div class="tags vtags">${m.tags.map(tagHTML).join('')}</div>` : ''}
    <div class="ed-body vbody" id="guestBody">${body || (isDeltaContent(m.content) ? '' : '<p class="muted">No notes were written for this meeting.</p>')}</div>
  </article></div>`);
}
/* An old Quill note: converted on screen (it is never saved), then filtered like any other. */
function fillGuestMom(id, el) {
  const m = mom(id), box = $('#guestBody', el);
  if (!m || !box || !isDeltaContent(m.content)) return;
  const content = m.content;
  toEditorHTML(content).then(r => {
    if ($('#guestBody') !== box) return;   // the guest has moved on
    box.innerHTML = safeNoteHTML(r.html, { momHref: guestMomHref }) || '<p class="muted">No notes were written for this meeting.</p>';
  }, () => {
    if ($('#guestBody') !== box) return;
    box.innerHTML = `<div class="notice warn">${ic('alert')}<div><b>This note couldn’t be opened right now</b><br>Check your connection, then <button type="button" class="link-btn" data-act="reload-guest">try again</button>.</div></div>`;
  });
}
on('reload-guest', () => render());
function guestFileHTML(id) {
  const f = D.find(d => d.id === id);
  if (!f || !visitorCanFile(f)) return guestUnavailable();
  const gate = visitorGate('f', f), kind = docKind(f), k = KINDS[kind];
  if (gate && gate.area) return guestAreaGate(gate.area, f.name || 'Untitled file');
  Store.visitRoot = (shareRootOf(f.folderId) || {}).id || null;
  const name = f.name || 'Untitled file';
  document.title = `${name} — ${APP_NAME}`;
  const tile = `<span class="ktile ktile-lg ${k.tile}">${ic(k.icon, 'lg')}</span>`;
  if (gate && gate.file) {
    return guestPage(`<div class="vpage"><form class="vcard vcard-narrow" data-form="vis-unlock" data-id="${esc(f.id)}" novalidate>
      ${tile}
      <h1 class="h-page">${esc(name)}</h1>
      <p class="muted">This file is password-protected. Enter the password to open or download it.</p>
      ${fieldHTML({ id: 'visPw', label: 'Password', control: inputHTML({ id: 'visPw', name: 'password', type: 'password', autocomplete: 'off' }) })}
      ${btnHTML({ kind: 'primary', label: 'Open file', type: 'submit' })}
    </form></div>`);
  }
  const a = visitorCanArea(f.folderId) ? area(f.folderId) : null;
  const sub = [k.label, f.size ? fmtSize(f.size) : '', a ? `shared from ${a.name}` : ''].filter(Boolean).join(' · ');
  const preview = kind === 'image' && f.url ? `<img class="vimg" src="${esc(f.url)}" alt="${esc(name)}">` : '';
  return guestPage(`<div class="vpage"><article class="vcard">
    ${tile}
    <h1 class="h-page">${esc(name)}</h1>
    <p class="muted">${esc(sub)}</p>
    ${f.note ? `<p class="vnote">${esc(f.note)}</p>` : ''}
    ${preview}
    <div class="aactions">${btnHTML({ kind: 'primary', label: 'Open', icon: 'external', act: 'visitor-open', data: { id: f.id } })}${btnHTML({ kind: 'soft', label: 'Download', icon: 'download', act: 'visitor-download', data: { id: f.id } })}</div>
  </article></div>`);
}
/* Opening and downloading use the file's own address; the gate was already passed to see this page. */
function guestFile(d) {
  const f = D.find(x => x.id === d.id);
  return f && visitorCanFile(f) && !visitorGate('f', f) && f.url ? f : null;
}
on('visitor-open', d => {
  const f = guestFile(d); if (!f) return;
  window.open(f.url, '_blank', 'noopener');
  toast(`“${f.name || 'File'}” opened in a new tab`, { icon: 'external' });
});
on('visitor-download', d => { const f = guestFile(d); if (f) downloadFile(f); });
onForm('vis-unlock', async f => {
  const item = D.find(x => x.id === f.dataset.id);
  const pw = (f.elements.password && f.elements.password.value) || '';
  if (!item || !visitorCanFile(item)) return;
  if (pw && (await hw(pw)) === item.pw) { UD.add(item.id); render(); return; }
  const field = f.querySelector('.field'), input = f.elements.password;
  if (field) {
    field.classList.add('err');
    input.setAttribute('aria-invalid', 'true');
    if (!field.querySelector('.ferr')) field.insertAdjacentHTML('beforeend', `<span class="ferr" role="alert" id="${input.id}-err">${ic('alert', 'sm')}That password isn’t right. Try again.</span>`);
    input.setAttribute('aria-describedby', input.id + '-err');
    input.value = ''; input.focus();
  }
});
