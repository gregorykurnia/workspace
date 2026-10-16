/* Today (F3, F4, F13), All areas (F6, O7) and the rows lists share (Flagged, Recent). Reads
   through the data layer; what each person sees comes from the visibility rules in store.js. */
'use strict';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const todayLine = () => { const d = new Date(); return `${DAYS[d.getDay()]}, ${d.getDate()} ${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

/* A row for a MoM ('m') or file ('f'): shows where it lives. opts.right is extra markup at the end. */
function itemRow(kind, id, opts = {}) {
  if (kind === 'm') {
    const m = mom(id); if (!m) return '';
    const a = area(m.folderId), g = m.momFolderId ? groupName(m.momFolderId) : '';
    return itemRowHTML({ href: '#/mom/' + encodeURIComponent(m.id), icon: 'doc', title: m.title || 'Untitled meeting', flagged: !!m.starred, final: !!m.readOnly, where: [a && a.name, g].filter(Boolean).join(' · '), meta: relDate(isoOf(m.date)), right: opts.right || '' });
  }
  const d = D.find(x => x.id === id); if (!d) return '';
  const k = KINDS[docKind(d)], a = area(d.folderId), g = d.docFolderId ? groupName(d.docFolderId) : '', at = docAddedValue(d), locked = lockedFile(d);
  return itemRowHTML({ href: a ? areaHref(a.id) : '#/areas', act: 'open-file', data: { id: d.id }, tile: k.tile, icon: k.icon, title: d.name || 'Untitled file', flagged: !!d.starred, final: !!d.readOnly, restricted: !!d.pw, where: [k.label, a && a.name, g].filter(Boolean).join(' · '), meta: locked ? 'Locked' : (at ? relDate(isoOf(at)) : ''), right: opts.right || '' });
}
function continueCard([k, id]) {
  if (k === 'm') {
    const m = mom(id), a = area(m.folderId);
    return continueCardHTML({ href: '#/mom/' + encodeURIComponent(m.id), icon: 'doc', title: m.title || 'Untitled meeting', where: `${a ? a.name : ''} · ${relDate(isoOf(m.date))}` });
  }
  const d = D.find(x => x.id === id), a = area(d.folderId), kd = KINDS[docKind(d)];
  return continueCardHTML({ href: a ? areaHref(a.id) : '#/areas', act: 'open-file', data: { id: d.id }, tile: kd.tile, icon: kd.icon, title: d.name || 'Untitled file', where: a ? a.name : '' });
}
/* Admin only: the newest MoMs and files across the workspace. Older items have no author on
   record (open gap G6), so for them only the time shows. */
function recentlyAdded() {
  const mk = (kind, x, at) => ({ kind, id: x.id, at, by: x.createdBy && x.createdBy.name });
  return M.filter(m => !hiddenItem('m', m)).map(m => mk('m', m, Number(m.created) || Number(m.date) || 0))
    .concat(D.filter(d => !hiddenItem('f', d)).map(d => mk('f', d, docAddedValue(d))))
    .filter(x => x.at).sort((a, b) => b.at - a.at).slice(0, 5);
}
const whoHTML = name => `<span class="who">${esc(firstWord(name).charAt(0).toUpperCase() + (String(name).split(/\s+/)[1] || '').charAt(0).toUpperCase())}</span>`;
const addedRight = x => `<span class="row-right">${x.by ? whoHTML(x.by) + esc(x.by) + ' · ' : ''}${esc(relDate(isoOf(x.at)))}</span>`;

/* ---------- Today ---------- */
VIEWS.today = {
  html() {
    const admin = isAdmin();
    if (!admin && !visibleRoots().length) return `<div class="page">${noAccessPartHTML()}</div>`;
    const nothing = !visibleAreas().length;
    const p = createPlace({ name: 'today' });
    const flagged = flaggedItems();
    const recent = recentEntries().map(x => [x.k, x.id]);
    const added = admin ? recentlyAdded() : [];
    const quick = nothing ? quickFirstHTML({}) : `<div class="place-line"><span>Creating in</span>${p ? placeChipHTML(placeName(p)) : ''}</div>
      <div class="quick">
        ${quickTileHTML({ primary: true, icon: 'doc', title: 'New MoM', sub: 'Today’s date, cursor ready', act: 'new-mom', data: { area: p && p.area, group: groupFor(p, 'mom') }, disabled: !p })}
        ${quickTileHTML({ icon: 'upload', title: 'Upload', sub: 'Files and PDFs', act: 'upload', data: { area: p && p.area, group: groupFor(p, 'file') }, disabled: !p })}
        ${quickTileHTML({ icon: 'link', title: 'Save a link', sub: 'Online material', act: 'save-link', data: { area: p && p.area, group: groupFor(p, 'file') }, disabled: !p })}
        ${admin ? quickTileHTML({ icon: 'shelf', title: 'New area', sub: 'Client, team or initiative', act: 'new-area', data: { parent: '' } }) : quickTileHTML({ icon: 'flag', title: 'Flagged', sub: `${flagged.length} important`, href: '#/flagged' })}
      </div>`;
    return `<div class="page">
      <section class="hero" aria-labelledby="hello">
        <p class="eyebrow">${esc(todayLine())}</p>
        <h1 class="h1" id="hello">${greeting()}${firstName() ? ', ' + esc(firstName()) : ''}</h1>
        <p class="hero-sub">${nothing ? 'Nothing here yet. Start with an area, then add your first meeting.' : 'Pick up where you left off, or start the next meeting in one tap.'}</p>
        ${quick}
      </section>
      ${nothing ? '' : `
      ${sectionHTML('cont', 'Continue where you left off', 0, '<a class="link-btn" href="#/recent">See all</a>', recent.length ? `<div class="cont-row">${recent.slice(0, 4).map(continueCard).join('')}</div>` : emptyHTML({ small: true, icon: 'clock', title: 'Nothing yet', text: 'Open a MoM or file and it appears here.' }))}
      ${sectionHTML('flg', 'Flagged', flagged.length, '<a class="link-btn" href="#/flagged">Open flagged</a>', flagged.length ? `<div class="list">${flagged.slice(0, 4).map(([k, id]) => itemRow(k, id)).join('')}</div>` : emptyHTML({ small: true, icon: 'flag', title: 'Nothing flagged', text: 'Flag a MoM or file to keep it close.' }))}
      ${admin ? sectionHTML('adds', 'Recently added across the workspace', 0, '', added.length ? `<div class="list">${added.map(x => itemRow(x.kind, x.id, { right: addedRight(x) })).join('')}</div>` : emptyHTML({ small: true, icon: 'sparkle', title: 'Nothing yet', text: 'New MoMs and files from across the team show here.' })) : ''}`}
    </div>`;
  },
};

/* ---------- All areas: a grid on desktop, the full tree on phone ---------- */
VIEWS.areas = {
  html() {
    const roots = visibleRoots(), total = visibleAreas().length, admin = isAdmin();
    const selectable = UI.selMode && admin;
    const cards = roots.map(a => {
      const locked = !!lockedArea(a.id), c = locked ? null : countsOf(a.id);
      const subs = locked ? [] : kids(a.id).filter(k => canSee(k.id)).map(k => ({ name: k.name, emoji: areaEmoji(k) }));
      return areaCardHTML({ id: a.id, name: a.name, emoji: areaEmoji(a), tint: tintOf(a), moms: c ? c.moms : 0, files: c ? c.files : 0, locked, kids: subs, selectable, selected: UI.sel.has('a:' + a.id) });
    }).join('');
    const empty = admin
      ? emptyHTML({ icon: 'shelf', title: 'No areas yet', text: 'Create an area for a client, a team or an initiative. Everything you write and upload goes inside one.', actions: btnHTML({ kind: 'primary', label: 'New area', icon: 'plus', act: 'new-area' }) })
      : noAccessPartHTML();
    return `<div class="page">
      <div class="page-head"><div class="page-head-main"><p class="eyebrow">Workspace</p><h1 class="h-page">Areas</h1><p class="page-sub">${total ? `${plural(roots.length, 'top-level area')}, each with its own MoMs and files.` : 'Areas hold the MoMs and files for one client, team or initiative.'}</p></div>${admin && total ? `<button type="button" class="btn btn-soft btn-sm" data-act="toggle-select" aria-pressed="${UI.selMode}">${ic('check-square', 'sm')}${UI.selMode ? 'Done selecting' : 'Select'}</button>` : ''}</div>
      ${UI.selMode ? '' : `<div class="phone-only">${total ? treeHTML({ name: 'areas' }, { cls: 'tree-page', roots }) : ''}</div>`}
      <div class="${UI.selMode ? '' : 'desk-only'}">${total ? `<div class="agrid">${cards}${admin ? `<button type="button" class="acard new-card" data-act="new-area" aria-label="New area">${ic('plus')}<span>New area</span></button>` : ''}</div>` : empty}</div>
      <div id="bulkHost">${bulkHTML({ name: 'areas' })}</div>
      <div class="phone-only">${total ? '' : empty}${admin && total ? `<div class="phone-new">${btnHTML({ kind: 'soft', label: 'New area', icon: 'plus', act: 'new-area' })}</div>` : ''}</div>
    </div>`;
  },
};

/* ---------- Flagged, Recent, Deleted ---------- */
const pageHead = (eyebrow, title, sub, right = '') => `<div class="page-head"><div class="page-head-main"><p class="eyebrow">${esc(eyebrow)}</p><h1 class="h-page">${esc(title)}</h1><p class="page-sub">${esc(sub)}</p></div>${right}</div>`;

VIEWS.flagged = {
  html() {
    const items = flaggedItems();
    return `<div class="page">${pageHead('Important', 'Flagged', 'Everything you’ve marked as important, in one place.')}
      ${items.length ? `<div class="list list-spaced">${items.map(([k, id]) => itemRow(k, id, { right: iconBtnHTML({ icon: 'flag-fill', label: 'Unflag', pressed: true, act: 'flag', data: { kind: k, id } }) })).join('')}</div>`
        : emptyHTML({ icon: 'flag', title: 'Nothing flagged yet', text: 'Flag a MoM or file when it matters. It shows up here and on Today.', cls: 'empty-spaced' })}
    </div>`;
  },
};

VIEWS.recent = {
  html() {
    const items = recentEntries().map(x => [x.k, x.id]);
    return `<div class="page">${pageHead('Your work', 'Recent', 'What you opened most recently, wherever it lives.')}
      ${items.length ? `<div class="list list-spaced">${items.map(([k, id]) => itemRow(k, id)).join('')}</div>`
        : emptyHTML({ icon: 'clock', title: 'Nothing yet', text: 'Open a MoM or file and it appears here.', cls: 'empty-spaced' })}
    </div>`;
  },
};

/* ---- Deleted: what is listed, what restores with what, and the 7 days ---- */
const TRASH_DAYS = 7, DAY_MS = 864e5;
const deletedAtOf = x => Number(x.deletedAt) || 0;
const daysLeftOf = x => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - deletedAtOf(x)) / DAY_MS));
/* Deleted things, one line each. Something inside a deleted area comes back with the area, so it
   is not listed by itself. A deleted sub-area is listed when its parent is not deleted. */
function deletedEntries() {
  const areaIds = new Set(TF.map(f => f.id));
  const out = [];
  const add = (kind, x, name, where) => out.push({ kind, id: x.id, name, at: deletedAtOf(x), left: daysLeftOf(x), where });
  TF.forEach(f => { if (!f.parent || !areaIds.has(f.parent)) add('a', f, f.name || 'Untitled area', 'Area'); });
  TM.forEach(m => { if (!areaIds.has(m.folderId)) add('m', m, m.title || 'Untitled meeting', 'MoM'); });
  TD.forEach(d => { if (!areaIds.has(d.folderId)) add('f', d, d.name || 'Untitled file', 'File'); });
  TMF.forEach(g => { if (!areaIds.has(g.folderId)) add('gm', g, g.name || 'Grouping', 'Grouping'); });
  TDF.forEach(g => { if (!areaIds.has(g.folderId)) add('gf', g, g.name || 'Grouping', 'Grouping'); });
  return out.filter(e => e.left > 0).sort((a, b) => b.at - a.at);   // past 7 days, the old app's cleanup removes them
}
/* An area and all of its deleted contents, as [collection, id] pairs. Contents are matched by
   their deletion time: deleting an area writes each part at (almost) the same moment. */
function deletedTree(areaId) {
  const root = TF.find(f => f.id === areaId); if (!root) return [];
  const at = deletedAtOf(root), near = x => Math.abs(deletedAtOf(x) - at) < 5000;
  const ids = new Set([areaId]);
  let grew = true;
  while (grew) { grew = false; TF.forEach(f => { if (!ids.has(f.id) && ids.has(f.parent) && near(f)) { ids.add(f.id); grew = true; } }); }
  const list = [...TF.filter(f => ids.has(f.id)).map(f => ['folders', f.id])];
  TM.forEach(m => { if (ids.has(m.folderId) && near(m)) list.push(['moms', m.id]); });
  TD.forEach(d => { if (ids.has(d.folderId) && near(d)) list.push(['docs', d.id]); });
  TMF.forEach(g => { if (ids.has(g.folderId) && near(g)) list.push(['momfolders', g.id]); });
  TDF.forEach(g => { if (ids.has(g.folderId) && near(g)) list.push(['docfolders', g.id]); });
  return list;
}
const colOf = kind => ({ a: 'folders', m: 'moms', f: 'docs', gm: 'momfolders', gf: 'docfolders' })[kind];
const entryList = kind => (kind === 'a' ? deletedTree : (id => [[colOf(kind), id]]));
const KIND_ICON = { a: 'shelf', m: 'doc', f: 'file', gm: 'folder-plus', gf: 'folder-plus' };

on('restore', d => {
  const list = entryList(d.kind)(d.id);
  afterWrite(restoreBatch(list), ['Restored', { icon: 'restore' }], 'Couldn’t restore. Check your connection, then try again.');
});
on('purge', d => {
  const e = deletedEntries().find(x => x.kind === d.kind && x.id === d.id); if (!e) return;
  confirmDialog({ title: `Remove “${e.name}” forever?`, text: 'It is removed for good and cannot be brought back.', impact: `<b>This can’t be undone.</b>`, danger: true, cta: 'Remove forever', act: 'purge-now', data: { kind: d.kind, id: d.id } });
});
on('purge-now', d => {
  const list = entryList(d.kind)(d.id);
  closeAll();
  afterWrite(purgeBatch(list), ['Removed for good', { icon: 'trash' }], 'Couldn’t remove it. Check your connection, then try again.');
});
on('empty-deleted', () => {
  const n = deletedEntries().length;
  confirmDialog({ title: 'Empty Deleted?', text: `Everything in Deleted (${plural(n, 'item')}) is removed for good.`, impact: '<b>This can’t be undone.</b>', danger: true, cta: 'Empty all', act: 'empty-deleted-now' });
});
on('empty-deleted-now', () => {
  closeAll();
  afterWrite(clearTrash(), ['Deleted is empty', { icon: 'trash' }], 'Couldn’t empty Deleted. Check your connection, then try again.');
});

VIEWS.deleted = {
  html() {
    const list = deletedEntries();
    const kindLabel = { a: 'Area', m: 'MoM', f: 'File', gm: 'Grouping', gf: 'Grouping' };
    return `<div class="page">${pageHead('Recovery', 'Deleted', 'Kept for 7 days, then removed for good. Restore anything here.',
      list.length ? btnHTML({ kind: 'quiet-danger', label: 'Empty all', act: 'empty-deleted' }) : '')}
      ${list.length ? `<div class="list list-spaced">${list.map(e => `<div class="cw"><div class="row row-trash"><span class="ktile k-other">${ic(KIND_ICON[e.kind])}</span><span class="mid"><span class="t">${esc(e.name)}</span><span class="p">${kindLabel[e.kind]} · deleted ${esc(relDate(isoOf(e.at)))} · ${plural(e.left, 'day')} left</span></span></div>
        <div class="trash-acts">${btnHTML({ kind: 'soft', sm: true, label: 'Restore', icon: 'restore', act: 'restore', data: { kind: e.kind, id: e.id } })}${iconBtnHTML({ icon: 'trash', label: `Remove ${e.name} forever`, sm: true, act: 'purge', data: { kind: e.kind, id: e.id } })}</div></div>`).join('')}</div>`
        : emptyHTML({ icon: 'bin', title: 'Nothing deleted', text: 'Deleted MoMs, files, groupings and areas appear here for 7 days.', cls: 'empty-spaced' })}
    </div>`;
  },
};

/* ---------- Sign in, Reset, New member (U1, U2, U4) ---------- */
/* Wrong details: the two sign-in codes that mean "no such email and password pair". */
const WRONG_DETAILS = ['auth/invalid-login-credentials', 'auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'];
/* Clears the errors a previous submit left on an auth form. */
function clearAuthErrors(f) {
  f.querySelectorAll('.field.err').forEach(x => x.classList.remove('err'));
  f.querySelectorAll('.ferr').forEach(x => x.remove());
  f.querySelectorAll('[aria-invalid]').forEach(x => { x.removeAttribute('aria-invalid'); x.removeAttribute('aria-describedby'); });
  f.querySelector('[data-slot="notice"]').innerHTML = '';
}
/* A submit button is busy and can't be pressed twice while the request is out. */
function setSubmitting(btn, on) { busy(btn, on); btn.disabled = !!on; }

VIEWS.signin = {
  html() {
    return `<div class="auth-wrap"><form class="auth" data-form="signin" novalidate>
      <img class="brand-mark brand-logo" src="icon.svg" alt="">
      <h1>Sign in to ${esc(APP_NAME)}</h1>
      <p class="sub">Your meetings, files and areas, in one place.</p>
      <div data-slot="notice"></div>
      ${fieldHTML({ id: 'sEmail', label: 'Email', control: inputHTML({ id: 'sEmail', name: 'email', type: 'email', autocomplete: 'username' }) })}
      ${pwFieldHTML({ id: 'sPw', label: 'Password', autocomplete: 'current-password' })}
      <label class="check-row"><input type="checkbox" name="stay" checked> Stay signed in on this device</label>
      ${btnHTML({ kind: 'primary', label: 'Sign in', type: 'submit' })}
      <div class="foot">${btnHTML({ kind: 'link', label: 'Forgot password?', href: '#/reset' })}</div>
    </form></div>`;
  },
};
onForm('signin', (f) => {
  const email = f.elements.email.value.trim(), pw = f.elements.sPw.value;   // pwFieldHTML names its input after its id
  const btn = f.querySelector('[type="submit"]');
  clearAuthErrors(f);
  if (!email) fieldError(f, 'sEmail', 'Enter your email address.');
  if (!pw) fieldError(f, 'sPw', 'Enter your password.');
  if (!email || !pw) return;
  setSubmitting(btn, true);
  signIn(email, pw, f.elements.stay.checked).then(() => {
    go('#/today');   // the guard sends a person with no areas to New member once their access has loaded
  }, (e) => {
    setSubmitting(btn, false);
    if (e && WRONG_DETAILS.includes(e.code)) fieldError(f, 'sPw', 'That email and password don’t match. Check them and try again.');
    f.querySelector('[data-slot="notice"]').innerHTML = noticeHTML({ tone: 'danger', icon: 'alert', title: 'Couldn’t sign you in', text: 'Check your email and password, or reset your password.', role: 'alert' });
  });
});

VIEWS.reset = {
  html() {
    return `<div class="auth-wrap"><form class="auth" data-form="reset" novalidate>
      <span class="brand-mark">${ic('key')}</span>
      <h1>Reset your password</h1>
      <p class="sub">Enter the email you use for ${esc(APP_NAME)}. We’ll send a reset link to it.</p>
      <div data-slot="notice"></div>
      ${fieldHTML({ id: 'rEmail', label: 'Email', control: inputHTML({ id: 'rEmail', name: 'email', type: 'email', autocomplete: 'username', placeholder: 'you@company.com' }) })}
      ${btnHTML({ kind: 'primary', label: 'Send reset email', type: 'submit' })}
      <div class="foot">${btnHTML({ kind: 'link', label: 'Back to sign in', icon: 'arrow-left', href: '#/signin' })}</div>
    </form></div>`;
  },
};
onForm('reset', (f) => {
  const email = f.elements.email.value.trim(), btn = f.querySelector('[type="submit"]');
  clearAuthErrors(f);
  if (!email) { fieldError(f, 'rEmail', 'Enter your email first, so we know where to send the link.'); return; }
  const sent = () => {
    setSubmitting(btn, false);
    f.querySelector('[data-slot="notice"]').innerHTML = noticeHTML({ tone: 'info', icon: 'mail', title: 'Check your inbox', text: `If an account exists for ${email}, a reset link is on its way.`, role: 'status' });
  };
  setSubmitting(btn, true);
  // An unknown email gets the same answer as a known one, so the form can't be used to find accounts.
  sendReset(email).then(sent, (e) => {
    if (e && e.code === 'auth/user-not-found') return sent();
    setSubmitting(btn, false);
    if (e && e.code === 'auth/invalid-email') fieldError(f, 'rEmail', 'Check the email address, then try again.');   // interim copy, see §9.1 G18
    else f.querySelector('[data-slot="notice"]').innerHTML = noticeHTML({ tone: 'danger', icon: 'alert', title: 'Couldn’t send the reset email', text: 'Check your connection, then try again.', role: 'alert' });   // interim copy, see §9.1 G18
  });
});

VIEWS.newmember = {
  html() {
    const me = currentUser();
    return `<div class="auth-wrap"><div class="auth">
      <span class="brand-mark">${ic('user')}</span>
      <h1>Welcome to ${esc(APP_NAME)}</h1>
      <p class="sub">Your account is ready, but you don’t have access to any areas yet. An admin can grant you access to a client or team, and everything inside it will appear here.</p>
      <div class="notice info">${ic('info')}<div>You’re signed in as <b>${esc(me.name)}</b>.</div></div>
      <div class="auth-acts">${btnHTML({ kind: 'primary', label: 'Check again', icon: 'refresh', act: 'refresh-access' })}${btnHTML({ kind: 'soft', label: 'Account', href: '#/account' })}</div>
    </div></div>`;
  },
};
/* Access arrives on its own (the access list is live), so this only re-reads the page and says if nothing has changed. */
on('refresh-access', () => {
  render();
  if (sessionRole() === 'newmember') toast('Still no areas. We’ll show them here once an admin grants access.', { icon: 'info' });
});

/* ---------- Missing page (unknown address, design §4 "Missing page") ---------- */
VIEWS.missing = {
  html() {
    return `<div class="page"><div class="locked locked-top">
      <div class="art">${ic('alert')}</div>
      <h1>This page isn’t here</h1>
      <p>It may have moved to Deleted, or the link may be out of date.</p>
      <div class="missing-acts">${btnHTML({ kind: 'primary', label: 'Go to Today', href: '#/today' })}${btnHTML({ kind: 'soft', label: 'Open Deleted', href: '#/deleted' })}</div>
    </div></div>`;
  },
};
