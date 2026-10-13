/* Share a link (P5, admin only) and Access (P6, admin only). Passwords are in the restricted-gate
   task. Both write the same fields the old app reads: `shared` on each item, and folder_access. */
'use strict';

/* ---------- Share a link ---------- */
const shareKey = (kind, id) => ({ kind, id, col: kind === 'a' ? 'folders' : kind === 'm' ? 'moms' : 'docs' });
/* The address people will open (plan 2.6: share links are written as #/s/a|m|f/:id). */
const shareUrl = (kind, id) => `${location.origin}${location.pathname}#/s/${kind === 'a' ? 'a' : kind === 'm' ? 'm' : 'f'}/${encodeURIComponent(id)}`;
function shareDialog(kind, id) {
  const it = kind === 'a' ? gf(id) : kind === 'm' ? mom(id) : D.find(d => d.id === id);
  if (!it) return;
  const on = it.shared === true;
  const url = shareUrl(kind, id);
  const what = kind === 'a'
    ? ['The area and everything inside it, including sub-areas, MoMs and files.', 'Nothing outside the area. Visitors can read only.']
    : kind === 'm'
      ? ['The MoM’s title, date, tags and full body.', 'Not the area it lives in, or any other MoM.']
      : ['The file’s name and note, and open or download it.', it.pw ? 'It is password-restricted, so visitors enter the password first.' : 'Not the area it lives in.'];
  layer({
    label: 'Share a link',
    html: `<div class="dlg-head"><div class="tt2"><h2>Share a link</h2><p>Anyone with the link can open this without an account.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <label class="check-row share-toggle"><input type="checkbox" id="shOn" data-change="share-toggle" data-kind="${esc(kind)}" data-id="${esc(id)}" ${on ? 'checked' : ''}> Link is on</label>
      <div class="field"><label class="lab" for="shUrl">Link</label><div class="share-link"><input class="input" id="shUrl" readonly value="${esc(url)}"><button type="button" class="btn btn-soft" data-act="copy-share" data-url="${esc(url)}">${ic('copy', 'sm')}Copy</button></div></div>
      <ul class="explain" aria-label="What this link exposes">${what.map(w => `<li>${ic('eye', 'sm')}<span>${esc(w)}</span></li>`).join('')}<li>${ic('info', 'sm')}<span>Turning the link off stops it working straight away.</span></li></ul>
      <div class="dlg-foot">${btnHTML({ kind: 'primary', label: 'Done', act: 'close' })}</div>`,
  });
}
on('share', d => { if (!isAdmin()) { toast('Only admins can share links.', { icon: 'alert', tone: 'warn' }); return; } shareDialog(d.kind, d.id); });
on('copy-share', d => {
  const done = () => toast('Link copied', { icon: 'copy' });
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d.url).then(done, () => toast('Couldn’t copy. Select the link and copy it by hand.', { icon: 'alert', tone: 'warn' }));
  else toast('Couldn’t copy. Select the link and copy it by hand.', { icon: 'alert', tone: 'warn' });
});
onInput('share-toggle', el => {
  const on = !!el.checked, k = shareKey(el.dataset.kind, el.dataset.id);
  const write = setShared(k.kind, k.id, on);
  // Offline, the change reaches the server (and so the link) only when the connection is back.
  const later = syncState() === 'offline';
  toast(on ? (later ? 'Link turned on. It starts working once you’re back online.' : 'Link is on. Anyone with it can open it.')
    : (later ? 'Link turned off. It stops working once you’re back online.' : 'Link turned off. It stops working straight away.'), { icon: on ? 'share' : 'lock', tone: on ? '' : 'warn' });
  write.then(() => {}, () => { el.checked = !on; toast('Couldn’t change the link. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }); });
});

/* ---------- Access: who can see an area (P6) ---------- */
/* Members who can be granted: everyone except admins, who always see everything. */
const grantable = () => WORKSPACE_USERS.filter(u => u.uid && u.role !== 'admin');
function accessDialog(areaId) {
  const a = area(areaId); if (!a) return;
  const grants = FA.filter(g => g.folderId === a.id);
  const granted = new Set(grants.map(g => g.uid));
  const others = grantable().filter(u => !granted.has(u.uid));
  const who = u => esc(u.displayName || u.email || 'Member');
  const rows = grants.length
    ? grants.map(g => `<div class="row access-row"><span class="who">${esc(firstWord(g.displayName || g.email).charAt(0).toUpperCase() || '?')}</span><span class="mid"><span class="t">${who(g)}</span><span class="p">Can see ${esc(a.name)} and everything inside it</span></span>${btnHTML({ kind: 'quiet-danger', sm: true, label: 'Revoke', act: 'revoke-access', data: { id: g.id, name: g.displayName || g.email || 'member' } })}</div>`).join('')
    : `<div class="noresult"><b>Only admins can see this</b>No members have been granted access yet.</div>`;
  layer({
    label: 'Access',
    html: `<div class="dlg-head"><div class="tt2"><h2>Who can see ${esc(a.name)}</h2><p>Admins always see everything. Members see only the areas granted to them, and everything inside those.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="list access-list">${rows}</div>
      ${others.length
        ? `<form data-form="grant" data-area="${esc(a.id)}" novalidate><div class="field" id="grantSel-field"><label class="lab" for="grantSel">Grant access to</label><select class="select" id="grantSel" name="uid">${others.map(u => `<option value="${esc(u.uid)}">${who(u)}</option>`).join('')}</select></div><div class="dlg-foot">${btnHTML({ kind: 'primary', label: 'Grant access', icon: 'users', type: 'submit' })}</div></form>`
        : `<p class="hint">${ic('info', 'sm')}Every member already has access, or no other members exist yet.</p><div class="dlg-foot">${btnHTML({ kind: 'primary', label: 'Done', act: 'close' })}</div>`}`,
  });
}
on('access', d => { if (!isAdmin()) { toast('Only admins can change access.', { icon: 'alert', tone: 'warn' }); return; } accessDialog(d.id); });
onForm('grant', f => {
  const uid = f.elements.uid.value, a = f.dataset.area;
  const u = WORKSPACE_USERS.find(x => x.uid === uid); if (!u) return;
  const name = u.displayName || u.email || 'Member';
  afterWrite(grantAccess({ id: newId(), folderId: a, uid: u.uid, email: u.email || '', displayName: name }), [`Access granted to ${name}`, { icon: 'users' }], 'Couldn’t grant access. Check your connection, then try again.');
  closeAll();
});
on('revoke-access', d => {
  afterWrite(revokeAccess(d.id), [`Access removed for ${d.name}`, { icon: 'users' }], 'Couldn’t remove access. Check your connection, then try again.');
  closeAll();
});

/* ---------- Restrict, change or remove a password (P1) ---------- */
/* The password is stored only as a SHA-256 hash (hw). Restricting an area also covers everything
   inside it; a restricted file keeps its name visible but its contents behind the password. */
const pwTarget = (kind, id) => (kind === 'a' ? gf(id) : D.find(d => d.id === id));
const pwStrength = v => (v.length === 0 ? 0 : Math.min(4, 1 + (v.length >= 6) + (v.length >= 10) + (/[A-Z]/.test(v) && /\d|\W/.test(v))));
function passwordDialog(kind, id) {
  const it = pwTarget(kind, id); if (!it) return;
  const name = it.name || 'Untitled', has = !!it.pw;
  layer({
    label: has ? 'Change or remove password' : 'Restrict with a password',
    html: `<form data-form="password" data-kind="${esc(kind)}" data-id="${esc(id)}" novalidate>${dialogHTML({
      title: has ? 'Change or remove password' : 'Restrict with a password',
      text: has ? `${name} is restricted. Enter the current password to change or remove it.` : `Only people who know the password can open ${name}${kind === 'a' ? ', or anything inside it' : ''}.`,
      body: (has ? pwFieldHTML({ id: 'pwCur', label: 'Current password', autocomplete: 'current-password' }) : '')
        + pwFieldHTML({ id: 'pwNew', label: has ? 'New password' : 'Password', note: has ? 'leave blank to remove' : '', hint: 'At least 6 characters. Stored only as a hash.', meter: true })
        + pwFieldHTML({ id: 'pwConf', label: 'Type it again' }),
      foot: btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + btnHTML({ kind: 'primary', label: has ? 'Save' : 'Restrict', type: 'submit' }),
    })}</form>`,
  });
  const n = $('#pwNew'); if (n) n.setAttribute('data-input', 'pw-meter');
}
onInput('pw-meter', el => { const i = el.closest('.field').querySelector('.pw-meter i'); if (i) i.className = 's' + pwStrength(el.value); });
/* Areas: admins only. Files: anyone who can edit them (a final file only by an admin; readOnly() already says so). */
const canChangePassword = (kind, it) => (kind === 'a' ? isAdmin() : !readOnly(it));
on('restrict', d => {
  const it = pwTarget(d.kind, d.id); if (!it) return;
  if (!canChangePassword(d.kind, it)) { toast(d.kind === 'a' ? 'Only admins can restrict areas.' : 'This file is marked final. Only an admin can change it.', { icon: 'alert', tone: 'warn' }); return; }
  passwordDialog(d.kind, d.id);
});
on('unrestrict', d => ACT.restrict(d));
onForm('password', async f => {
  const { kind, id } = f.dataset, it = pwTarget(kind, id); if (!it) return;
  const has = !!it.pw, cur = has ? f.elements.pwCur.value : '', pw = f.elements.pwNew.value, conf = f.elements.pwConf.value;
  if (has && !(cur && (await hw(cur)) === it.pw)) { fieldError(f, 'pwCur', 'That isn’t the current password.'); f.elements.pwCur.value = ''; f.elements.pwCur.focus(); return; }
  if (has && !pw) {   // blank new password: remove it
    closeAll(); (kind === 'a' ? UF : UD).delete(id);
    afterWrite(setPassword(kind, id, null), ['Password removed', { icon: 'unlock' }], 'Couldn’t save the password. Check your connection, then try again.');
    return;
  }
  if (pw.length < 6) { fieldError(f, 'pwNew', 'Use at least 6 characters.'); f.elements.pwNew.focus(); return; }
  if (pw !== conf) { fieldError(f, 'pwConf', 'The two passwords don’t match.'); f.elements.pwConf.focus(); return; }
  const hash = await hw(pw);
  closeAll(); (kind === 'a' ? UF : UD).delete(id);   // a changed or new password closes it for this session, as the design shows
  afterWrite(setPassword(kind, id, hash), [has ? 'Password changed' : 'Restricted with a password', { icon: 'lock' }], 'Couldn’t save the password. Check your connection, then try again.');
});
