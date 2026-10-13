/* Core: helpers, UI state, roles, actions, layers, menus, toasts, routing, rendering,
   banners and the keyboard. Feature files register their views in VIEWS and their actions
   with on(). Reads go through the data layer (js/data/*); nothing here touches Firestore. */
'use strict';

/* One name for the product until the owner decides (plan Q2). */
const APP_NAME = 'Workbench';

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const isPhone = () => window.matchMedia('(max-width: 767px)').matches;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const attrs = o => Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => v === true ? ` data-${k}` : ` data-${k}="${esc(v)}"`).join('');
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private window: the setting just won't persist */ } };
const areaHref = id => '#/areas/' + encodeURIComponent(id);
/* An area's emoji, as stored. Areas without one show no emoji (plan gap G12). */
const areaEmoji = a => (a && a.icon) || '';
/* The emoji, then a space, ready for a label. */
const emojiLead = a => areaEmoji(a) ? esc(areaEmoji(a)) + ' ' : '';

/* ---------- UI state (everything the data layer doesn't own) ---------- */
function loadOpen() { try { return new Set(JSON.parse(lsGet('G_exp') || '[]')); } catch (e) { return new Set(); } }
const UI = {
  booted: false,
  authReady: false,        // Firebase Auth has reported once
  roleReady: false,        // users/{uid} has been read (session.js 'role')
  accessReady: false,      // folder_access has arrived (session.js 'access')
  open: loadOpen(),        // expanded tree rows, kept in G_exp
  place: null,             // where "New MoM" lands: { area, group }
  sel: new Set(),          // selected 'a:id' 'm:id' 'f:id'
  selMode: false,
  filter: '',
  sort: 'newest',
  fileView: lsGet('G_fview') === 'list' ? 'list' : 'grid',
  update: false,           // a new version is waiting (pwa.js sets this)
  onRefresh: null,         // pwa.js: apply the waiting version
  lastKey: '',             // route name and id of the last render
  sharedHome: null,        // the shared address a visitor arrived on
  wasOffline: false,
};

