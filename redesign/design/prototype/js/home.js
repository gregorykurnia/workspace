/* Home views: Today, Areas, Flagged, Recent, Deleted (O9), Account,
   sign-in and reset (U1, U2), new member (U4), and missing pages (V4). */
'use strict';

/* ---------- Shared row and card parts ---------- */
function itemRow(kind, id, { right = '', extra = '' } = {}) {
  if (kind === 'area') {
    const a = area(id);
    const c = countsOf(id);
    return `<a class="row" href="#/areas/${a.id}"><span class="ktile ${a.tint}" style="font-size:20px">${a.emoji}</span><span class="mid"><span class="t">${esc(a.name)}</span><span class="p">${crumbPath(id).slice(0, -1).map(x => esc(x.name)).join(' › ') || 'Top level'} · ${plural(c.moms, 'MoM')} · ${plural(c.files, 'file')}</span></span>${right}</a>`;
  }
  if (kind === 'mom') {
    const m = mom(id);
    const flag = m.flagged ? `<span class="flagmark" aria-label="Flagged">${ic('flag-fill', 'sm')}</span>` : '';
    const fin = isFinal(m) ? `<span class="finalmark">${ic('lock', 'sm')}Final</span>` : '';
    return `<a class="row" href="#/mom/${m.id}"><span class="ktile k-other">${ic('doc')}</span><span class="mid"><span class="t">${flag}${esc(m.title)}</span><span class="p">${esc(area(m.area).name)}${m.group ? ' · ' + esc(group(m.group).name) : ''} · ${rel(m.date)}</span></span>${fin}${right}</a>`;
  }
  const f = file(id);
  const k = KINDS[f.kind];
  const lock = f.restricted ? `<span class="restrictmark">${ic('lock', 'sm')}Restricted</span>` : '';
  const fin = isFinal(f) ? `<span class="finalmark">${ic('lock', 'sm')}Final</span>` : '';
  const flag = f.flagged ? `<span class="flagmark" aria-label="Flagged">${ic('flag-fill', 'sm')}</span>` : '';
  const hiddenNote = lockedFile(f) ? 'Locked' : (f.link ? f.link.split('/')[0] : fmtSize(f.size));
  const name = lockedFile(f) ? f.name : f.name;
  return `<a class="row" href="#/areas/${f.area}" data-act="open-file" data-id="${f.id}"><span class="ktile ${k.tile}">${ic(k.icon)}</span><span class="mid"><span class="t">${flag}${esc(name)}</span><span class="p">${k.label} · ${esc(area(f.area).name)}${f.group ? ' · ' + esc(group(f.group).name) : ''} · ${hiddenNote}</span></span>${lock}${fin}${right}</a>`;
}
function momCardHTML(m) {
  const flag = m.flagged ? `<span class="flagmark">${ic('flag-fill', 'sm')}</span>` : '';
  return `<div class="cw"><a class="mcard" href="#/mom/${m.id}"><span class="d">${flag}${ic('calendar', 'sm')}${rel(m.date)}${isFinal(m) ? ` · <span class="finalmark">${ic('lock', 'sm')}Final</span>` : ''}</span><span class="t">${esc(m.title)}</span><span class="s">${esc(stripTags(m.body).slice(0, 140))}</span><span class="tags">${m.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</span></a></div>`;
}
const areaEmpty = () => `<div class="empty"><div class="art">${ic('shelf')}</div><h3>No areas yet</h3><p>Create an area for a client, a team or an initiative. Everything you write and upload goes inside one.</p><div class="acts"><button class="btn btn-primary" data-act="new-area" ${adminAttr('createArea', 'create areas')}>${ic('plus', 'sm')}New area</button></div></div>`;

