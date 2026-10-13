/* Protection and sharing: passwords for areas and files (P1, P2), share
   links (P5), member access (P6), and read-only marking (P7). Passwords
   are stored only as a hash. This prototype's hash is a stand-in. */
'use strict';

function pwHash(s) {
  let h = 5381;
  for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return 'h' + h.toString(16);
}
const itemOf = (kind, id) => (kind === 'a' ? area(id) : kind === 'm' ? mom(id) : file(id));
const keyOf = (kind, id) => (kind === 'a' ? 'a:' : 'f:') + id;
const checkPw = (item, pw) => (item.pwHash ? item.pwHash === pwHash(pw) : pw === SHARE_PASSWORD);

/* ---------- Opening restricted areas and files (P2) ---------- */
onForm('unlock', (f) => {
  const { kind, id } = f.dataset;
  const item = kind === 'a' ? area(id) : file(id);
  const pw = f.elements.password.value;
  const wrong = S.state === 'failure' || !checkPw(item, pw);
  if (wrong) {
    const field = f.matches('.field') ? f : f.querySelector('.field');
    if (field) field.classList.add('err');
    const msg = f.querySelector('.ferr'); if (msg) msg.textContent = 'That password isn’t right. Try again.';
    f.elements.password.value = '';
    f.elements.password.focus();
    return;
  }
  S.unlocked.add(keyOf(kind, id));
  closeAll();
  toast(kind === 'a' ? `${item.name} is open for this session` : `Unlocked “${item.name}”`, { icon: 'unlock' });
  render();
  if (kind === 'f') { const r = route(); if (r.name === 'area' || r.name === 'mom') { /* stays where it is */ } }
  if (kind === 'f') openFile(id);
});

/* ---------- Set, change or remove a password (P1) ---------- */
function passwordDialog(kind, id) {
  const item = itemOf(kind, id);
  const name = kind === 'a' ? item.name : item.name || item.title;
  const hasPw = !!item.restricted;
  layer({
    label: hasPw ? 'Change or remove password' : 'Restrict with a password',
    html: `<form data-form="password" data-kind="${kind}" data-id="${id}" novalidate><div class="dlg-head"><div class="tt2"><h2>${hasPw ? 'Change or remove password' : 'Restrict with a password'}</h2><p>${hasPw ? `${esc(name)} is restricted. Enter the current password to change or remove it.` : `Only people who know the password can open ${esc(name)}${kind === 'a' ? ', or anything inside it' : ''}.`}</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      ${hasPw ? `<div class="field" id="fCur"><label class="lab" for="pwCur">Current password</label><input class="input" id="pwCur" name="current" type="password" autocomplete="current-password"><span class="ferr" role="alert">That password isn’t right.</span></div>` : ''}
      <div class="field" id="fNew"><label class="lab" for="pwNew">${hasPw ? 'New password' : 'Password'} ${hasPw ? '<em>leave blank to remove</em>' : ''}</label><input class="input" id="pwNew" name="password" type="password" autocomplete="new-password" aria-describedby="pwHint"><div class="pw-meter" aria-hidden="true"><i id="pwBar"></i></div><div class="hcopy" id="pwHint">At least 6 characters. Stored only as a hash.</div><span class="ferr" role="alert">Use at least 6 characters.</span></div>
      <div class="field" id="fConf"><label class="lab" for="pwConf">Type it again</label><input class="input" id="pwConf" name="confirm" type="password" autocomplete="new-password"><span class="ferr" role="alert">The two passwords don’t match.</span></div>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">${hasPw ? 'Save' : 'Restrict'}</button></div></form>`,
    onMount(panel) {
      const n = panel.querySelector('#pwNew');
      n.addEventListener('input', () => { const v = n.value.length; panel.querySelector('#pwBar').style.width = Math.min(100, v / 12 * 100) + '%'; });
    },
  });
}
on('restrict', (d) => passwordDialog(d.kind, d.id));
on('unrestrict', (d) => passwordDialog(d.kind, d.id));
onForm('password', (f) => {
  const { kind, id } = f.dataset;
  const item = itemOf(kind, id);
  const hasPw = !!item.restricted;
  const cur = hasPw ? f.elements.current.value : '';
  const pw = f.elements.password.value;
  const conf = f.elements.confirm ? f.elements.confirm.value : pw;
  if (hasPw && !checkPw(item, cur) || (hasPw && S.state === 'failure')) { $('#fCur').classList.add('err'); f.elements.current.focus(); return; }
  if (hasPw && !pw) { // remove the password
    item.restricted = false; delete item.pwHash; S.unlocked.delete(keyOf(kind, id));
    closeAll(); toast('Password removed', { icon: 'unlock' }); render(); return;
  }
  if (pw.length < 6) { $('#fNew').classList.add('err'); f.elements.password.focus(); return; }
  if (pw !== conf) { $('#fNew').classList.remove('err'); $('#fConf').classList.add('err'); f.elements.confirm.focus(); return; }
  item.restricted = true; item.pwHash = pwHash(pw);
  S.unlocked.delete(keyOf(kind, id));
  closeAll();
  toast(hasPw ? 'Password changed' : 'Restricted with a password', { icon: 'lock' });
  render();
});