/* ---------- Who is acting ---------- */
/* admin | member | newmember | visitor | signedout | loading */
function sessionRole() {
  if (!UI.authReady) return 'loading';
  const u = auth.currentUser;
  if (!u) return 'signedout';
  if (u.isAnonymous) return 'visitor';
  if (!UI.roleReady) return 'loading';
  if (CURR_USER_ROLE === 'admin') return 'admin';
  if (!UI.accessReady) return 'loading';
  return FA.some(fa => fa.uid === u.uid) ? 'member' : 'newmember';
}
const isAdmin = () => CURR_USER_ROLE === 'admin';
function currentUser() {
  const u = auth.currentUser;
  const base = (u && (u.displayName || (u.email || '').split('@')[0])) || '';
  const ini = base.split(/[\s._-]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return { name: (u && (u.displayName || u.email)) || '', email: (u && u.email) || '', ini: ini || '?', roleLabel: isAdmin() ? 'Admin' : 'Member' };
}
const ADMIN_ONLY = new Set(['createArea', 'moveArea', 'deleteItem', 'removeGroup', 'shareLinks', 'access', 'final', 'recentAdded', 'bulkAreas']);
const can = k => isAdmin() || !ADMIN_ONLY.has(k);
/* Attribute for an admin-only control. Members who click it are told plainly. */
const adminAttr = (k, label) => can(k) ? '' : ` data-admin="${esc(label)}" aria-disabled="true"`;

/* ---------- Reads over the data layer ---------- */
/* What each viewer may see (canSee, lockedArea, hiddenItem, visibleAreas, crumbPath) comes
   from the data layer. Everything below is derived from those and from plain lookups. */
const area = id => gf(id) || null;
const mom = id => M.find(m => m.id === id) || null;
const chainOf = id => pathTo(id).map(gf);
const groupName = id => (MF.find(g => g.id === id) || DF.find(g => g.id === id) || {}).name || '';
function descIds(id) {
  const out = [id];
  (function walk(p) { kids(p).forEach(k => { out.push(k.id); walk(k.id); }); })(id);
  return out;
}
function visibleRoots() {
  const list = visibleAreas();
  const ids = new Set(list.map(a => a.id));
  return list.filter(a => !a.parent || !ids.has(a.parent)).sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
}
/* Everything inside an area, including sub-areas, but never what sits inside a restricted
   area that isn't open. Restricted files still count: their name is visible. */
function countsOf(areaId) {
  const ids = descIds(areaId).filter(id => id === areaId || !lockedArea(id));
  return {
    areas: ids.length - 1,
    moms: M.filter(m => ids.includes(m.folderId) && !lockedArea(m.folderId)).length,
    files: D.filter(d => ids.includes(d.folderId) && !lockedArea(d.folderId)).length,
  };
}
const deletedCount = () => TF.length + TM.length + TD.length + TDF.length + TMF.length;
const dataLoaded = () => LOADED.f && LOADED.m && LOADED.d && LOADED.df && LOADED.mf;
/* Final: members read only. Admins can still edit and un-mark. */
const readOnly = item => !!item.readOnly && !isAdmin();

/* ---------- Actions and forms: one delegated listener each ---------- */
const ACT = {};
const FORMS = {};
const INPUTS = {};
const KEYS = {};
const reg = (table, kind, name, fn) => { if (table[name]) console.warn(`${kind} "${name}" is registered twice`); table[name] = fn; };
const on = (name, fn) => reg(ACT, 'Action', name, fn);
const onForm = (name, fn) => reg(FORMS, 'Form', name, fn);
const onInput = (name, fn) => reg(INPUTS, 'Input', name, fn);

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act], [data-admin]');
  if (!el) return;
  if (el.hasAttribute('data-admin') && !isAdmin() && el.getAttribute('aria-disabled') !== 'false') {
    e.preventDefault();
    toast(`Only admins can ${el.dataset.admin}.`, { icon: 'alert', tone: 'warn' });
    return;
  }
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const fn = ACT[el.dataset.act];
  if (!fn) { if (el.dataset.act) console.warn(`No handler for data-act="${el.dataset.act}" yet`); return; }
  if (el.tagName === 'A') e.preventDefault();
  fn(el.dataset, el, e);
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (!f.dataset.form) return;
  e.preventDefault();
  FORMS[f.dataset.form] && FORMS[f.dataset.form](f, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.input && INPUTS[el.dataset.input]) INPUTS[el.dataset.input](el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.change && INPUTS[el.dataset.change]) INPUTS[el.dataset.change](el, e);
});

/* ---------- Layers: dialogs, sheets, drawers, menus, lightbox ---------- */
const LAYERS = [];
function layer({ cls = '', label = 'Dialog', html, onMount, onClose, dismiss = true }) {
  const wrap = document.createElement('div');
  wrap.className = 'layer ' + cls;
  wrap.innerHTML = `<div class="scrim" ${dismiss ? 'data-act="layer-scrim"' : ''}></div><div class="panel" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">${html}</div>`;
  $('#layers').appendChild(wrap);
  const L = { el: wrap, panel: wrap.querySelector('.panel'), prev: document.activeElement, onClose, dismiss };
  L.close = () => closeLayer(L);
  LAYERS.push(L);
  requestAnimationFrame(() => wrap.classList.add('open'));
  onMount && onMount(L.panel, L);
  const first = L.panel.querySelector('[autofocus]') || L.panel.querySelector('input:not([type=hidden]):not([disabled]), textarea, select');
  (first || L.panel).focus({ preventScroll: true });
  return L;
}
function closeLayer(L) {
  if (!L || L.closing) return;
  L.closing = true;
  const i = LAYERS.indexOf(L);
  if (i > -1) LAYERS.splice(i, 1);
  L.el.classList.remove('open');
  const done = () => { L.el.remove(); L.onClose && L.onClose(); if (L.prev && L.prev.focus && document.body.contains(L.prev)) L.prev.focus({ preventScroll: true }); };
  reduceMotion() ? done() : setTimeout(done, 200);
}
const closeTop = () => closeLayer(LAYERS[LAYERS.length - 1]);
const closeAll = () => [...LAYERS].reverse().forEach(closeLayer);
on('layer-scrim', (d, el) => { const L = LAYERS.find(x => x.el === el.closest('.layer')); if (L && L.dismiss) closeLayer(L); });
on('close', (d, el) => { const L = LAYERS.find(x => x.el === el.closest('.layer')); if (L) closeLayer(L); else closeTop(); });
/* Keep Tab inside the top layer (the dialogs are aria-modal). */
function trapTab(e) {
  const L = LAYERS[LAYERS.length - 1];
  const stops = $$('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', L.panel).filter(n => n.getClientRects().length);
  const now = document.activeElement;
  if (!stops.length) { e.preventDefault(); L.panel.focus(); return; }
  if (!L.panel.contains(now) || (!e.shiftKey && now === stops[stops.length - 1])) { e.preventDefault(); stops[0].focus(); }
  else if (e.shiftKey && (now === stops[0] || now === L.panel)) { e.preventDefault(); stops[stops.length - 1].focus(); }
}

