/* Account (U3), install as an app (A2), and the visitor side of shared
   links (V1–V4). Visitors have no account: they only see what a link opens. */
'use strict';

/* ---------- Change password (U3) ---------- */
on('change-password', () => {
  layer({
    label: 'Change password',
    html: `<form data-form="change-pw" novalidate><div class="dlg-head"><div class="tt2"><h2>Change password</h2><p>Use at least 6 characters.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="field" id="cpCur"><label class="lab" for="cpCurIn">Current password</label><input class="input" id="cpCurIn" name="current" type="password" autocomplete="current-password"><span class="ferr" role="alert">That isn’t your current password.</span></div>
      <div class="field" id="cpNew"><label class="lab" for="cpNewIn">New password</label><input class="input" id="cpNewIn" name="next" type="password" autocomplete="new-password"><span class="ferr" role="alert">Use at least 6 characters.</span></div>
      <div class="field" id="cpConf"><label class="lab" for="cpConfIn">Confirm new password</label><input class="input" id="cpConfIn" name="confirm" type="password" autocomplete="new-password"><span class="ferr" role="alert">The two new passwords don’t match.</span></div>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Change password</button></div></form>`,
  });
});
onForm('change-pw', (f) => {
  const cur = f.elements.current.value, next = f.elements.next.value, conf = f.elements.confirm.value;
  ['#cpCur', '#cpNew', '#cpConf'].forEach(s => $(s).classList.remove('err'));
  const wrongCur = cur !== 'daybook' || S.state === 'failure';
  if (wrongCur) { $('#cpCur').classList.add('err'); f.elements.current.focus(); return; }
  if (next.length < 6) { $('#cpNew').classList.add('err'); f.elements.next.focus(); return; }
  if (next !== conf) { $('#cpConf').classList.add('err'); f.elements.confirm.focus(); return; }
  closeAll();
  toast('Password changed', { icon: 'key' });
});

/* ---------- Install as an app (A2) ---------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
on('install', () => {
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; return; }
  layer({
    label: 'Install Daybook',
    html: `<div class="dlg-head"><div class="tt2"><h2>Install Daybook</h2><p>Open it from your home screen or dock, on its own, like a native app. Works without a connection for the screens you’ve seen.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <ol class="install-steps">
        <li><span class="n">1</span><span><b>On a Mac or Windows computer</b><br>In Chrome or Edge, click the install icon at the right of the address bar, then Install.</span></li>
        <li><span class="n">2</span><span><b>On an iPhone</b><br>In Safari, tap Share, then Add to Home Screen.</span></li>
        <li><span class="n">3</span><span><b>On an Android phone</b><br>In Chrome, open the menu and tap Install app.</span></li>
      </ol>
      <div class="dlg-foot"><button class="btn btn-primary" data-act="close">Got it</button></div>`,
  });
});
window.addEventListener('appinstalled', () => toast('Daybook is installed', { icon: 'check' }));

/* ---------- Visitor views (V1–V4) ---------- */
/* Nearest ancestor-or-self that has a link turned on. Areas inside it are open too. */
function sharedRootOf(areaId) {
  for (const a of chainOf(areaId).reverse()) if (DB.shares['a:' + a.id]) return a;
  return null;
}
const visitorCanArea = id => !!sharedRootOf(id);
/* An item's own link wins when it has been set (on or off). Otherwise it is open
   through a shared area above it. */
const visitorCanMom = m => ('m:' + m.id in DB.shares) ? !!DB.shares['m:' + m.id] : visitorCanArea(m.area);
const visitorCanFile = f => ('f:' + f.id in DB.shares) ? !!DB.shares['f:' + f.id] : visitorCanArea(f.area);
const unavailable = () => `<div class="vpage"><div class="vcard" style="text-align:center;padding:48px 28px"><div class="empty small" style="padding:0"><div class="art" style="margin:0 auto 18px">${ic('lock')}</div><h3 style="font-size:22px">This link is no longer available</h3><p style="margin:10px auto 0">The link may have been turned off, or the item was removed. Ask the person who shared it for a new link.</p></div></div></div>`;
const vHead = (right = '') => `<header class="vhead"><span class="brand-mark">${ic('book')}</span><span class="who-line">Daybook</span><span class="spacer"></span>${right}<span class="readonly-pill">${ic('eye', 'sm')}Read only</span></header>`;