/* ---------- Today ---------- */
const greeting = () => (new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening');
VIEWS.today = {
  html() {
    if (S.role === 'member' && visibleRoots().length === 0) return noAccessHTML();
    const p = createPlace({ name: 'today' });
    const recent = S.recent.filter(([t, id]) => (t === 'm' ? mom(id) && canSee(mom(id).area) && !hiddenItem('m', mom(id)) : file(id) && canSee(file(id).area) && !hiddenItem('f', file(id))));
    const flagged = DB.moms.filter(m => m.flagged && canSee(m.area) && !hiddenItem('m', m)).map(m => ['m', m.id]).concat(DB.files.filter(f => f.flagged && canSee(f.area) && !hiddenItem('f', f)).map(f => ['f', f.id]));
    const added = DB.activity.filter(a => (a.t === 'mom' ? mom(a.id) : file(a.id)));
    const nothing = S.state === 'fresh';
    return `<div class="page">
      <section class="hero" aria-labelledby="hello">
        <p class="eyebrow">Monday, 13 October 2026</p>
        <h1 class="h1" id="hello">${greeting()}, Greg</h1>
        <p class="hero-sub">${nothing ? 'Nothing here yet. Start with an area, then add your first meeting.' : 'Pick up where you left off, or start the next meeting in one tap.'}</p>
        <div class="place-line"><span>Creating in</span><button class="place-chip" data-act="pick-place" aria-label="Change where new items go">${ic('folder-plus', 'sm')}<span>${esc(placeName(p))}</span>${ic('chev-d', 'sm')}</button></div>
        <div class="quick">
          <button class="qtile primary" data-act="new-mom" data-area="${p ? p.area : ''}" data-group="${p && p.group ? p.group : ''}"${p ? '' : ' disabled'}><span class="qi">${ic('doc')}</span><span><b>New MoM</b><small>Today’s date, cursor ready</small></span></button>
          <button class="qtile" data-act="upload" data-area="${p ? p.area : ''}" data-group="${p && p.group ? p.group : ''}"${p ? '' : ' disabled'}><span class="qi">${ic('upload')}</span><span><b>Upload</b><small>Files and PDFs</small></span></button>
          <button class="qtile" data-act="save-link" data-area="${p ? p.area : ''}" data-group="${p && p.group ? p.group : ''}"${p ? '' : ' disabled'}><span class="qi">${ic('link')}</span><span><b>Save a link</b><small>Online material</small></span></button>
          <a class="qtile" href="#/flagged"><span class="qi">${ic('flag')}</span><span><b>Flagged</b><small>${flagged.length} important</small></span></a>
        </div>
      </section>
      ${nothing ? '' : `
      <section class="section" aria-labelledby="cont"><div class="section-head"><h2 class="h2" id="cont">Continue where you left off</h2><span class="spacer"></span><a class="link-btn" href="#/recent">See all</a></div>
        ${recent.length ? `<div class="cont-row">${recent.slice(0, 4).map(([t, id]) => { const m = t === 'm' ? mom(id) : null; const f = t === 'f' ? file(id) : null; return m ? `<a class="ccard" href="#/mom/${m.id}"><span class="ktile k-other">${ic('doc')}</span><span class="t">${esc(m.title)}</span><span class="p">${esc(area(m.area).name)} · ${rel(m.date)}</span><span class="f">${ic('arrow-right', 'sm')}Open MoM</span></a>` : `<a class="ccard" href="#/areas/${f.area}" data-act="open-file" data-id="${f.id}"><span class="ktile ${KINDS[f.kind].tile}">${ic(KINDS[f.kind].icon)}</span><span class="t">${esc(f.name)}</span><span class="p">${esc(area(f.area).name)}</span><span class="f">${ic('arrow-right', 'sm')}Open file</span></a>`; }).join('')}</div>` : `<div class="empty small"><div class="art">${ic('clock')}</div><h3>Nothing yet</h3><p>Open a MoM or file and it appears here.</p></div>`}
      </section>
      <section class="section" aria-labelledby="flg"><div class="section-head"><h2 class="h2" id="flg">Flagged ${flagged.length ? `<span class="count">${flagged.length}</span>` : ''}</h2><span class="spacer"></span><a class="link-btn" href="#/flagged">Open flagged</a></div>
        ${flagged.length ? `<div class="list">${flagged.slice(0, 4).map(([t, id]) => itemRow(t === 'm' ? 'mom' : 'file', id)).join('')}</div>` : `<div class="empty small"><div class="art">${ic('flag')}</div><h3>Nothing flagged</h3><p>Flag a MoM or file to keep it close.</p></div>`}
      </section>
      ${isAdmin() ? `<section class="section" aria-labelledby="adds"><div class="section-head"><h2 class="h2" id="adds">Recently added across the workspace</h2></div>
        ${added.length ? `<div class="list">${added.map(a => itemRow(a.t === 'mom' ? 'mom' : 'file', a.id, { right: `<span class="r" style="margin-left:auto;padding-left:10px;display:inline-flex;align-items:center;gap:8px"><span class="who ${a.cls}">${a.ini}</span>${esc(a.who)} · ${a.when}</span>` })).join('')}</div>` : `<div class="empty small"><div class="art">${ic('sparkle')}</div><h3>Nothing yet</h3><p>New MoMs and files from across the team show here.</p></div>`}
      </section>` : ''}`}
    </div>`;
  },
  mount(r, el) { if (!el) return; },
};

function noAccessHTML() {
  return `<div class="page"><div class="empty"><div class="art">${ic('shelf')}</div><h3>No areas yet</h3><p>You’re signed in, but you don’t have access to any areas yet. An admin can grant you access to a client or team, and everything inside it will appear here.</p></div></div>`;
}

/* ---------- Areas: grid on desktop, full-screen tree on phone ---------- */
VIEWS.areas = {
  html() {
    const roots = visibleRoots();
    const total = visibleAreas().length;
    const cards = roots.map(a => {
      const c = countsOf(a.id);
      const locked = lockedArea(a.id);
      const kids = locked ? [] : DB.areas.filter(k => k.parent === a.id && canSee(k.id));
      return `<a class="acard" href="#/areas/${a.id}">
        <div style="display:flex;align-items:center;gap:14px"><span class="blob ${a.tint}">${a.emoji}</span><span style="flex:1;min-width:0"><span class="n" style="display:block">${esc(a.name)}</span>${locked ? `<span class="restrictmark" style="margin-top:6px">${ic('lock', 'sm')}Restricted</span>` : `<span class="c">${plural(c.moms, 'MoM')} · ${plural(c.files, 'file')}</span>`}</span></div>
        <div class="kids">${kids.slice(0, 4).map(k => `<span class="kid">${k.emoji} ${esc(k.name)}</span>`).join('')}${kids.length > 4 ? `<span class="kid">+${kids.length - 4}</span>` : ''}</div>
      </a>`;
    }).join('');
    const emptyMsg = S.role === 'member' || S.role === 'newmember' ? noAccessHTML() : areaEmpty();
    return `<div class="page">
      <div class="page-head"><div><p class="eyebrow">Workspace</p><h1 class="h-page" style="margin-top:4px">Areas</h1><p class="page-sub">${total ? `${plural(roots.length, 'top-level area')}, each with its own MoMs and files.` : 'Areas hold the MoMs and files for one client, team or initiative.'}</p></div></div>
      <div class="phone-only">${treeHTML({ name: 'areas' }, { cls: 'tree-page', roots })}</div>
      <div class="desk-only">${total ? `<div class="agrid">${cards}${isAdmin() ? `<button class="acard new-card" data-act="new-area" aria-label="New area" ${adminAttr('createArea', 'create areas')}>${ic('plus')}<span>New area</span></button>` : ''}</div>` : emptyMsg}</div>
      <div class="phone-only">${total ? '' : emptyMsg}${isAdmin() ? `<div style="margin-top:16px"><button class="btn btn-soft" data-act="new-area" ${adminAttr('createArea', 'create areas')}>${ic('plus', 'sm')}New area</button></div>` : ''}</div>
    </div>`;
  },
};

/* ---------- Flagged, recent, deleted ---------- */
VIEWS.flagged = {
  html() {
    const items = DB.moms.filter(m => m.flagged && canSee(m.area) && !hiddenItem('m', m)).map(m => ['mom', m.id]).concat(DB.files.filter(f => f.flagged && canSee(f.area) && !hiddenItem('f', f)).map(f => ['file', f.id]));
    return `<div class="page"><div class="page-head"><div><p class="eyebrow">Important</p><h1 class="h-page" style="margin-top:4px">Flagged</h1><p class="page-sub">Everything you’ve marked as important, in one place.</p></div></div>
      ${items.length ? `<div class="list" style="margin-top:24px">${items.map(([k, id]) => itemRow(k, id, { right: `<button class="icon-btn" style="margin-left:6px" data-act="flag" data-kind="${k === 'mom' ? 'm' : 'f'}" data-id="${id}" aria-pressed="true" aria-label="Unflag">${ic('flag-fill', 'sm')}</button>` })).join('')}</div>`
        : `<div class="empty" style="margin-top:24px"><div class="art">${ic('flag')}</div><h3>Nothing flagged yet</h3><p>Flag a MoM or file when it matters. It shows up here and on Today.</p></div>`}
    </div>`;
  },
};
VIEWS.recent = {
  html() {
    const items = S.recent.filter(([t, id]) => (t === 'm' ? mom(id) : file(id)) && (t === 'm' ? canSee(mom(id).area) && !hiddenItem('m', mom(id)) : canSee(file(id).area) && !hiddenItem('f', file(id))));
    return `<div class="page"><div class="page-head"><div><p class="eyebrow">Your work</p><h1 class="h-page" style="margin-top:4px">Recent</h1><p class="page-sub">What you opened most recently, wherever it lives.</p></div></div>
      ${items.length ? `<div class="list" style="margin-top:24px">${items.map(([t, id]) => itemRow(t === 'm' ? 'mom' : 'file', id)).join('')}</div>` : `<div class="empty" style="margin-top:24px"><div class="art">${ic('clock')}</div><h3>Nothing yet</h3><p>Open a MoM or file and it appears here.</p></div>`}
    </div>`;
  },
};
const daysLeft = d => 7 - daysBetween(d.at);
VIEWS.deleted = {
  html() {
    DB.deleted = DB.deleted.filter(d => daysLeft(d) > 0);   // removed automatically after 7 days (O9)
    const list = DB.deleted;
    const kindLabel = { mom: 'MoM', file: 'File', group: 'Grouping', area: 'Area' };
    const kindIcon = { mom: 'doc', file: 'file', group: 'folder-plus', area: 'shelf' };
    return `<div class="page"><div class="page-head"><div><p class="eyebrow">Recovery</p><h1 class="h-page" style="margin-top:4px">Deleted</h1><p class="page-sub">Kept for 7 days, then removed for good. Restore anything here.</p></div><span class="spacer"></span>${list.length ? `<button class="btn btn-quiet-danger" data-act="empty-deleted">Empty all</button>` : ''}</div>
      ${list.length ? `<div class="list" style="margin-top:24px">${list.map(d => `<div class="cw"><div class="row" style="padding-right:200px"><span class="ktile k-other">${ic(kindIcon[d.t])}</span><span class="mid"><span class="t">${esc(d.name)}</span><span class="p">${kindLabel[d.t]} · deleted ${rel(d.at)} · ${plural(daysLeft(d), 'day')} left</span></span></div>
        <div style="position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;gap:6px"><button class="btn btn-soft btn-sm" data-act="restore" data-key="${d.key}">${ic('restore', 'sm')}Restore</button><button class="icon-btn" data-act="purge" data-key="${d.key}" aria-label="Remove ${esc(d.name)} forever" title="Remove forever">${ic('trash', 'sm')}</button></div></div>`).join('')}</div>`
        : `<div class="empty" style="margin-top:24px"><div class="art">${ic('bin')}</div><h3>Nothing deleted</h3><p>Deleted MoMs, files, groupings and areas appear here for 7 days.</p></div>`}
    </div>`;
  },
};

/* ---------- Account (U3) ---------- */
VIEWS.account = {
  html() {
    const role = S.role === 'admin' ? 'Admin' : S.role === 'member' ? 'Member' : 'New member';
    const granted = visibleRoots().map(a => `<span class="kid">${a.emoji} ${esc(a.name)}</span>`).join('');
    return `<div class="page">
      <p class="eyebrow">Account</p><h1 class="h-page" style="margin-top:4px">${esc(SEED.me.name)}</h1>
      <div class="acct-grid" style="margin-top:24px">
        <div class="acct-card">
          <div class="acct-hero"><span class="avatar">${SEED.me.ini}</span><div><b style="font-size:17px;display:block">${esc(SEED.me.name)}</b><span class="muted">${SEED.me.email}</span><div style="margin-top:8px"><span class="pill-role">${role}</span></div></div></div>
          <div class="acct-list">
            <button class="row" data-act="change-password">${ic('key')}<span class="mid"><span class="t">Change password</span><span class="p">At least 6 characters</span></span>${ic('chev-r', 'sm')}</button>
            <button class="row" data-act="install">${ic('install')}<span class="mid"><span class="t">Install Daybook</span><span class="p">Open it on its own, like an app</span></span>${ic('chev-r', 'sm')}</button>
            <button class="row" data-act="sign-out">${ic('signout')}<span class="mid"><span class="t">Sign out</span><span class="p">On this device</span></span>${ic('chev-r', 'sm')}</button>
          </div>
        </div>
        <div class="acct-card">
          <h2 class="h2" style="font-size:17px">Your access</h2>
          <p class="muted" style="margin-top:6px;font-size:14.5px">${isAdmin() ? 'As an admin you see every area.' : granted ? 'Areas granted to you, and everything inside them.' : 'You have no areas yet. An admin can grant access.'}</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px">${isAdmin() ? '<span class="kid">All areas</span>' : granted}</div>
          <p class="hint">${ic('info', 'sm')}Accounts are created by the workspace owner. There is no self sign-up.</p>
        </div>
      </div>
    </div>`;
  },
};
on('sign-out', () => { S.role = 'signedout'; toast('Signed out on this device'); go('#/signin'); });

/* ---------- Sign-in, reset, new member (U1, U2, U4) ---------- */
VIEWS.signin = {
  html() {
    return `<div class="auth-wrap"><form class="auth" data-form="signin" novalidate>
      <span class="brand-mark">${ic('book')}</span>
      <h1>Sign in to Daybook</h1>
      <p class="sub">Your meetings, files and areas, in one place.</p>
      <div id="authErr"></div>
      <div class="field" id="fEmail"><label class="lab" for="sEmail">Email</label><input class="input" id="sEmail" name="email" type="email" autocomplete="username" value="greg@studio.example" required><span class="ferr" role="alert">Enter your email address.</span></div>
      <div class="field" id="fPw"><label class="lab" for="sPw">Password</label><div style="position:relative"><input class="input" id="sPw" name="password" type="password" autocomplete="current-password" value="" style="padding-right:56px"><button type="button" class="icon-btn" data-act="toggle-pw" data-target="sPw" aria-label="Show password" style="position:absolute;right:4px;top:50%;transform:translateY(-50%)">${ic('eye', 'sm')}</button></div><span class="ferr" role="alert">Enter your password.</span></div>
      <label class="check-row" style="min-height:44px"><input type="checkbox" checked> Stay signed in on this device</label>
      <button class="btn btn-primary" type="submit" style="margin-top:8px">Sign in</button>
      <div class="foot"><a class="link-btn" href="#/reset" style="padding:0 4px">Forgot password?</a></div>
    </form></div>`;
  },
};
onForm('signin', (f) => {
  const email = f.email.value.trim();
  const pw = f.password.value;
  const wrap = $('#fPw');
  $('#authErr').innerHTML = '';
  $('#fEmail').classList.toggle('err', !email);
  if (!email) return;
  if (!pw) { wrap.classList.add('err'); wrap.querySelector('.ferr').textContent = 'Enter your password.'; return; }
  if (S.state === 'failure' || pw !== 'daybook') {
    wrap.classList.add('err');
    wrap.querySelector('.ferr').textContent = 'That email and password don’t match. Check them and try again.';
    $('#authErr').innerHTML = `<div class="notice danger" role="alert" style="margin-bottom:16px">${ic('alert')}<div><b>Couldn’t sign you in</b><br>Check your email and password, or reset your password.</div></div>`;
    return;
  }
  S.role = 'admin';
  toast('Signed in');
  go('#/today');
});
on('toggle-pw', (d, el) => {
  const input = document.getElementById(d.target);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  el.innerHTML = ic(show ? 'eye-off' : 'eye', 'sm');
});
VIEWS.reset = {
  html() {
    return `<div class="auth-wrap"><form class="auth" data-form="reset" novalidate>
      <span class="brand-mark">${ic('key')}</span>
      <h1>Reset your password</h1>
      <p class="sub">Enter the email you use for Daybook. We’ll send a reset link to it.</p>
      <div id="resetMsg"></div>
      <div class="field" id="fReset"><label class="lab" for="rEmail">Email</label><input class="input" id="rEmail" name="email" type="email" autocomplete="username" placeholder="you@company.com"><span class="ferr" role="alert">Enter your email first, so we know where to send the link.</span></div>
      <button class="btn btn-primary" type="submit">Send reset email</button>
      <div class="foot"><a class="link-btn" href="#/signin" style="padding:0 4px">${ic('arrow-left', 'sm')}Back to sign in</a></div>
    </form></div>`;
  },
};
onForm('reset', (f) => {
  const email = f.email.value.trim();
  const box = $('#fReset');
  box.classList.toggle('err', !email);
  if (!email) return;
  box.classList.remove('err');
  $('#resetMsg').innerHTML = `<div class="notice info" role="status" style="margin-bottom:16px">${ic('mail')}<div><b>Check your inbox</b><br>If an account exists for ${esc(email)}, a reset link is on its way.</div></div>`;
});
VIEWS.newmember = {
  html() {
    return `<div class="auth-wrap"><div class="auth">
      <span class="brand-mark">${ic('user')}</span>
      <h1>Welcome to Daybook</h1>
      <p class="sub">Your account is ready, but you don’t have access to any areas yet. An admin can grant you access to a client or team, and everything inside it will appear here.</p>
      <div class="notice info">${ic('info')}<div>You’re signed in as <b>${SEED.members[2].name}</b>.</div></div>
      <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap"><button class="btn btn-primary" data-act="refresh-access" style="flex:1">${ic('refresh', 'sm')}Check again</button><a class="btn btn-soft" href="#/account">Account</a></div>
    </div></div>`;
  },
};
on('refresh-access', () => { toast('Still no areas. We’ll show them here once an admin grants access.', { icon: 'info' }); });

/* ---------- Missing (also used for unknown links) ---------- */
VIEWS.missing = {
  html() {
    return `<div class="page"><div class="locked" style="margin-top:56px"><div class="art">${ic('alert')}</div><h1>This page isn’t here</h1><p>It may have moved to Deleted, or the link may be out of date.</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn btn-primary" href="#/today">Go to Today</a><a class="btn btn-soft" href="#/deleted">Open Deleted</a></div></div></div>`;
  },
};

/* Restore, remove, empty (O9) */
on('restore', (d) => {
  const d0 = DB.deleted.find(x => x.key === d.key);
  if (!d0) return;
  const s = d0.snap;
  (s.areas || []).forEach(a => DB.areas.push(a));
  (s.groups || []).forEach(g => DB.groups.push(g));
  (s.moms || []).forEach(m => DB.moms.push(m));
  (s.files || []).forEach(f => DB.files.push(f));
  DB.deleted = DB.deleted.filter(x => x !== d0);
  toast(`Restored “${d0.name}”`);
  render();
});
on('purge', (d) => {
  const d0 = DB.deleted.find(x => x.key === d.key);
  if (!d0) return;
  confirmDialog({
    title: `Remove “${d0.name}” forever?`, text: 'This can’t be undone.', cta: 'Remove forever', danger: true, act: 'purge-now', data: { key: d.key },
  });
});
on('purge-now', (d) => { DB.deleted = DB.deleted.filter(x => x.key !== d.key); closeAll(); toast('Removed for good', { icon: 'trash' }); render(); });
on('empty-deleted', () => {
  confirmDialog({
    title: 'Empty Deleted?', text: `Everything in Deleted is removed for good, from every area.`, danger: true, cta: 'Empty everything', act: 'empty-now',
    impact: 'This can’t be undone. Items here don’t come back.',
  });
});
on('empty-now', () => { DB.deleted = []; closeAll(); toast('Deleted is empty', { icon: 'trash' }); render(); });

/* Flag toggle (F3). Used on rows, cards and the editor. */
on('flag', (d) => {
  const item = d.kind === 'm' ? mom(d.id) : file(d.id);
  if (!item) return;
  item.flagged = !item.flagged;
  toast(item.flagged ? 'Flagged' : 'Unflagged', { icon: item.flagged ? 'flag-fill' : 'flag' });
  render();
});