/* Menu: anchored panel of items. Items: {label, icon, act, data, danger, admin, note} */
function menuHTML(items) {
  return items.map(it => {
    if (it === '-') return '<div class="mdiv" role="separator"></div>';
    const adm = it.admin && !can(it.admin.k) ? ` data-admin="${esc(it.admin.label)}" aria-disabled="true"` : '';
    const act = it.act ? ` data-act="${it.act}"` : '';
    const cls = ['mi', it.danger ? 'danger' : '', adm ? 'locked' : ''].join(' ');
    return `<button type="button" class="${cls}" role="menuitem"${act}${attrs(it.data)}${adm}>${it.icon ? ic(it.icon) : ''}<span>${esc(it.label)}</span>${it.note ? `<span class="r">${esc(it.note)}</span>` : ''}</button>`;
  }).join('');
}
function menu(anchor, items, label = 'Actions') {
  const L = layer({
    cls: 'layer-menu', label, dismiss: true,
    html: `<div class="menu-list" role="menu">${menuHTML(items)}</div>`,
    onMount: (panel) => {
      if (isPhone()) return;
      const r = anchor.getBoundingClientRect();
      panel.style.top = Math.min(r.bottom + 6, window.innerHeight - 40) + 'px';
      panel.style.left = Math.max(12, Math.min(r.right - 260, window.innerWidth - 280)) + 'px';
    },
  });
  L.el.addEventListener('click', e => { if (e.target.closest('.mi') && !e.target.closest('[aria-disabled="true"]')) closeLayer(L); });
  return L;
}

/* Confirmation with a plain statement of impact. text, impact and note are markup:
   escape any name with esc() before passing it in. */
function confirmDialog({ title, text, impact = '', cta, danger = false, act, data = {}, note = '' }) {
  return layer({
    label: title,
    html: `<div class="dlg-head"><div class="tt2"><h2>${esc(title)}</h2><p>${text}</p></div><button class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      ${impact ? `<div class="notice ${danger ? 'danger' : 'warn'}">${ic('alert')}<div>${impact}</div></div>` : ''}
      ${note ? `<p class="hint">${note}</p>` : ''}
      <div class="dlg-foot"><button class="btn btn-soft" data-act="close">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="${act}"${attrs(data)}>${esc(cta)}</button></div>`,
  });
}

/* ---------- Toasts ---------- */
function toast(msg, { icon = 'check', tone = '', action = null, ms = 4200 } = {}) {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + tone + (action ? ' has-action' : '');
  t.innerHTML = `${ic(icon)}<span>${esc(msg)}</span>${action ? `<button type="button" data-act="${action.act}"${attrs(action.data)}>${esc(action.label)}</button>` : ''}`;
  box.appendChild(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 220); }, ms);
  return t;
}
on('dismiss-toast', (d, el) => el.closest('.toast').remove());

/* ---------- Routing ---------- */
const VIEWS = {};  // name -> { html(r), mount(r, el) }
/* Split first, then decode each part: an id may contain an encoded "/" or "?", and a bad
   escape in a pasted address must never break the page. */