VIEWS.shared = {
  html(r) {
    if (r.kind === 'a') return sharedAreaHTML(r.id);
    if (r.kind === 'm') return sharedMomHTML(r.id);
    if (r.kind === 'f') return sharedFileHTML(r.id);
    return vHead() + unavailable();
  },
  mount(r) {
    if (r.kind === 'f') { const f = file(r.id); if (f && f.restricted && !S.unlocked.has('f:' + f.id)) { const i = $('#visPw'); i && i.focus(); } }
  },
};
function sharedAreaHTML(id) {
  const a = area(id);
  if (!a || !visitorCanArea(id)) return vHead() + unavailable();
  const root = sharedRootOf(id);
  const path = chainOf(id).slice(chainOf(id).findIndex(x => x.id === root.id));
  const lock = lockedArea(id);
  if (lock) return vHead() + `<div class="vpage">${lockedGateHTML(lock, null).replace('<div class="page">', '<div>')}</div>`;
  const moms = momsOf(id).filter(m => !hiddenItem('m', m) && visitorCanMom(m));
  const files = filesOf(id).filter(f => !hiddenItem('f', f) && visitorCanFile(f));
  const subs = kidsOf(id).filter(s => visitorCanArea(s.id) && !lockedArea(s.id));
  return vHead() + `<div class="vpage">
    <nav class="crumbs" aria-label="Where you are">${path.map((x, i) => `${i ? `<span class="crumb-sep">${ic('chev-r', 'sm')}</span>` : ''}<a class="crumb" href="#/s/a/${x.id}" ${x.id === id ? 'aria-current="page"' : ''}>${x.emoji} ${esc(x.name)}</a>`).join('')}</nav>
    <div class="ahead"><span class="blob ${a.tint}">${a.emoji}</span><div class="ttl"><p class="eyebrow">Shared area</p><h1 class="h-page" style="margin-top:4px">${esc(a.name)}</h1><div class="meta"><span>${plural(moms.length, 'MoM')}</span><span class="sep"></span><span>${plural(files.length, 'file')}</span></div></div></div>
    ${subs.length ? `<section class="section" aria-labelledby="vsubs"><div class="section-head"><h2 class="h2" id="vsubs">Sub-areas</h2></div><div class="subgrid">${subs.map(s => `<a class="subcard" href="#/s/a/${s.id}"><span class="blob ${s.tint}">${s.emoji}</span><span><b>${esc(s.name)}</b><small>${plural(momsOf(s.id).length, 'MoM')}</small></span></a>`).join('')}</div></section>` : ''}
    ${moms.length ? `<section class="section" aria-labelledby="vmoms"><div class="section-head"><h2 class="h2" id="vmoms">Meeting notes <span class="count">${moms.length}</span></h2></div><div class="cards">${moms.map(m => `<div class="cw"><a class="mcard" href="#/s/m/${m.id}"><span class="d">${ic('calendar', 'sm')}${fmtDate(m.date)}</span><span class="t">${esc(m.title)}</span><span class="s">${esc(stripTags(m.body).slice(0, 140))}</span><span class="tags">${m.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</span></a></div>`).join('')}</div></section>` : ''}
    ${files.length ? `<section class="section" aria-labelledby="vfiles"><div class="section-head"><h2 class="h2" id="vfiles">Files and links <span class="count">${files.length}</span></h2></div><div class="ftiles">${files.map(f => `<a class="ftile" href="#/s/f/${f.id}"><span class="thumb ${KINDS[f.kind].tile}">${f.thumb && !f.restricted ? `<img src="${f.thumb}" alt="">` : `<span class="big-ic">${ic(KINDS[f.kind].icon, 'lg')}</span>`}<span class="ext">${KINDS[f.kind].ext}</span></span><span class="fbody"><span class="t">${esc(f.name)}</span><span class="p">${f.restricted ? 'Password needed' : esc(f.note || KINDS[f.kind].label)}</span></span></a>`).join('')}</div></section>` : ''}
    ${!moms.length && !files.length && !subs.length ? `<div class="empty" style="margin-top:28px"><div class="art">${ic('doc')}</div><h3>Nothing shared inside yet</h3><p>The owner hasn’t added anything to this area yet.</p></div>` : ''}
    <p class="hint">${ic('info', 'sm')}You can read this area and what’s inside it. Nothing outside it is shown.</p>
  </div>`;
}
function sharedMomHTML(id) {
  const m = mom(id);
  if (!m || !visitorCanMom(m)) return vHead() + unavailable();
  return vHead() + `<div class="vpage"><article class="vcard">
    <p class="eyebrow">${fmtDate(m.date)} · ${esc(area(m.area).name)}</p>
    <h1 class="h-page" style="margin-top:8px">${esc(m.title)}</h1>
    ${m.tags.length ? `<div class="tags" style="margin-top:14px">${m.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>` : ''}
    <div class="ed-body" style="margin-top:22px;caret-color:transparent">${m.body || '<p class="muted">No notes were written for this meeting.</p>'}</div>
  </article></div>`;
}
function sharedFileHTML(id) {
  const f = file(id);
  if (!f || !visitorCanFile(f)) return vHead() + unavailable();
  const k = KINDS[f.kind];
  const needPw = f.restricted && !S.unlocked.has('f:' + f.id);
  if (needPw) {
    return vHead() + `<div class="vpage"><form class="vcard" data-form="vis-unlock" data-id="${f.id}" novalidate style="max-width:520px;margin:0 auto">
      <span class="ktile ${k.tile}" style="width:56px;height:56px;border-radius:18px">${ic(k.icon, 'lg')}</span>
      <h1 class="h-page" style="margin-top:16px">${esc(f.name)}</h1>
      <p class="muted" style="margin-top:8px">This file is password-protected. Enter the password to open or download it.</p>
      <div class="field" id="visPwF" style="margin-top:20px"><label class="lab" for="visPw">Password</label><input class="input" id="visPw" name="password" type="password" autocomplete="off"><span class="ferr" role="alert">That password isn’t right. Try again.</span></div>
      <button class="btn btn-primary" type="submit" style="width:100%">Open file</button></form></div>`;
  }
  return vHead() + `<div class="vpage"><article class="vcard">
    <span class="ktile ${k.tile}" style="width:56px;height:56px;border-radius:18px">${ic(k.icon, 'lg')}</span>
    <h1 class="h-page" style="margin-top:16px">${esc(f.name)}</h1>
    <p class="muted" style="margin-top:8px">${k.label}${f.size ? ' · ' + fmtSize(f.size) : ''} · shared from ${esc(area(f.area).name)}</p>
    ${f.note ? `<p style="margin-top:14px;color:var(--text-2)">${esc(f.note)}</p>` : ''}
    ${f.thumb ? `<img src="${f.thumb}" alt="${esc(f.name)}" style="margin-top:20px;width:100%;border-radius:var(--r-lg)">` : ''}
    <div class="aactions" style="margin-top:22px"><button class="btn btn-primary" data-act="visitor-open" data-id="${f.id}">${ic('external', 'sm')}Open</button><button class="btn btn-soft" data-act="download" data-id="${f.id}">${ic('download', 'sm')}Download</button></div>
  </article></div>`;
}
onForm('vis-unlock', (f) => {
  const item = file(f.dataset.id);
  if (S.state === 'failure' || f.elements.password.value !== SHARE_PASSWORD) {
    $('#visPwF').classList.add('err');
    f.elements.password.value = '';
    f.elements.password.focus();
    return;
  }
  S.unlocked.add('f:' + item.id);
  render();
});
on('visitor-open', (d) => { const f = file(d.id); toast(`Opened “${f.name}” in a new tab`, { icon: 'external' }); });
