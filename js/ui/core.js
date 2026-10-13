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
  const u = signedInUser();
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
const chainOf = id => areaChain(id);
const groupName = id => (MF.find(g => g.id === id) || DF.find(g => g.id === id) || {}).name || '';
function descIds(id) {
  const out = [id], seen = new Set(out);
  (function walk(p) { kids(p).forEach(k => { if (seen.has(k.id)) return; seen.add(k.id); out.push(k.id); walk(k.id); }); })(id);
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
const KEYMAP = {};   // per-field keys, by data-key: onKey('name', (e, el) => ...)
const onKey = (name, fn) => reg(KEYMAP, 'Key', name, fn);
const reg = (table, kind, name, fn) => { if (table[name]) console.warn(`${kind} "${name}" is registered twice`); table[name] = fn; };
const on = (name, fn) => reg(ACT, 'Action', name, fn);
const onForm = (name, fn) => reg(FORMS, 'Form', name, fn);
const onInput = (name, fn) => reg(INPUTS, 'Input', name, fn);

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act], [data-admin], [data-final]');
  if (!el) return;
  if (el.hasAttribute('data-final') && el.getAttribute('aria-disabled') === 'true') {
    e.preventDefault();
    toast('This is marked final, so it can\'t be changed.', { icon: 'alert', tone: 'warn' });
    return;
  }
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
document.addEventListener('mousedown', e => {
  if (e.target.closest && e.target.closest('[data-keepfocus] button')) e.preventDefault();
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
  const frame = document.createElement('div');
  frame.innerHTML = layerFrameHTML({ cls, label, html, dismiss });
  const wrap = frame.firstElementChild;
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
  const done = () => {
    L.el.remove(); L.onClose && L.onClose();
    // Hand the focus back to what opened this layer, unless a newer layer (a dialog opened from this menu) already has it.
    const a = document.activeElement;
    const elsewhere = a && a !== document.body && LAYERS.some(x => x.el.contains(a));
    if (!elsewhere && L.prev && L.prev.focus && document.body.contains(L.prev)) L.prev.focus({ preventScroll: true });
  };
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
    const cls = ['mi', it.danger ? 'danger' : ''].filter(Boolean).join(' ');   /* greyed by aria-disabled, not a class: .locked is the restricted gate */
    return `<button type="button" class="${cls}" role="menuitem"${act}${attrs(it.data)}${adm}>${it.icon ? ic(it.icon) : ''}<span>${esc(it.label)}</span>${it.note ? `<span class="r">${esc(it.note)}</span>` : ''}</button>`;
  }).join('');
}
function menu(anchor, items, label = 'Actions') {
  const L = layer({
    cls: 'layer-menu', label, dismiss: true,
    html: `<div class="menu-list" role="menu">${menuHTML(items)}</div>`,
    onMount: (panel) => {
      if (isPhone()) return;
      const r = anchor.getBoundingClientRect(), vh = window.innerHeight;
      const h = Math.min(panel.offsetHeight, vh - 16);
      let top = r.bottom + 6;                                        // below its button
      if (top + h > vh - 8) top = r.top - 6 - h;                     // else above it
      top = Math.max(8, Math.min(top, vh - 8 - h));                  // and always inside the window
      panel.style.top = top + 'px';
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
  const frame = document.createElement('div');
  frame.innerHTML = toastHTML({ msg, icon, tone, action });
  const t = frame.firstElementChild;
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
/* A page that repaints in place (the filter, a sort, a data change) keeps the keyboard's place:
   the field with its caret, or the control that was focused. */
function viewFocus() {
  const el = document.activeElement, view = $('#view');
  if (!el || el === document.body || !view || !view.contains(el)) return null;
  const sel = ['data-input', 'data-act'].map(a => el.hasAttribute(a) ? `[${a}="${CSS.escape(el.getAttribute(a))}"]` : '').find(Boolean);
  if (!sel) return null;
  const extra = ['data-key', 'data-v', 'data-id'].map(a => el.hasAttribute(a) ? `[${a}="${CSS.escape(el.getAttribute(a))}"]` : '').join('');
  return { sel: sel + extra, start: el.selectionStart, end: el.selectionEnd };
}
function restoreViewFocus(k) {
  const n = $(k.sel, $('#view')); if (!n) return;
  n.focus({ preventScroll: true });
  if (k.start != null && n.setSelectionRange) { try { n.setSelectionRange(k.start, k.end); } catch (e) { /* not a text field */ } }
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
  const key = r.name + ':' + (r.id || '');
  const changed = key !== UI.lastKey;
  if (changed && UI.lastKey) { UI.filter = ''; UI.selMode = false; UI.sel.clear(); }   // a new page starts clean
  document.body.dataset.route = r.name;
  document.body.classList.toggle('bare', bare);
  document.body.classList.toggle('visitor', shared);
  document.body.classList.toggle('route-mom', r.name === 'mom');
  document.body.classList.toggle('offline', syncState() === 'offline');
  document.body.classList.toggle('selecting', UI.selMode);
  if (!bare && !shared && !waiting) keepFocus(() => renderShell(r));
  else { $('#side').innerHTML = ''; $('.topbar').innerHTML = ''; $('#tabbar').innerHTML = ''; }
  const el = $('#view');
  if (!changed && keepView && !waiting && UI.shownKey === key) { renderBanners(); return; }
  if (UI.mounted && UI.mounted.unmount) { const m = UI.mounted; UI.mounted = null; m.unmount(); }
  UI.mounted = null; UI.shownKey = '';
  const v = VIEWS[r.name] || VIEWS.missing || PLACEHOLDER;
  const html = waiting || role === 'loading' ? null : v.html(r);
  const kept = !changed && html != null ? viewFocus() : null;
  if (html == null) el.innerHTML = skeletonHTML();   // loading, or the view isn't ready yet
  else {
    el.innerHTML = html;
    UI.shownKey = key; UI.mounted = v;
    v.mount && v.mount(r, el);
  }
  if (kept) restoreViewFocus(kept);
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
   Store.sync ('ok' | 'catchup' | 'offline') comes from the data layer (store.js); the online
   flag is only a fallback if it is ever missing. */
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
  if (s === 'offline') b.push(bannerHTML({ kind: 'offline', text: 'You\'re offline. What\'s on screen stays readable; changes save here and sync when you reconnect.' }));
  if (UI.update) b.push(bannerHTML({ kind: 'update', text: `A new version of ${APP_NAME} is ready.`, action: { act: 'reload', label: 'Refresh to update' } }));
  if (s === 'catchup') b.push(bannerHTML({ kind: 'sync', text: 'Catching up on changes from your team…' }));
  $('#banners').innerHTML = b.join('');
}
/* The page's one file input (#fileInput). Whoever opens it sets UI.onFiles first. */
function pickFiles(fn, accept = '') {
  const input = $('#fileInput');
  if (!input) return;
  UI.onFiles = fn;
  if (accept) input.setAttribute('accept', accept); else input.removeAttribute('accept');
  input.click();
}
onInput('file-picked', el => { const fn = UI.onFiles; UI.onFiles = null; const files = Array.from(el.files || []); el.value = ''; if (fn && files.length) fn(files); });
/* Show or hide a password. data-for is the input's id. */
on('pw-toggle', (d, el) => {
  const input = document.getElementById(d.for);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  el.setAttribute('aria-pressed', String(show));
  el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  el.innerHTML = ic(show ? 'eye-off' : 'eye');
});
on('reload', () => { if (UI.onRefresh) UI.onRefresh(); else location.reload(); });

/* ---------- Keyboard ---------- */
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  const k = (e.key || '').toLowerCase();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="checkbox"][data-act]')) { e.preventDefault(); e.target.click(); return; }
  if (mod && k === 'k') { e.preventDefault(); ACT.palette && ACT.palette({}); return; }
  if (mod && k === 's') { e.preventDefault(); KEYS.save && KEYS.save(); return; }
  if (e.key === 'Tab' && LAYERS.length) { trapTab(e); return; }
  if (e.key === 'Escape') {
    if (LAYERS.length) { e.preventDefault(); closeTop(); return; }
    if (e.defaultPrevented) return;
    KEYS.escape && KEYS.escape();
  }
  const kn = e.target && e.target.dataset && e.target.dataset.key;
  if (kn && KEYMAP[kn]) KEYMAP[kn](e, e.target);
});

/* ---------- Components (Phase 3): pure builders. Data in, markup out; no store reads, no inline
   styles, no inline handlers. Screens (Phase 4+) and dev/gallery.html call these. ---------- */
const KINDS = {
  pdf: { label: 'PDF', icon: 'pdf', ext: 'PDF', tile: 'k-pdf' },
  image: { label: 'Image', icon: 'image', ext: 'IMG', tile: 'k-image' },
  video: { label: 'Video', icon: 'video', ext: 'MP4', tile: 'k-video' },
  sheet: { label: 'Spreadsheet', icon: 'sheet', ext: 'XLSX', tile: 'k-sheet' },
  slides: { label: 'Presentation', icon: 'slides', ext: 'SLIDES', tile: 'k-slides' },
  link: { label: 'Web link', icon: 'globe', ext: 'LINK', tile: 'k-link' },
  other: { label: 'Other', icon: 'doc', ext: 'FILE', tile: 'k-other' },
};
/* The six kinds offered when saving a link, with the names the link dialog uses. */
const LINK_KINDS = [['link', 'Web link'], ['slides', 'Presentation'], ['pdf', 'PDF / document'], ['sheet', 'Spreadsheet'], ['image', 'Image'], ['other', 'Other']];
const EMOJIS = ['🏢', '🌿', '📦', '📈', '⚓', '🏥', '🎯', '👥', '🗓️', '💡', '🚀', '🧪', '🌱', '🛠️', '📚', '🧭', '🎨', '🔬', '💼', '🧾', '🏠', '🌍', '📣', '🧩'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmtDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const todayISO = () => { const t = new Date(); return [t.getFullYear(), String(t.getMonth() + 1).padStart(2, '0'), String(t.getDate()).padStart(2, '0')].join('-'); };
const daysSince = iso => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(); return Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(y, m - 1, d)) / 864e5); };
const relDate = iso => { if (!iso) return ''; const n = daysSince(iso); if (n <= 0) return 'Today'; if (n === 1) return 'Yesterday'; if (n < 7) return `${n} days ago`; return fmtDate(iso); };
const fmtSize = b => (b == null ? '' : b < 1024 * 1024 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1024 / 1024).toFixed(1).replace('.0', '') + ' MB');
/* Which kind a link is, from its address. */
function guessKind(addr) {
  const a = (addr || '').toLowerCase();
  if (a.includes('presentation') || a.includes('slides') || a.endsWith('.pptx')) return 'slides';
  if (a.includes('spreadsheets') || a.includes('sheets') || a.endsWith('.xlsx')) return 'sheet';
  if (a.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(a)) return 'image';
  return 'link';
}
/* The signed-in account, or null (the gallery and the sign-in screen have none). */
const signedInUser = () => (typeof auth !== 'undefined' && auth ? auth.currentUser : null);
const descFor = (id, error, hint) => [error ? `${id}-err` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ');

/* 3.1 Buttons */
function btnHTML({ kind = 'soft', label, icon = '', sm = false, busy = false, disabled = false, act = '', data = {}, type = 'button', href = '' }) {
  const cls = [kind === 'link' ? 'link-btn' : `btn btn-${kind}`, sm ? 'btn-sm' : '', busy ? 'is-busy' : ''].filter(Boolean).join(' ');
  const lead = busy ? ic('loader', 'sm') : (icon ? ic(icon, 'sm') : '');
  if (href) return `<a class="${cls}" href="${esc(href)}"${attrs(data)}>${lead}${esc(label)}</a>`;
  return `<button type="${type}" class="${cls}"${disabled ? ' disabled' : ''}${act ? ` data-act="${act}"` : ''}${attrs(data)}${busy ? ' aria-busy="true"' : ''}>${lead}${esc(label)}</button>`;
}
/* A button shows its busy state (spinner, aria-busy) without changing its label. */
function busy(btn, on) { btn.classList.toggle('is-busy', !!on); if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy'); }
function iconBtnHTML({ icon, label, pressed = null, sm = false, act = '', data = {}, disabled = false }) {
  return `<button type="button" class="icon-btn${sm ? ' sm' : ''}" aria-label="${esc(label)}"${pressed === null ? '' : ` aria-pressed="${!!pressed}"`}${act ? ` data-act="${act}"` : ''}${attrs(data)}${disabled ? ' disabled' : ''}>${ic(icon, sm ? 'sm' : '')}</button>`;
}
function splitNewHTML(p) {
  return `<div class="split" role="group" aria-label="New"><button class="split-main" type="button" data-act="new-mom" data-area="${esc(p ? p.area : '')}" data-group="${esc(p && p.group ? p.group : '')}">${ic('plus', 'sm')}<span>New MoM</span></button><button class="split-caret" type="button" data-act="new-menu" aria-label="More ways to create" aria-haspopup="menu">${ic('chev-d', 'sm')}</button></div>`;
}
function quickTileHTML({ primary = false, icon, title, sub, act = '', data = {}, disabled = false, href = '' }) {
  const cls = `qtile${primary ? ' primary' : ''}`;
  const body = `<span class="qi">${ic(icon)}</span><span><b>${esc(title)}</b><small>${esc(sub)}</small></span>`;
  if (href) return `<a class="${cls}" href="${esc(href)}">${body}</a>`;
  return `<button type="button" class="${cls}"${disabled ? ' disabled' : ''}${act ? ` data-act="${act}"` : ''}${attrs(data)}>${body}</button>`;
}

/* 3.2 Inputs */
function fieldHTML({ id, label, control, required = false, error = '', hint = '' }) {
  return `<div class="field${error ? ' err' : ''}" id="${id}-field"><label class="lab" for="${id}">${esc(label)}${required ? ' <em>required</em>' : ''}</label>${control}${error ? `<span class="ferr" role="alert" id="${id}-err">${ic('alert', 'sm')}${esc(error)}</span>` : ''}${hint ? `<div class="hcopy" id="${id}-hint">${esc(hint)}</div>` : ''}</div>`;
}
function inputHTML({ id, name = id, type = 'text', value = '', placeholder = '', autocomplete = 'off', error = '', hint = '', inputmode = '' }) {
  const desc = descFor(id, error, hint);
  return `<input class="input" id="${id}" name="${esc(name)}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="${autocomplete}"${inputmode ? ` inputmode="${inputmode}"` : ''}${error ? ' aria-invalid="true"' : ''}${desc ? ` aria-describedby="${desc}"` : ''}>`;
}
function textareaHTML({ id, name = id, value = '', placeholder = '', error = '', hint = '', rows = 4 }) {
  const desc = descFor(id, error, hint);
  return `<textarea class="textarea" id="${id}" name="${esc(name)}" rows="${rows}" placeholder="${esc(placeholder)}"${error ? ' aria-invalid="true"' : ''}${desc ? ` aria-describedby="${desc}"` : ''}>${esc(value)}</textarea>`;
}
function selectHTML({ id, name = id, options, value = '', error = '', hint = '' }) {
  const desc = descFor(id, error, hint);
  return `<select class="select" id="${id}" name="${esc(name)}"${error ? ' aria-invalid="true"' : ''}${desc ? ` aria-describedby="${desc}"` : ''}>${options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
}
/* strength: 0–4 for the restriction meter (0 = empty). */
function pwFieldHTML({ id, label, value = '', hint = '', error = '', meter = false, strength = 0, required = false }) {
  const control = `<div class="pw-row">${inputHTML({ id, type: 'password', value, autocomplete: 'new-password', error, hint })}<button type="button" class="icon-btn" aria-label="Show password" aria-pressed="false" data-act="pw-toggle" data-for="${id}">${ic('eye')}</button></div>${meter ? `<div class="pw-meter" aria-hidden="true"><i class="s${strength}"></i></div>` : ''}`;
  return fieldHTML({ id, label, control, required, error, hint });
}
function searchInHTML({ value = '', label = 'Filter this area', placeholder = 'Filter this area' }) {
  return `<div class="search-wrap"><label class="search-in"><span class="sr">${esc(label)}</span>${ic('search', 'sm')}<input type="search" data-input="filter" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"></label>${value ? `<button type="button" class="icon-btn sm search-clear" data-act="clear-filter" aria-label="Clear filter">${ic('x', 'sm')}</button>` : ''}</div>`;
}
/* The date in the MoM header: a chip that opens the device's own date picker. */
function dateChipHTML({ id, value, disabled = false, change = '' }) {
  return `<button type="button" class="mchip" data-act="pick-date" data-for="${id}"${disabled ? ' disabled' : ''} aria-label="Meeting date, ${fmtDate(value)}. Change date">${ic('calendar', 'sm')}<span>${fmtDate(value)}</span></button><input type="date" id="${id}" class="sr" tabindex="-1" aria-hidden="true" value="${esc(value)}"${change ? ` data-change="${change}"` : ''}>`;
}
/* The chip opens the device's own date picker. */
on('pick-date', d => { const i = document.getElementById(d.for); if (!i) return; try { i.showPicker(); } catch (e) { i.focus(); i.click(); } });
/* Tags in the MoM header: each removable, plus an input to add one. */
function tagsEditHTML({ tags, canEdit = true, id = 'tagIn' }) {
  return `<div class="tags">${tags.map(t => `<span class="mchip tagc">#${esc(t)}<button type="button" data-act="tag-remove" data-t="${esc(t)}" aria-label="Remove tag ${esc(t)}">${ic('x', 'sm')}</button></span>`).join('')}${canEdit ? `<input class="tag-add" id="${id}" placeholder="Add tag" aria-label="Add a tag" autocomplete="off">` : ''}</div>`;
}
function emojiGridHTML({ name, label, selected = '', emojis = EMOJIS }) {
  return `<div class="field"><span class="lab" id="${name}-lab">${esc(label)}</span><div class="emoji-grid" role="radiogroup" aria-labelledby="${name}-lab">${emojis.map(e => `<button type="button" role="radio" aria-checked="${e === selected}" data-act="pick-emoji" data-e="${esc(e)}" aria-label="${esc(e)}">${esc(e)}</button>`).join('')}</div></div>`;
}
function kindTilesHTML({ selected = 'link' }) {
  return `<div class="field"><span class="lab" id="kindLab">Kind</span><div class="kinds" role="radiogroup" aria-labelledby="kindLab">${LINK_KINDS.map(([k, label]) => `<button type="button" role="radio" class="kind" aria-checked="${k === selected}" data-act="pick-kind" data-k="${k}"><span class="ktile ${KINDS[k].tile}">${ic(KINDS[k].icon, 'sm')}</span>${esc(label)}</button>`).join('')}</div></div>`;
}

/* 3.3 Chips and pills */
const tagHTML = t => `<span class="tag">#${esc(t)}</span>`;
function placeChipHTML(name) {
  return `<button type="button" class="place-chip" data-act="pick-place" aria-label="Change where new items go">${ic('folder-plus', 'sm')}<span>${esc(name)}</span>${ic('chev-d', 'sm')}</button>`;
}
/* Save status for the open MoM and dialogs. kind: saving | saved | local | failed. */
function statusPillHTML(kind) {
  const map = { saving: ['saving', 'loader', 'Saving…'], saved: ['', 'cloud-check', 'Saved'], local: ['local', 'cloud-off', 'Saved on this device'], failed: ['failed', 'alert', 'Couldn’t save'] };
  const [cls, icon, text] = map[kind];
  return `<span class="status-pill${cls ? ' ' + cls : ''} js-status" role="status" aria-live="polite">${ic(icon, 'sm')}${esc(text)}${kind === 'failed' ? ' <button type="button" class="link-btn" data-act="retry-save">Retry</button>' : ''}</span>`;
}
/* info comes from syncInfo() in this file: { cls, short, text }. */
function syncPillHTML(info) {
  return `<span class="sync ${info.cls}" role="status" title="${esc(info.text)}"><span class="dot" aria-hidden="true"></span><span>${esc(info.short)}</span></span>`;
}
function lockPillHTML({ open = false, id = '' }) {
  return open
    ? `<span class="lock-pill open">${ic('unlock', 'sm')}Open for this session · <button type="button" class="link-btn" data-act="relock"${id ? ` data-id="${esc(id)}"` : ''}>Lock again</button></span>`
    : `<span class="lock-pill">${ic('lock', 'sm')}Restricted</span>`;
}
const finalMarkHTML = () => `<span class="finalmark">${ic('lock', 'sm')}Final</span>`;
const restrictMarkHTML = () => `<span class="restrictmark">${ic('lock', 'sm')}Restricted</span>`;
const flagMarkHTML = () => `<span class="flagmark" role="img" aria-label="Flagged">${ic('flag-fill', 'sm')}</span>`;
const readOnlyPillHTML = () => `<span class="readonly-pill">${ic('eye', 'sm')}Read only</span>`;
const edReadOnlyHTML = () => `<span class="ed-readonly">${ic('lock', 'sm')}Final · read only</span>`;
const rolePillHTML = role => `<span class="pill-role">${esc(role)}</span>`;

/* 3.4 Cards and rows */
function selBoxHTML({ key, label, checked = false }) {
  return `<span class="sel-box" role="checkbox" aria-checked="${!!checked}" data-act="sel" data-key="${esc(key)}" tabindex="0" aria-label="Select ${esc(label)}">${checked ? ic('check') : ''}</span>`;
}
function areaCardHTML({ id, name, emoji, tint, moms = 0, files = 0, locked = false, kids = [], selectable = false, selected = false }) {
  const body = `<a class="acard" href="${areaHref(id)}"${selectable ? ` data-act="sel-card" data-key="a:${esc(id)}"` : ''}><span class="acard-top"><span class="blob ${esc(tint)}">${esc(emoji)}</span><span class="acard-id"><span class="n">${esc(name)}</span>${locked ? restrictMarkHTML() : `<span class="c">${plural(moms, 'MoM')} · ${plural(files, 'file')}</span>`}</span></span><span class="kids">${kids.slice(0, 4).map(k => `<span class="kid">${esc(k.emoji)} ${esc(k.name)}</span>`).join('')}${kids.length > 4 ? `<span class="kid">+${kids.length - 4}</span>` : ''}</span></a>`;
  return selectable ? `<div class="cw${selected ? ' is-selected' : ''}">${selBoxHTML({ key: 'a:' + id, label: name, checked: selected })}${body}</div>` : body;
}
function subCardHTML({ id, name, emoji, tint, moms = 0, files = 0, locked = false, selectable = false, selected = false }) {
  const body = `<a class="subcard" href="${areaHref(id)}"${selectable ? ` data-act="sel-card" data-key="a:${esc(id)}"` : ''}><span class="blob ${esc(tint)}">${esc(emoji)}</span><span><b>${esc(name)}</b><small>${locked ? ic('lock', 'sm') + 'Restricted' : `${plural(moms, 'MoM')} · ${plural(files, 'file')}`}</small></span></a>`;
  return selectable ? `<div class="cw${selected ? ' is-selected' : ''}">${selBoxHTML({ key: 'a:' + id, label: name, checked: selected })}${body}</div>` : body;
}
/* Admin only: a member sees it greyed, and a click says so. */
function newSubCardHTML({ parentId }) {
  return `<button type="button" class="subcard new-card" data-act="new-area" data-parent="${esc(parentId)}"${adminAttr('createArea', 'create sub-areas')}>${ic('plus', 'sm')}New sub-area</button>`;
}
function momCardHTML({ id, title, date = '', flagged = false, final = false, preview = '', tags = [], selectable = false, selected = false }) {
  const sel = selectable ? selBoxHTML({ key: 'm:' + id, label: title, checked: selected }) : '';
  const card = `<a class="mcard" href="#/mom/${esc(id)}"${selectable ? ` data-act="sel-card" data-key="m:${esc(id)}"` : ''}><span class="d">${flagged ? flagMarkHTML() : ''}${ic('calendar', 'sm')}${esc(relDate(date))}${final ? ' ' + finalMarkHTML() : ''}</span><span class="t">${esc(title)}</span><span class="s">${esc(preview)}</span>${tags.length ? `<span class="tags">${tags.map(tagHTML).join('')}</span>` : ''}</a>`;
  const more = `<button type="button" class="more" data-act="item-menu" data-kind="m" data-id="${esc(id)}" aria-label="More for ${esc(title)}" aria-haspopup="menu">${ic('more', 'sm')}</button>`;
  return `<div class="cw${selected ? ' is-selected' : ''}">${sel}${card}${more}</div>`;
}
/* A file tile. Restricted: lock over the tile, the note hidden. */
function fileTileHTML({ id, name, kind, note = '', locked = false, flagged = false, final = false, thumb = '', selectable = false, selected = false }) {
  const k = KINDS[kind];
  const sel = selectable ? selBoxHTML({ key: 'f:' + id, label: name, checked: selected }) : '';
  const img = thumb && !locked ? `<img src="${esc(thumb)}" alt="" loading="lazy">` : '';
  const big = locked ? `<span class="lockbig">${ic('lock', 'xl')}</span>` : `<span class="big-ic">${ic(k.icon, 'lg')}</span>`;
  const media = `<span class="thumb ${locked ? '' : k.tile}">${img}${big}<span class="ext">${k.ext}</span>${flagged ? flagMarkHTML() : ''}${final ? finalMarkHTML() : ''}</span>`;
  const text = `<span class="fbody"><span class="t">${esc(name)}</span><span class="p">${locked ? 'Restricted · note hidden' : esc(note || k.label)}</span></span>`;
  return `<div class="cw${selected ? ' is-selected' : ''}">${sel}<button type="button" class="ftile" ${selectable ? `data-act="sel-card" data-key="f:${esc(id)}"` : `data-act="open-file" data-id="${esc(id)}"`} aria-label="${esc(name)}, ${k.label}">${media}${text}</button><button type="button" class="more on-thumb" data-act="item-menu" data-kind="f" data-id="${esc(id)}" aria-label="More for ${esc(name)}" aria-haspopup="menu">${ic('more', 'sm')}</button></div>`;
}
function fileRowHTML({ id, name, kind, note = '', size = 0, date = '', locked = false, flagged = false, final = false, selectable = false, selected = false }) {
  const k = KINDS[kind];
  const sel = selectable ? selBoxHTML({ key: 'f:' + id, label: name, checked: selected }) : '';
  const meta = [locked ? 'Restricted' : note, size ? fmtSize(size) : '', date ? fmtDate(date) : ''].filter(Boolean).join(' · ');
  return `<div class="cw${selected ? ' is-selected' : ''}">${sel}<button type="button" class="row" ${selectable ? `data-act="sel-card" data-key="f:${esc(id)}"` : `data-act="open-file" data-id="${esc(id)}"`}><span class="ktile ${k.tile}">${ic(k.icon)}</span><span class="mid"><span class="t">${flagged ? ic('flag-fill', 'sm') : ''}${esc(name)}</span><span class="p">${k.label} · ${esc(meta)}</span></span>${final ? finalMarkHTML() : ''}</button></div>`;
}
/* A row in a list (Flagged, Recent, Today). Shows where the item lives. */
function itemRowHTML({ href, tile = 'k-other', icon = 'doc', emoji = '', title, where = '', meta = '', flagged = false, final = false, restricted = false, right = '', act = '', data = {} }) {
  return `<a class="row" href="${esc(href)}"${act ? ` data-act="${act}"` : ''}${attrs(data)}><span class="ktile ${tile}"${emoji ? ' aria-hidden="true"' : ''}>${emoji ? esc(emoji) : ic(icon)}</span><span class="mid"><span class="t">${flagged ? flagMarkHTML() : ''}${esc(title)}</span><span class="p">${esc(where)}${meta ? ' · ' + esc(meta) : ''}</span></span>${restricted ? restrictMarkHTML() : ''}${final ? finalMarkHTML() : ''}${right}</a>`;
}
function continueCardHTML({ href, tile = 'k-other', icon = 'doc', title, where = '', act = '', data = {} }) {
  return `<a class="ccard" href="${esc(href)}"${act ? ` data-act="${act}"` : ''}${attrs(data)}><span class="ktile ${tile}">${ic(icon)}</span><span class="t">${esc(title)}</span><span class="p">${esc(where)}</span></a>`;
}

/* 3.5 Grouping shelf and permissions */
/* body: the cards or rows, or emptyHTML({ small: true }) when count is 0. */
function shelfBoxHTML({ name, kind = 'mom', count = 0, addLabel, addAct, addData = {}, groupId, body }) {
  const isMom = kind === 'mom';
  return `<section class="shelf${count ? '' : ' is-empty'}" aria-label="${esc(name)}"><div class="shelf-head"><span class="shelf-ic">${ic(isMom ? 'doc' : 'file', 'sm')}</span><b>${esc(name)}</b><span class="count">${count}</span><span class="spacer"></span><button type="button" class="shelf-add" data-act="${addAct}"${attrs(addData)}>${ic(isMom ? 'plus' : 'upload', 'sm')}${esc(addLabel)}<span class="hide-sm"> here</span></button><button type="button" class="icon-btn" data-act="group-menu" data-id="${esc(groupId)}" aria-label="More for ${esc(name)}" aria-haspopup="menu">${ic('more', 'sm')}</button></div>${body}</section>`;
}
/* Items for a grouping's ⋯ menu. Remove grouping is admin only. */
const groupMenuItems = groupId => [
  { label: 'Rename grouping', icon: 'pencil', act: 'rename-group', data: { id: groupId } },
  '-',
  { label: 'Remove grouping', icon: 'trash', act: 'remove-group', data: { id: groupId }, danger: true, admin: { k: 'removeGroup', label: 'remove groupings' } },
];
/* A menu item that the Final mark blocks. A click says why. */
const finalBlockedItemHTML = label => `<button type="button" class="mi" role="menuitem" aria-disabled="true" data-final>${ic('lock')}<span>${esc(label)}</span></button>`;

/* 3.7 Layers */
function layerFrameHTML({ cls = '', label = 'Dialog', html, dismiss = true }) {
  return `<div class="layer ${cls}"><div class="scrim" ${dismiss ? 'data-act="layer-scrim"' : ''}></div><div class="panel" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">${html}</div></div>`;
}
function dialogHTML({ title, text = '', body = '', foot = '' }) {
  return `<div class="dlg-head"><div class="tt2"><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>${body}${foot ? `<div class="dlg-foot">${foot}</div>` : ''}`;
}
function menuPanelHTML(items) { return `<div class="menu-list" role="menu">${menuHTML(items)}</div>`; }
function toastHTML({ msg, icon = 'check', tone = '', action = null }) {
  return `<div class="toast ${tone}${action ? ' has-action' : ''}">${ic(icon)}<span>${esc(msg)}</span>${action ? `<button type="button" data-act="${action.act}"${attrs(action.data)}>${esc(action.label)}</button>` : ''}</div>`;
}
/* kind: offline | update | sync. action: { act, label } for the update banner. */
function bannerHTML({ kind, text, action = null }) {
  const icon = { offline: 'cloud-off', update: 'refresh', sync: 'loader' }[kind];
  return `<div class="banner ${kind}" role="status">${ic(icon)}<span>${esc(text)}</span>${action ? `<button type="button" class="btn btn-primary" data-act="${action.act}">${esc(action.label)}</button>` : ''}</div>`;
}
function bulkPillHTML({ count, matching = count, canDelete = true }) {
  return `<div class="bulkbar" role="region" aria-label="Selection"><b>${count} selected</b>${matching > count ? `<button type="button" class="link-btn" data-act="select-matching">Select all ${matching} matching</button>` : ''}<button type="button" class="btn btn-soft" data-act="bulk-move">${ic('move', 'sm')}Move…</button><button type="button" class="btn btn-danger-soft" data-act="bulk-delete"${canDelete ? '' : ' data-admin="delete items" aria-disabled="true"'}>${ic('trash', 'sm')}Delete</button><button type="button" class="link-btn" data-act="clear-sel">Clear</button></div>`;
}
function dropOverlayHTML(target) {
  return `<div class="dropzone-overlay on" aria-hidden="false"><div><span class="art">${ic('upload', 'xl')}</span><h2>Drop to add to ${esc(target)}</h2><p>Images, PDFs, videos — anything. You can rename it and add a note next.</p></div></div>`;
}
function lightboxHTML({ id, name, src }) {
  return `<figure class="lb"><img src="${esc(src)}" alt="${esc(name)}"><figcaption><span>${esc(name)}</span><span class="lb-acts"><button type="button" class="btn btn-soft btn-sm" data-act="download" data-id="${esc(id)}">${ic('download', 'sm')}Download</button><button type="button" class="icon-btn" data-act="copy-address" data-id="${esc(id)}" aria-label="Copy address">${ic('copy', 'sm')}</button><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x', 'sm')}</button></span></figcaption></figure>`;
}
/* One result row in the ⌘K bar. kind 'act' is a command; otherwise a place or item. */
function paletteRowHTML({ kind = 'item', tile = 'k-other', icon = 'doc', emoji = '', title, sub = '', selected = false, act = '', data = {} }) {
  return `<button type="button" class="pal-row" role="option" aria-selected="${!!selected}"${act ? ` data-act="${act}"` : ''}${attrs(data)}><span class="ktile ${tile}"${emoji ? ' aria-hidden="true"' : ''}>${emoji ? esc(emoji) : ic(icon, 'sm')}</span><span class="mid"><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="go">${ic('corner-down-left', 'sm')}</span></button>`;
}
function paletteFrameHTML({ results, term = '' }) {
  return `<div class="pal-in">${ic('search')}<input type="search" placeholder="Search areas, MoMs and files, or create…" autocomplete="off" aria-label="Search or jump to" role="combobox" aria-expanded="true" aria-controls="palRes" aria-autocomplete="list" value="${esc(term)}"><button type="button" class="icon-btn" data-act="close" aria-label="Close search">${ic('x', 'sm')}</button></div><div class="pal-res" id="palRes" role="listbox" aria-label="Results">${results}</div><div class="pal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>`;
}

/* 3.8 Editor parts (static markup; Tiptap wiring comes in Phase 4) */
const SWATCH_TEXT = ['#161B2E', '#4338CA', '#1D5FB8', '#067647', '#B45309', '#B42318'];
const SWATCH_HL = ['#FFF4E0', '#E4F6EC', '#E4F0FD', '#EEEAFD', '#FDECEB', '#F1F3FA'];
const TEXT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];
const FONT_CHOICES = [['sans', 'Sans-serif'], ['serif', 'Serif'], ['mono', 'Mono']];
const EDITOR_BLOCKS = [['p', 'Normal text'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3']];
/* The "/" menu. i is the icon; run() lives in the editor (Phase 4). */
const SLASH_ITEMS = [
  { title: 'Heading 1', key: 'h1', desc: 'Large section heading', i: 'h' },
  { title: 'Heading 2', key: 'h2', desc: 'Section heading', i: 'h' },
  { title: 'Bulleted list', key: 'list bullet', desc: 'Simple list', i: 'ul' },
  { title: 'Numbered list', key: 'list number', desc: 'Ordered steps', i: 'ol' },
  { title: 'Quote', key: 'quote', desc: 'Call out a line', i: 'quote' },
  { title: 'Table', key: 'table', desc: '3 × 3 with a heading row', i: 'table' },
  { title: 'Prospect journal table', key: 'journal prospect remarks', desc: 'Company, contact, stage, next step and Detailed Remarks', i: 'table' },
  { title: 'Image', key: 'image picture photo', desc: 'From a web address, your device, or paste', i: 'image' },
  { title: 'Link files', key: 'file link attach', desc: 'Name workspace files in this MoM', i: 'sparkle' },
  { title: 'Link MoMs', key: 'mom meeting previous series', desc: 'Link earlier meetings', i: 'doc' },
];
const slashItemsFor = q => { const t = (q || '').trim().toLowerCase(); return SLASH_ITEMS.map((x, i) => ({ ...x, i })).filter(x => !t || x.title.toLowerCase().includes(t) || x.key.includes(t)); };

function editorToolbarHTML({ active = {}, block = 'p', canUndo = true, canRedo = true }) {
  const b = (cmd, icon, label, key = '') => `<button type="button" class="tb" data-act="ed" data-cmd="${cmd}" aria-label="${label}" aria-pressed="${!!active[cmd]}" title="${label}${key ? ' ' + key : ''}">${ic(icon)}</button>`;
  return `<div class="toolbar" role="toolbar" aria-label="Formatting" data-keepfocus><div class="tb-inner">
    <button type="button" class="tb" data-act="ed" data-cmd="undo" aria-label="Undo" title="Undo ⌘Z"${canUndo ? '' : ' disabled'}>${ic('undo')}</button><button type="button" class="tb" data-act="ed" data-cmd="redo" aria-label="Redo" title="Redo ⇧⌘Z"${canRedo ? '' : ' disabled'}>${ic('redo')}</button><span class="tb-div"></span>
    <label class="tb-sel"><span class="sr">Text style</span><select data-change="ed-block">${EDITOR_BLOCKS.map(([v, l]) => `<option value="${v}"${v === block ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <span class="tb-div"></span>
    ${b('bold', 'bold', 'Bold', '⌘B')}${b('italic', 'italic', 'Italic', '⌘I')}${b('underline', 'underline', 'Underline', '⌘U')}${b('strike', 'strike', 'Strikethrough')}
    <button type="button" class="tb tb-wide" data-act="text-menu" aria-haspopup="dialog" aria-label="Typeface, size and colour" title="Typeface, size and colour"><span class="aa">Aa</span>${ic('chev-d', 'sm')}</button>
    <button type="button" class="tb tb-wide" data-act="align-menu" aria-haspopup="menu" aria-label="Alignment" title="Alignment">${ic('al')}${ic('chev-d', 'sm')}</button>
    <span class="tb-div"></span>
    ${b('ul', 'ul', 'Bulleted list')}${b('ol', 'ol', 'Numbered list')}${b('quote', 'quote', 'Quote')}
    <span class="tb-div"></span>
    <button type="button" class="tb" data-act="ed-link" aria-label="Link" title="Link ⌘K in text">${ic('link')}</button>
    <button type="button" class="tb" data-act="ed-table" aria-label="Table" title="Table">${ic('table')}</button>
    <button type="button" class="tb" data-act="ed-image" aria-label="Image" title="Image">${ic('image')}</button>
    <button type="button" class="tb" data-act="ed-insert" aria-label="Insert: link files, link MoMs, journal table" title="Insert (or type /)">${ic('plus')}</button>
    <span class="tb-div"></span>
    ${b('removeFormat', 'clear', 'Clear formatting')}
  </div></div>`;
}
function swatchRowHTML({ label, colours, kind, prefix, clear = false }) {
  return `<div class="tm-cap">${esc(label)}</div><div class="swatch-row" role="group" aria-label="${esc(label)}">${colours.map((c, i) => `<button type="button" class="swatch" data-act="swatch-pick" data-kind="${kind}" data-c="${c}" aria-label="${esc(label)} ${i + 1}"><span class="${prefix}${i + 1}"></span></button>`).join('')}${clear ? `<button type="button" class="swatch" data-act="swatch-pick" data-kind="${kind}" data-c="" aria-label="No ${esc(label.toLowerCase())}">${ic('x', 'sm')}</button>` : ''}</div>`;
}
function textMenuHTML({ font = 'sans', size = 16 }) {
  return `<div class="text-menu"><div class="tm-cap">Typeface</div><div class="seg tm-seg" role="group" aria-label="Typeface">${FONT_CHOICES.map(([v, l]) => `<button type="button" class="tm-font-${v}" data-act="tm-font" data-v="${v}" aria-pressed="${v === font}">${l}</button>`).join('')}</div><div class="tm-cap">Size</div><div class="tm-sizes" role="group" aria-label="Text size">${TEXT_SIZES.map(s => `<button type="button" class="tm-size" data-act="tm-size" data-v="${s}" aria-label="${s} pixels" aria-pressed="${s === size}">${s}</button>`).join('')}</div>${swatchRowHTML({ label: 'Text colour', colours: SWATCH_TEXT, kind: 'text', prefix: 'sw-t' })}${swatchRowHTML({ label: 'Highlight', colours: SWATCH_HL, kind: 'hl', prefix: 'sw-h', clear: true })}</div>`;
}
/* The floating bar over selected text (desktop). active: { bold: true, ... } */
function bubbleHTML({ active = {} }) {
  const b = (cmd, icon, label) => `<button type="button" class="tb" data-act="ed" data-cmd="${cmd}" aria-label="${label}" aria-pressed="${!!active[cmd]}">${ic(icon)}</button>`;
  return `<div class="bubble" role="toolbar" aria-label="Selection formatting">${b('bold', 'bold', 'Bold')}${b('italic', 'italic', 'Italic')}${b('underline', 'underline', 'Underline')}${b('strike', 'strike', 'Strikethrough')}<span class="tb-div"></span><button type="button" class="tb" data-act="ed-link" aria-label="Link">${ic('link')}</button><button type="button" class="tb" data-act="ed" data-cmd="removeFormat" aria-label="Clear formatting">${ic('clear')}</button></div>`;
}
/* The bar over a selected image: Inline, Float, Remove. */
function imageBubbleHTML({ mode = 'inline' }) {
  return `<div class="bubble" role="toolbar" aria-label="Image"><button type="button" class="tb tb-wide" data-act="img-mode" data-mode="inline" aria-pressed="${mode === 'inline'}">Inline</button><button type="button" class="tb tb-wide" data-act="img-mode" data-mode="float" aria-pressed="${mode === 'float'}">Float</button><span class="tb-div"></span><button type="button" class="tb tb-wide" data-act="img-remove">Remove</button></div>`;
}
function slashHTML({ items, idx = 0 }) {
  return `<div class="slash" role="listbox" aria-label="Insert"><div class="cap">Insert</div>${items.length ? items.map((x, n) => `<button type="button" role="option" aria-selected="${n === idx}" data-act="slash-pick" data-i="${x.i}"><span class="si">${ic(x.i, 'sm')}</span><span><b>${esc(x.title)}</b><small>${esc(x.desc)}</small></span></button>`).join('') : `<div class="noresult"><b>No matches</b>Try “table” or “list”.</div>`}</div>`;
}
/* The table bar: move, add and delete rows and columns, and set a Long text column. */
function tableBarHTML({ longtextHere = false, headerRow = false, journal = false }) {
  const b = (op, icon, label, extra = '') => `<button type="button" class="tt${icon ? ' icon' : ''} ${extra}" data-act="table-op" data-op="${op}" aria-label="${label}" title="${label}">${icon ? ic(icon, 'sm') : label}</button>`;
  const sep = '<span class="tt-sep"></span>';
  return `<div class="ttools" role="toolbar" aria-label="Table"><div class="tt-inner">${b('row-above', 'arrow-up', 'Row above')}${b('row-below', 'arrow-down', 'Row below')}${b('row-up', 'arrow-up', 'Move row up')}${b('row-down', 'arrow-down', 'Move row down')}${sep}${b('col-left', 'arrow-left', 'Column left')}${b('col-right', 'arrow-right', 'Column right')}${sep}${journal && longtextHere ? '' : b('col-move-left', 'chev-r', 'Move column left')}${journal && longtextHere ? '' : b('col-move-right', 'chev-r', 'Move column right')}${sep}${b('toggle-longtext', 'text', longtextHere ? 'Make text' : 'Long text column', longtextHere ? 'on' : '')}${sep}${journal && longtextHere ? '' : b('del-col', 'trash', 'Delete column', 'danger')}${headerRow ? '' : b('del-row', 'trash', 'Delete row', 'danger')}${b('del-table', 'trash', 'Delete table', 'danger')}</div></div>`;
}
/* A table. head: column titles. rows: arrays of cell text. longtextCol: index of the Long text column, or -1. */
function tableHTML({ head, rows = [], longtextCol = -1, journal = false }) {
  const th = (t, i) => `<th${i === longtextCol ? ' class="is-longtext"' : ''}>${esc(t)}${i === longtextCol ? ' <span class="coltype">Long text</span>' : ''}<span class="colgrip" aria-hidden="true"></span></th>`;
  const td = (t, i, r) => (i === longtextCol ? longtextCellHTML({ text: t, row: r }) : `<td>${esc(t)}</td>`);
  return `<div class="tw"><table${journal ? ' class="journal" data-template="journal"' : ''}><tbody><tr>${head.map(th).join('')}</tr>${rows.map((r, ri) => `<tr>${r.map((t, i) => td(t, i, ri)).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function longtextCellHTML({ text = '', row = 0 }) {
  return `<td class="longtext" data-label="Detailed Remarks"><button type="button" class="remark" data-act="remarks-open" data-row="${row}" aria-label="Open Detailed Remarks"><span class="remark-text">${text ? esc(text) : '<span class="remark-empty">Add remarks</span>'}</span><span class="remark-open" aria-hidden="true">${ic('expand', 'sm')}</span></button></td>`;
}
function journalBarHTML({ count, readOnly = false }) {
  return `<div class="journal-bar"><span class="ktile k-other">${ic('table', 'sm')}</span><span class="mid"><b>Prospect journal</b><small>${count} ${count === 1 ? 'entry' : 'entries'} · tap Detailed Remarks to read or write in full</small></span>${readOnly ? '' : `<button type="button" class="btn btn-primary btn-sm" data-act="new-entry">${ic('plus', 'sm')}New entry</button>`}</div>`;
}
/* The drawer's panel content. fields (journal only): [{ id, label, value, i }]. sub: a line of HTML. */
function remarksDrawerHTML({ title, sub = '', text = '', fields = null, status = 'saved' }) {
  return `<div class="rm-head"><div class="top"><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button><span class="spacer"></span>${statusPillHTML(status)}</div><h2>${esc(title)}</h2>${sub}</div><div class="rm-body"><label class="lab" for="rmText">Detailed remarks</label><textarea class="textarea" id="rmText" data-input="remark-text" placeholder="Write as much context as you need. It saves as you type.">${esc(text)}</textarea></div>${fields ? `<div class="rm-fields" aria-label="Entry details"><p class="rm-cap">Entry details</p>${fields.map(f => `<div class="field"><label class="lab" for="rf-${f.id}">${esc(f.label)}</label><input class="input" id="rf-${f.id}" data-input="remark-field" data-i="${f.i}" value="${esc(f.value)}" autocomplete="off"></div>`).join('')}</div>` : ''}<div class="rm-foot"><span class="muted">Saves as you type</span><span class="spacer"></span><button type="button" class="btn btn-primary" data-act="close">Done</button></div>`;
}
/* An image in the note. mode: inline | floating. The Drag handle shows only when floating. */
function imageHTML({ src, mode = 'inline', selected = false }) {
  return `<div class="img ${mode}${selected ? ' is-sel' : ''}" contenteditable="false"><img src="${esc(src)}" alt=""><span class="grip" aria-hidden="true"></span>${mode === 'floating' ? `<span class="move-handle" aria-hidden="true">${ic('drag', 'sm')}Drag</span>` : ''}</div>`;
}
function imageUploadingHTML({ pct = 0 }) {
  return `<div class="img-loading">${ic('loader')}<span>Uploading image… <b class="pct">${pct}%</b></span></div>`;
}
function imageFailedHTML({ src = '' }) {
  return `<div class="img-loading failed">${ic('alert')}<span>Couldn’t add this image. Check your connection, then try again.</span><button type="button" class="link-btn" data-act="img-retry" data-src="${esc(src)}">Retry</button></div>`;
}
/* kind: web (sky underline), file or mom (pills that open in the app). */
function linkPillHTML({ kind = 'web', href, label, id = '' }) {
  if (kind === 'web') return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  if (kind === 'file') return `<a class="ref" data-file="${esc(id)}" href="${esc(href)}" contenteditable="false">${ic('file', 'sm')}${esc(label)}</a>`;
  return `<a class="ref mom" data-mom="${esc(id)}" href="${esc(href)}" contenteditable="false">${ic('doc', 'sm')}${esc(label)}</a>`;
}
function remoteBarHTML({ who }) {
  return `<div class="remote-bar" role="status">${ic('users', 'sm')}<span>${esc(who)} saved changes to this MoM</span><span class="spacer"></span><button type="button" class="link-btn" data-act="apply-remote">Show changes</button></div>`;
}
/* The A4 export preview. body is the note's own HTML (already escaped by the editor). */
function a4HTML({ title, area, date, tags = [], body = '', stamp = '' }) {
  return `<div class="a4-wrap"><div class="print-root"><article class="a4" aria-label="Preview"><h1>${esc(title)}</h1><div class="meta">${esc(area)} · ${fmtDate(date)}${tags.length ? ' · ' + tags.map(t => '#' + esc(t)).join(' ') : ''}</div><div class="body">${body}</div><div class="a4-foot">${esc(stamp)}</div></article></div></div>`;
}

/* 3.9 States and feedback */
function emptyHTML({ small = false, icon, title, text, actions = '', cls = '' }) {
  return `<div class="empty${small ? ' small' : ''}${cls ? ' ' + cls : ''}"><div class="art">${ic(icon)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${actions ? `<div class="acts">${actions}</div>` : ''}</div>`;
}
function noResultHTML({ title, text, action = '', cls = '' }) {
  return `<div class="noresult${cls ? ' ' + cls : ''}"><b>${esc(title)}</b>${esc(text)}${action ? `<div class="noresult-act">${action}</div>` : ''}</div>`;
}
/* tone: info | warn | danger. title is optional. */
function noticeHTML({ tone = 'info', icon = 'info', title = '', text, role = '' }) {
  return `<div class="notice ${tone}"${role ? ` role="${role}"` : ''}>${ic(icon)}<div>${title ? `<b>${esc(title)}</b><br>` : ''}${esc(text)}</div></div>`;
}
/* The restricted gate for an area. */
function lockedGateHTML({ id, name, targetName = '', failed = false }) {
  const error = failed ? 'That password isn’t right. Try again.' : '';
  return `<div class="page"><div class="locked"><div class="art">${ic('lock')}<span class="lk">${ic('key', 'sm')}</span></div><h1>${esc(name)} is restricted</h1><p>${targetName ? `“${esc(targetName)}” is inside a restricted area. ` : ''}Enter the password to open it. It stays open for this session.</p><form data-form="unlock" data-kind="a" data-id="${esc(id)}" novalidate>${fieldHTML({ id: 'gatePw', label: 'Password', control: inputHTML({ id: 'gatePw', name: 'password', type: 'password', error }), error })}<button class="btn btn-primary" type="submit">Open ${esc(name)}</button></form></div></div>`;
}
/* A signed-in person with no access yet. */
const noAccessPartHTML = () => emptyHTML({ icon: 'shelf', title: 'No areas yet', text: 'You’re signed in, but you don’t have access to any areas yet. An admin can grant you access to a client or team, and everything inside it will appear here.' });
/* A shared link that is off or gone. */
const unavailableHTML = () => `<div class="vpage"><div class="vcard vcard-center">${emptyHTML({ small: true, icon: 'lock', title: 'This link is no longer available', text: 'The link may have been turned off, or the item was removed. Ask the person who shared it for a new link.' })}</div></div>`;
/* The header on shared pages: no accounts, read only. */
const visitorHeadHTML = () => `<header class="vhead"><span class="brand-mark">${ic('book')}</span><span class="who-line">${esc(APP_NAME)}</span><span class="spacer"></span>${readOnlyPillHTML()}</header>`;

/* Today's first-run variant: one wide tile, then the three steps inside an area. */
function quickFirstHTML({ act = 'new-area', adminOff = '' }) {
  return `<div class="quick quick-first">${quickTileHTML({ primary: true, icon: 'shelf', title: 'Create your first area', sub: 'A client, a team or an initiative', act, data: {} })}<div class="first-steps"><b>Then, inside it</b><span>${ic('doc', 'sm')}Start a MoM in one tap</span><span>${ic('upload', 'sm')}Upload files or save links</span><span>${ic('folder-plus', 'sm')}Group things as they grow</span></div></div>`;
}
/* The "Continue where you left off" row. cards: continueCardHTML() strings. */
const contRowHTML = cards => `<div class="cont-row">${cards.join('')}</div>`;
/* A section label inside the ⌘K results. */
const paletteCapHTML = t => `<div class="pal-cap">${esc(t)}</div>`;

/* ---------- Shared item actions (flag, final, delete, unlock). The editor uses them first;
   the Area, Today and Flagged screens reuse them. ---------- */
/* The design's kind for a stored file (old records have type / cloudType / format). */
function docKind(d) {
  if (!d) return 'other';
  if (d.kind && KINDS[d.kind]) return d.kind;
  const f = String(d.format || '').toLowerCase();
  if (d.cloudType === 'image' || d.type === 'image') return 'image';
  if (d.cloudType === 'video') return 'video';
  if (f === 'pdf' || d.type === 'pdf') return 'pdf';
  if (d.type === 'presentation') return 'slides';
  if (d.type === 'spreadsheet') return 'sheet';
  if (d.type === 'link') return guessKind(d.url) === 'link' ? 'link' : guessKind(d.url);
  return 'other';
}
const itemOf = (kind, id) => (kind === 'm' ? mom(id) : D.find(d => d.id === id) || null);
const itemName = (kind, x) => (kind === 'm' ? (x.title || 'Untitled meeting') : (x.name || 'Untitled file'));
on('flag', d => {
  const x = itemOf(d.kind, d.id); if (!x) return;
  setFlag(d.kind, d.id, !x.starred).catch(() => toast('Couldn’t save the flag. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
});
on('final', d => {
  const x = itemOf(d.kind, d.id); if (!x) return;
  const now = !x.readOnly;
  setFinal(d.kind, d.id, now).then(() => toast(now ? 'Marked final. Members can read it but not change it.' : 'Final mark removed', { icon: 'lock' }),
    () => toast('Couldn’t change the final mark. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
});
on('delete-item', d => {
  const x = itemOf(d.kind, d.id); if (!x) return;
  confirmDialog({ title: `Delete “${itemName(d.kind, x)}”?`, text: 'It goes to Deleted and stays recoverable for 7 days.', impact: d.kind === 'm' ? 'Its link to the area is kept until you restore or remove it.' : '', danger: true, cta: 'Delete', act: 'delete-item-now', data: { kind: d.kind, id: d.id } });
});
on('delete-item-now', d => {
  const x = itemOf(d.kind, d.id); if (!x) return;
  const name = itemName(d.kind, x), back = x.folderId;
  closeAll();
  (d.kind === 'm' ? dM(d.id) : dD(d.id)).catch(() => toast('Couldn’t delete it. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
  if (route().id === d.id) go(back && area(back) ? areaHref(back) : '#/today');
  toast(`Moved “${name}” to Deleted`, { icon: 'trash', action: { label: 'Open Deleted', act: 'go-deleted' } });
});
on('go-deleted', () => go('#/deleted'));
/* The restricted gate's form (kind 'a': an area). Opens it for this session. */
onForm('unlock', async (f) => {
  const { kind, id } = f.dataset;
  const pw = (f.elements.password && f.elements.password.value) || '';
  const target = kind === 'a' ? gf(id) : D.find(d => d.id === id);
  if (!target) return;
  if (pw && (await hw(pw)) === target.pw) {
    (kind === 'a' ? UF : UD).add(id);
    closeAll();
    render();
    if (kind === 'f' && ACT['open-file']) ACT['open-file']({ id });
    return;
  }
  const field = f.querySelector('.field');
  if (field) {
    field.classList.add('err');
    const input = f.elements.password;
    input.setAttribute('aria-invalid', 'true');
    if (!field.querySelector('.ferr')) field.insertAdjacentHTML('beforeend', `<span class="ferr" role="alert" id="${input.id}-err">${ic('alert', 'sm')}That password isn’t right. Try again.</span>`);
    input.setAttribute('aria-describedby', input.id + '-err');
    input.value = ''; input.focus();
  }
});

/* ---------- Page helpers (Area, Today, All areas, the picker) ---------- */
/* Dates are stored as milliseconds. isoOf gives the day in local time; msOf the local midnight of a day. */
const isoOf = v => {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(typeof v === 'number' ? v : Date.now());
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};
const msOf = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
/* An area's soft colour. Areas have none stored yet (open gap G3), so each gets a steady one from its id. */
const TINTS = ['tint-mint', 'tint-sky', 'tint-lilac', 'tint-rose', 'tint-sun', 'tint-peach'];
function tintOf(a) {
  if (a && TINTS.includes(a.tint)) return a.tint;
  let h = 0; String((a && a.id) || '').split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
  return TINTS[h % TINTS.length];
}
const sizeText = id => { const c = countsOf(id); return `${plural(c.areas, 'sub-area')} · ${plural(c.moms, 'MoM')} · ${plural(c.files, 'file')}`; };
/* "4 months old"; nothing for an area made this month or with no date. */
function ageText(ms) {
  if (!ms) return '';
  const d = new Date(ms), n = new Date();
  const months = (n.getFullYear() - d.getFullYear()) * 12 + n.getMonth() - d.getMonth() - (n.getDate() < d.getDate() ? 1 : 0);
  return months < 1 ? '' : `${plural(months, 'month')} old`;
}
const firstWord = s => String(s || '').split(/[\s._-]+/).filter(Boolean)[0] || '';
const firstName = () => { const n = firstWord(currentUser().name); return n ? n.charAt(0).toUpperCase() + n.slice(1) : ''; };
/* The start of a note, as plain text, for cards. */
const notePreview = (content, id) => { const t = plainText(content, id); return t.length > 150 ? t.slice(0, 150).trim() + '…' : t; };
/* A small image for a tile (Cloudinary can resize on the way out). */
const thumbUrl = d => {
  if (!d.url) return '';
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(d.url) ? d.url.replace('/image/upload/', '/image/upload/w_480,h_300,c_fill,q_auto/') : d.url;
};
/* Everything inside an area, for the delete confirmation (nothing is skipped: an admin is deleting it all). */
function contents(areaId) {
  const ids = descIds(areaId);
  return {
    areas: ids.length - 1,
    moms: M.filter(m => ids.includes(m.folderId)).length,
    files: D.filter(d => ids.includes(d.folderId)).length,
    groups: MF.filter(g => ids.includes(g.folderId)).length + DF.filter(g => ids.includes(g.folderId)).length,
  };
}
/* What this viewer may see that is flagged (workspace-wide), and what they opened lately. */
const flaggedItems = () => M.filter(m => m.starred && !hiddenItem('m', m)).map(m => ['m', m.id]).concat(D.filter(d => d.starred && !hiddenItem('f', d)).map(d => ['f', d.id]));
const recentEntries = () => CURR_USER_RECENT.filter(x => (x.k === 'm' ? M.find(m => m.id === x.id && !hiddenItem('m', m)) : D.find(d => d.id === x.id && !hiddenItem('f', d))));
/* Undo (S4): toasts carry { act: 'undo', data: { key } }; whoever offers it registers the way back. */
const UNDO = {};
const offerUndo = (key, fn) => { UNDO[key] = fn; };
on('undo', d => {
  const f = UNDO[d.key]; if (!f) return;
  delete UNDO[d.key];
  Promise.resolve(f()).then(() => toast('Undone', { icon: 'restore' }), () => toast('Couldn’t undo that. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
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