/* ---------- Share links (P5, admin only) ---------- */
function shareDialog(kind, id) {
  const key = (kind === 'a' ? 'a:' : kind === 'm' ? 'm:' : 'f:') + id;
  const item = itemOf(kind, id);
  const on = !!DB.shares[key];
  const url = `daybook.example/s/${kind === 'a' ? 'a' : kind === 'm' ? 'm' : 'f'}/${id}`;
  const what = kind === 'a'
    ? [`The area and everything inside it, including sub-areas, MoMs and files.`, `Nothing outside the area. Visitors can read only.`]
    : kind === 'm'
      ? [`The MoM’s title, date, tags and full body.`, `Not the area it lives in, or any other MoM.`]
      : [`The file’s name and note, and open or download it.`, item.restricted ? `It is password-restricted, so visitors enter the password first.` : `Not the area it lives in.`];
  layer({
    label: 'Share a link',
    html: `<div class="dlg-head"><div class="tt2"><h2>Share a link</h2><p>Anyone with the link can open this without an account.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <label class="check-row" style="min-height:52px;font-weight:700"><input type="checkbox" id="shOn" data-change="share-toggle" data-key="${key}" ${on ? 'checked' : ''}> Link is on</label>
      <div class="field"><label class="lab" for="shUrl">Link</label><div style="display:flex;gap:8px"><input class="input" id="shUrl" readonly value="${url}" style="flex:1"><button class="btn btn-soft" data-act="copy-share" data-url="${url}">${ic('copy', 'sm')}Copy</button></div></div>
      <div class="explain" aria-label="What this link exposes">${what.map(w => `<li>${ic('eye', 'sm')}<span>${w}</span></li>`).join('')}<li>${ic('info', 'sm')}<span>Turning the link off stops it working straight away.</span></li></div>
      <div class="dlg-foot"><button class="btn btn-primary" data-act="close">Done</button></div>`,
  });
}
on('share', (d) => shareDialog(d.kind, d.id));
on('copy-share', (d) => { try { navigator.clipboard && navigator.clipboard.writeText('https://' + d.url); } catch (e) { /* ignore */ } toast('Link copied', { icon: 'copy' }); });
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.change !== 'share-toggle') return;
  DB.shares[el.dataset.key] = el.checked;
  toast(el.checked ? 'Link is on. Anyone with it can open it.' : 'Link turned off. It stops working straight away.', { icon: el.checked ? 'share' : 'lock', tone: el.checked ? '' : 'warn' });
  render();
});

/* ---------- Member access to areas (P6, admin only) ---------- */
function accessDialog(areaId) {
  const a = area(areaId);
  const grants = DB.access[a.id] || [];
  const others = DB.members.filter(m => !grants.includes(m.id));
  const row = m => `<div class="row" style="padding:8px 12px"><span class="who ${m.cls}">${m.ini}</span><span class="mid"><span class="t">${esc(m.name)}</span><span class="p">Can see ${esc(a.name)} and everything inside it</span></span><button class="btn btn-quiet-danger btn-sm" data-act="revoke-access" data-area="${a.id}" data-m="${m.id}">Revoke</button></div>`;
  layer({
    label: 'Access',
    html: `<div class="dlg-head"><div class="tt2"><h2>Who can see ${esc(a.name)}</h2><p>Admins always see everything. Members see only the areas granted to them, and everything inside those.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="list" style="padding:4px;margin-bottom:16px">${grants.length ? grants.map(id => row(DB.members.find(m => m.id === id))).join('') : `<div class="noresult" style="padding:18px"><b>Only admins can see this</b>No members have been granted access yet.</div>`}</div>
      ${others.length ? `<form data-form="grant" data-area="${a.id}" novalidate><div class="field"><label class="lab" for="grantSel">Grant access to</label><select class="select" id="grantSel" name="m">${others.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div><div class="dlg-foot"><button class="btn btn-primary" type="submit">${ic('users', 'sm')}Grant access</button></div></form>` : ''}`,
  });
}
on('access', (d) => accessDialog(d.id));
onForm('grant', (f) => {
  const a = f.dataset.area;
  DB.access[a] = [...(DB.access[a] || []), f.elements.m.value];
  closeAll();
  toast(`Access granted to ${DB.members.find(m => m.id === f.elements.m.value).name}`, { icon: 'users' });
  render();
});
on('revoke-access', (d) => {
  DB.access[d.area] = (DB.access[d.area] || []).filter(id => id !== d.m);
  closeAll();
  const m = DB.members.find(x => x.id === d.m);
  toast(`Access removed for ${m ? m.name : 'member'}`, { icon: 'users' });
  render();
});

/* ---------- Read-only marking (P7, admin only) ---------- */
on('final', (d) => {
  const item = itemOf(d.kind === 'm' ? 'm' : 'f', d.id);
  item.final = !item.final;
  toast(item.final ? 'Marked final. Members can read it but not change it.' : 'Final mark removed', { icon: 'lock' });
  render();
});