const unesc = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };
function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const p = path.split('/').filter(Boolean).map(unesc);
  const q = Object.fromEntries(new URLSearchParams(qs));
  if (!p.length || p[0] === 'today') return { name: 'today', q };
  switch (p[0]) {
    case 'areas': return p[1] ? { name: 'area', id: p[1], q } : { name: 'areas', q };
    case 'flagged': case 'recent': case 'deleted': case 'account': case 'signin': case 'reset': return { name: p[0], q };
    case 'new-member': return { name: 'newmember', q };
    case 'mom': return { name: 'mom', id: p[1], q };
    case 's': return { name: 'shared', kind: p[1], id: p[2], q };
  }
  return { name: 'missing', q };
}
/* Where this viewer must go instead, or null. */
function guard(r) {
  const role = sessionRole();
  if (role === 'loading') return null;
  if (role === 'signedout') return ['signin', 'reset'].includes(r.name) || r.name === 'shared' ? null : '#/signin';   // shared: anonymous sign-in is on its way
  if (role === 'newmember') return ['newmember', 'account', 'shared'].includes(r.name) ? null : '#/new-member';
  if (role === 'visitor') return r.name === 'shared' ? null : (UI.sharedHome || '#/signin');
  if (['signin', 'reset', 'newmember'].includes(r.name)) return '#/today';
  return null;
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function back() {
  if (LAYERS.length) return closeTop();
  if (history.length > 1 && document.referrer !== '') history.back(); else go('#/today');
}
/* Addresses from the old app keep working (they live in emails and bookmarks):
   ?folder=X ?doc=X ?mom=X (share links), #f=X&... (a folder), #m=X (a MoM).
   Returns the new address, or null when the address is already current. */
function legacyAddress(loc) {
  const enc = encodeURIComponent;
  const q = new URLSearchParams(loc.search);
  if (q.has('folder')) return loc.pathname + '#/s/a/' + enc(q.get('folder'));
  if (q.has('doc')) return loc.pathname + '#/s/f/' + enc(q.get('doc'));
  if (q.has('mom')) return loc.pathname + '#/s/m/' + enc(q.get('mom'));
  if (loc.hash && !loc.hash.startsWith('#/')) {
    const p = {};
    loc.hash.slice(1).split('&').forEach(s => { const i = s.indexOf('='); if (i > 0) { try { p[s.slice(0, i)] = decodeURIComponent(s.slice(i + 1)); } catch (e) { /* bad escape: ignore this part */ } } });
    if (p.m) return loc.pathname + '#/mom/' + enc(p.m);
    if (p.f) return loc.pathname + '#/areas/' + enc(p.f);
  }
  return null;
}

/* ---------- Rendering ---------- */
/* Run a re-render of the side, top and tab bars without losing the keyboard's place. */
function keepFocus(fn) {
  const el = document.activeElement;
  const host = el && el !== document.body ? el.closest('#side, .topbar, #tabbar') : null;
  let sel = null;
  if (host) {
    const act = el.getAttribute('data-act'), id = el.getAttribute('data-id'), href = el.getAttribute('href');
    if (act) sel = `[data-act="${CSS.escape(act)}"]` + (id ? `[data-id="${CSS.escape(id)}"]` : '');
    else if (href) sel = `a[href="${CSS.escape(href)}"]`;
  }
  fn();
  if (sel) { const n = $(sel, host); if (n) n.focus({ preventScroll: true }); }
}
const PLACEHOLDER = { html: r => `<div class="page"><p class="hint">${ic('info', 'sm')}This screen isn't built yet (${esc(r.name)}).</p></div>` };
function render({ keepView = false } = {}) {
  if (!UI.booted) return;
  const r = route();
  const role = sessionRole();
  const redirect = guard(r);
  if (redirect) { location.replace(redirect); return; }
  if (role === 'visitor' && r.name === 'shared') UI.sharedHome = location.hash;
  const bare = ['signin', 'reset', 'newmember'].includes(r.name) || role === 'loading';
  const shared = r.name === 'shared' || role === 'visitor';
  const waiting = !bare && !dataLoaded();
  document.body.dataset.route = r.name;
  document.body.classList.toggle('bare', bare);
  document.body.classList.toggle('visitor', shared);
  document.body.classList.toggle('route-mom', r.name === 'mom');
  document.body.classList.toggle('offline', syncState() === 'offline');
  document.body.classList.toggle('selecting', UI.selMode);
  const key = r.name + ':' + (r.id || '');
  const changed = key !== UI.lastKey;
  if (!bare && !shared && !waiting) keepFocus(() => renderShell(r));
  else { $('#side').innerHTML = ''; $('.topbar').innerHTML = ''; $('#tabbar').innerHTML = ''; }
  const el = $('#view');
  if (!changed && keepView && !waiting) { renderBanners(); return; }
  if (waiting || role === 'loading') el.innerHTML = skeletonHTML();
  else {
    const v = VIEWS[r.name] || VIEWS.missing || PLACEHOLDER;
    el.innerHTML = v.html(r);
    v.mount && v.mount(r, el);
  }
  if (changed) {
    window.scrollTo({ top: 0 });
    if (UI.lastKey) el.focus({ preventScroll: true });   // screen readers land on the new page
    UI.lastKey = key;
  }
  renderBanners();
}
/* Store events arrive in bursts at start-up; draw once per frame. */
let _frame = 0;
function scheduleRender() {
  if (_frame || !UI.booted) return;
  _frame = requestAnimationFrame(() => { _frame = 0; render({ keepView: route().name === 'mom' }); });
}
function skeletonHTML() {
  return `<div class="page" aria-busy="true" aria-label="Loading"><div class="skel skel-title"></div><div class="skel skel-line"></div><div class="cards skel-cards"><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div></div></div>`;
}

/* Sync status (S3). "short" is what the top bar shows; "text" is the tooltip and screen-reader text.
   Store.sync ('ok' | 'catchup' | 'offline') comes from the data layer; until it exists the
   browser's own online flag decides. */
function syncState() {
  const s = Store.sync;
  if (s === 'ok' || s === 'catchup' || s === 'offline') return s;
  return navigator.onLine === false ? 'offline' : 'ok';
}
function syncInfo() {
  const s = syncState();
  if (s === 'offline') return { cls: 'offline', text: 'No connection. Changes are kept on this device.', short: 'Offline' };
  if (s === 'catchup') return { cls: 'catching', text: 'Catching up on changes from your team', short: 'Catching up' };
  return { cls: '', text: 'Connected and up to date', short: 'Up to date' };
}
function renderBanners() {
  const b = [];
  const s = syncState();
  if (s === 'offline') b.push(`<div class="banner offline" role="status">${ic('cloud-off')}<span>You're offline. What's on screen stays readable; changes save here and sync when you reconnect.</span></div>`);
  if (UI.update) b.push(`<div class="banner update" role="status">${ic('refresh')}<span>A new version of ${esc(APP_NAME)} is ready.</span><button class="btn btn-primary" data-act="reload">Refresh to update</button></div>`);
  if (s === 'catchup') b.push(`<div class="banner sync" role="status">${ic('loader')}<span>Catching up on changes from your team…</span></div>`);
  $('#banners').innerHTML = b.join('');
}
on('reload', () => { if (UI.onRefresh) UI.onRefresh(); else location.reload(); });

/* ---------- Keyboard ---------- */
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  const k = (e.key || '').toLowerCase();
  if (mod && k === 'k') { e.preventDefault(); ACT.palette && ACT.palette({}); return; }
  if (mod && k === 's') { e.preventDefault(); KEYS.save && KEYS.save(); return; }
  if (e.key === 'Tab' && LAYERS.length) { trapTab(e); return; }
  if (e.key === 'Escape') {
    if (LAYERS.length) { e.preventDefault(); closeTop(); return; }
    KEYS.escape && KEYS.escape();
  }
});

/* ---------- Store events and boot ---------- */
Store.onChange(what => {
  if (what === 'role' || what === 'guest') UI.roleReady = true;
  if (what === 'access' || what === 'guest') UI.accessReady = true;
  if (what === 'error') console.error('A live listener failed');
  if (what !== 'users') scheduleRender();
});
/* Called once, by the last script on the page, after every view file has registered. */
function boot() {
  if (UI.booted) return;
  const legacy = legacyAddress(location);
  if (legacy) { location.replace(legacy); return; }
  UI.booted = true;
  auth.onAuthStateChanged(u => {
    UI.authReady = true;
    if (!u) { UI.roleReady = false; UI.accessReady = false; } else startListeners();
    scheduleRender();
  });
  startSession();
  window.addEventListener('hashchange', () => render());
  window.addEventListener('offline', () => { UI.wasOffline = true; scheduleRender(); });
  window.addEventListener('online', () => {
    scheduleRender();
    if (UI.wasOffline) { UI.wasOffline = false; toast('Back online. Changes are syncing.', { icon: 'cloud-check' }); }
  });
  if (!location.hash) history.replaceState(null, '', '#/today');
  render();
}
