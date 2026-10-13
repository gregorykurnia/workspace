/* Core: state, helpers, permissions, actions, layers, menus, toasts,
   routing and the prototype scenario switches. Feature files register
   their views in VIEWS and their actions with on(). */
'use strict';

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmtDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const daysBetween = iso => { const [y, m, d] = iso.split('-').map(Number); return Math.round((TODAY - new Date(y, m - 1, d)) / 864e5); };
const rel = iso => { const n = daysBetween(iso); if (n <= 0) return 'Today'; if (n === 1) return 'Yesterday'; if (n < 7) return `${n} days ago`; return fmtDate(iso); };
const fmtSize = b => { if (b == null) return ''; if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB'; return (b / 1024 / 1024).toFixed(1).replace('.0', '') + ' MB'; };
const stripTags = h => String(h).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const isPhone = () => window.matchMedia('(max-width: 767px)').matches;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let uid = 500;
const nid = p => p + (++uid);
const attrs = o => Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => v === true ? ` data-${k}` : ` data-${k}="${esc(v)}"`).join('');

/* ---------- Application state ---------- */
const S = {
  role: 'admin',         // admin | member | visitor | signedout | newmember
  theme: 'light',        // light | dark
  state: 'normal',       // normal | fresh | emptyArea | loading | failure | offline | restricted | readonly | selecting | catchup | remote
  update: false,         // a new version is available (A4)
  unlocked: new Set(),   // 'a:id' or 'f:id' opened for this session (P2)
  open: new Set(['verdant', 'team', 'initiatives', 'clients']), // expanded tree rows
  place: { area: 'verdant', group: null },   // where "New MoM" lands
  recent: [],            // [['m', id] | ['f', id]], most recent first
  sel: new Set(),        // selected 'a:id' 'm:id' 'f:id'
  selMode: false,
  filter: '',
  sort: 'newest',
  view: 'grid',          // files: grid | list
  remoteShown: false,
  skeletonUntil: 0,
  lastRoute: '',
};

/* Who is acting. Member persona is Priya, newmember is Sam (no grants yet). */
function meId() {
  if (S.role === 'member') return 'priya';
  if (S.role === 'newmember') return 'sam';
  if (S.role === 'visitor') return null;
  return 'greg';
}
const isAdmin = () => S.role === 'admin';
const ADMIN_ONLY = new Set(['createArea', 'moveArea', 'deleteItem', 'removeGroup', 'shareLinks', 'access', 'final', 'recentAdded', 'bulkAreas']);
const can = k => S.role === 'admin' || !ADMIN_ONLY.has(k);
/* Attribute for an admin-only control. Members who click it are told plainly. */
const adminAttr = (k, label) => can(k) ? '' : ` data-admin="${esc(label)}" aria-disabled="true"`;

/* ---------- Data queries (all reads go through these) ---------- */
const area = id => DB.areas.find(a => a.id === id) || null;
const group = id => DB.groups.find(g => g.id === id) || null;
const mom = id => DB.moms.find(m => m.id === id) || null;
const file = id => DB.files.find(f => f.id === id) || null;
const kidsOf = pid => DB.areas.filter(a => a.parent === pid);
const chainOf = id => { const out = []; let a = area(id); while (a) { out.unshift(a); a = area(a.parent); } return out; };
const descIds = id => { const out = [id]; (function walk(p) { kidsOf(p).forEach(k => { out.push(k.id); walk(k.id); }); })(id); return out; };
const groupsIn = areaId => DB.groups.filter(g => g.area === areaId);
const momsIn = (areaId, gid = null) => DB.moms.filter(m => m.area === areaId && (gid === null ? !m.group : m.group === gid));
const filesIn = (areaId, gid = null) => DB.files.filter(f => f.area === areaId && (gid === null ? !f.group : f.group === gid));
const momsOf = (areaId) => DB.moms.filter(m => m.area === areaId);
const filesOf = (areaId) => DB.files.filter(f => f.area === areaId);
const contents = areaId => { const ids = descIds(areaId); return { areas: ids.length - 1, moms: DB.moms.filter(m => ids.includes(m.area)).length, files: DB.files.filter(f => ids.includes(f.area)).length, groups: DB.groups.filter(g => ids.includes(g.area)).length }; };
const isGranted = (areaId, uid) => { if (!uid) return false; return chainOf(areaId).some(a => (DB.access[a.id] || []).includes(uid)); };
/* Can the current viewer see this area at all (role + grants). */
function canSee(areaId) {
  if (S.role === 'admin') return !!area(areaId);
  if (S.role === 'member' || S.role === 'newmember') return isGranted(areaId, meId());
  return false;
}
/* Restricted by password, on this area or any area above it, and not opened this session. */
function lockedArea(areaId) {
  for (const a of chainOf(areaId)) {
    const restricted = a.restricted || (S.state === 'restricted' && a.id === 'verdant');
    if (restricted && !S.unlocked.has('a:' + a.id)) return a;
  }
  return null;
}
function lockedFile(f) {
  if (!f) return false;
  if (f.restricted && !S.unlocked.has('f:' + f.id)) return true;
  return !!lockedArea(f.area);
}
/* A MoM inside a restricted area is hidden everywhere (P3). */
const hiddenItem = (kind, item) => kind === 'm' ? !!lockedArea(item.area) : lockedFile(item);
/* Final: members read only. Admins can edit and un-mark (P7). */
const isFinal = item => !!item.final;
const readOnly = item => isFinal(item) && (S.role !== 'admin' || S.state === 'readonly');
/* A visible area, unless it sits under a grant the viewer doesn't have. */
const visibleAreas = () => DB.areas.filter(a => canSee(a.id));
const visibleRoots = () => { const ids = new Set(visibleAreas().map(a => a.id)); return visibleAreas().filter(a => !a.parent || !ids.has(a.parent)); };
const countsOf = areaId => {
  const c = contents(areaId);
  const moms = momsOf(areaId).concat(DB.moms.filter(m => descIds(areaId).includes(m.area) && m.area !== areaId));
  return { areas: c.areas, moms: moms.filter(m => !hiddenItem('m', m)).length, files: filesOf(areaId).length };
};

/* Crumb path as the viewer may see it. Members start at their granted area. */
function crumbPath(areaId) {
  let path = chainOf(areaId);
  if (S.role === 'member' || S.role === 'newmember') {
    const i = path.findIndex(a => (DB.access[a.id] || []).includes(meId()));
    if (i > -1) path = path.slice(i);
  }
  if (S.role === 'visitor' && S.shared) {
    const i = path.findIndex(a => a.id === S.shared.root);
    if (i > -1) path = path.slice(i);
  }
  return path;
}
function placeName(p) {
  if (!p || !p.area) return 'Choose a place';
  const a = area(p.area); if (!a) return 'Choose a place';
  const g = p.group && group(p.group);
  return `${a.emoji} ${a.name}${g ? ' · ' + g.name : ''}`;
}
const touchRecent = (t, id) => { S.recent = [[t, id], ...S.recent.filter(x => !(x[0] === t && x[1] === id))].slice(0, 8); };

/* ---------- Scenario: data reset and state switches ---------- */
function buildJournal() {
  const pj = DB.moms.find(m => m.id === 'pj');
  if (!pj) return;
  const esc2 = s => esc(s);
  const remark = (t, i) => `<td class="longtext" data-label="Detailed Remarks"><button type="button" class="remark" data-act="remarks-open" data-row="${i}" aria-label="Open Detailed Remarks"><span class="remark-text">${t ? esc2(t) : '<span class="remark-empty">Add remarks</span>'}</span><span class="remark-open" aria-hidden="true">${ic('expand', 'sm')}</span></button></td>`;
  pj.body = '<p>Running journal of every prospect conversation. One row per company; the <b>Detailed Remarks</b> column holds the long context.</p>' +
    '<h2>Pipeline</h2><table class="journal" data-template="journal"><tbody><tr><th>Company</th><th>Contact</th><th>Stage</th><th>Next step</th><th class="is-longtext">Detailed Remarks <span class="coltype">Long text</span></th></tr>' +
    DB.journal.map((r, i) => `<tr><td data-label="Company">${esc2(r[0])}</td><td data-label="Contact">${esc2(r[1])}</td><td data-label="Stage">${esc2(r[2])}</td><td data-label="Next step">${esc2(r[3])}</td>${remark(r[4], i)}</tr>`).join('') +
    '</tbody></table><p>Stages: Cold → Discovery → Proposal sent → Negotiation → Won / Lost.</p>';
}
function resetData() {
  DB = structuredClone(SEED);
  buildJournal();
}
/* Apply the current scenario on top of a fresh copy of the seed. */
function applyScenario() {
  resetData();
  S.recent = SEED.recent.map(x => [...x]);
  S.unlocked.clear();
  S.sel.clear();
  S.selMode = S.state === 'selecting';
  S.place = { area: 'verdant', group: null };
  if (S.state === 'fresh') {
    DB.areas = []; DB.groups = []; DB.moms = []; DB.files = []; DB.deleted = [];
    DB.access = {}; DB.shares = {}; DB.activity = []; S.recent = [];
    S.place = { area: null, group: null };
  }
  if (S.state === 'emptyArea') {
    DB.areas.push({ id: 'blank', name: 'Blank project', emoji: '🌱', parent: null, created: '2026-10-01', tint: 'tint-mint' });
    S.place = { area: 'blank', group: null };
  }
  if (S.state === 'selecting') {
    S.sel = new Set(['m:m3', 'f:f5']);
  }
  if (S.state === 'loading') S.skeletonUntil = Date.now() + 1500;
  if (S.state === 'readonly') {
    DB.moms.forEach(m => { if (m.area === 'verdant') m.final = true; });
    DB.files.forEach(f => { if (f.area === 'verdant') f.final = true; });
  }
}

/* ---------- Actions and forms: one delegated listener each ---------- */
const ACT = {};
const FORMS = {};
const INPUTS = {};
const KEYS = {};
const on = (name, fn) => { ACT[name] = fn; };
const onForm = (name, fn) => { FORMS[name] = fn; };
const onInput = (name, fn) => { INPUTS[name] = fn; };

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
  if (!fn) return;
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
  const first = L.panel.querySelector('[autofocus], input:not([type=hidden]):not([disabled]), textarea, select');
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

/* Confirmation with a plain statement of impact (O8). */
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
  setTimeout(() => { t.style.transition = 'opacity .2s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, ms);
  return t;
}
on('dismiss-toast', (d, el) => el.closest('.toast').remove());

/* ---------- Routing and rendering ---------- */
const VIEWS = {};  // name -> { html(r), mount(r, el) }
function route() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [path, qs = ''] = raw.split('?');
  const p = path.split('/').filter(Boolean);
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
function guard(r) {
  if (S.role === 'signedout') return ['signin', 'reset'].includes(r.name) ? null : '#/signin';
  if (S.role === 'newmember') return ['newmember', 'account', 'shared'].includes(r.name) ? null : '#/new-member';
  if (S.role === 'visitor') return r.name === 'shared' ? null : '#/s/a/verdant';
  if (['signin', 'reset', 'newmember'].includes(r.name)) return '#/today';
  return null;
}
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function back() {
  if (LAYERS.length) return closeTop();
  if (history.length > 1 && document.referrer !== '' ) history.back(); else go('#/today');
}
function render() {
  const r = route();
  const redirect = guard(r);
  if (redirect) { location.replace(redirect); return; }
  const bare = ['signin', 'reset', 'newmember'].includes(r.name);
  const shared = r.name === 'shared';
  document.body.dataset.route = r.name;
  document.body.classList.toggle('bare', bare);
  document.body.classList.toggle('visitor', shared || S.role === 'visitor');
  document.body.classList.toggle('route-mom', r.name === 'mom');
  document.body.classList.toggle('offline', S.state === 'offline');
  document.body.classList.toggle('selecting', S.selMode);
  if (S.role !== 'visitor' && !shared && !bare) renderShell(r);
  else { $('#side').innerHTML = ''; $('#topbar').innerHTML = ''; $('#tabbar').innerHTML = ''; }
  const v = VIEWS[r.name] || VIEWS.missing;
  const el = $('#view');
  if (Date.now() < S.skeletonUntil && !shared) {
    el.innerHTML = skeletonHTML();
    setTimeout(() => { if (route().name === r.name) render(); }, Math.max(0, S.skeletonUntil - Date.now()));
    S.skeletonUntil = 0;
    S.skeletonGate = true;
  } else {
    el.innerHTML = v.html(r);
    v.mount && v.mount(r, el);
  }
  if (r.name !== S.lastRoute) { window.scrollTo({ top: 0 }); S.lastRoute = r.name; }
  if (r.name === 'mom') el.focus({ preventScroll: true });
  renderBanners();
}
function skeletonHTML() {
  return `<div class="page" aria-busy="true" aria-label="Loading"><div class="skel" style="height:44px;width:40%"></div><div class="skel" style="height:22px;width:60%;margin-top:14px"></div><div class="cards" style="margin-top:28px"><div class="skel" style="height:150px"></div><div class="skel" style="height:150px"></div><div class="skel" style="height:150px"></div></div></div>`;
}
window.addEventListener('hashchange', () => { render(); });

/* ---------- Keyboard ---------- */
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); ACT.palette && ACT.palette({}); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); KEYS.save && KEYS.save(); return; }
  if (e.key === 'Escape') {
    if (LAYERS.length) { e.preventDefault(); closeTop(); return; }
    KEYS.escape && KEYS.escape();
  }
});

/* ---------- Prototype switches (not part of the design) ---------- */
function protoHTML() {
  const sel = (name, val, opts) => `<select data-change="proto-${name}" aria-label="${name}">${opts.map(([v, l]) => `<option value="${v}"${v === val ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<button class="proto-tab" type="button" data-act="proto-toggle" aria-expanded="false">▸ Prototype</button>
  <div class="proto-body" id="protoBody" hidden>
    <div class="proto-row"><span>Role</span>${sel('role', S.role, [['admin', 'Admin'], ['member', 'Member (Priya)'], ['newmember', 'New member, no access'], ['visitor', 'Visitor (shared link)'], ['signedout', 'Signed out']])}</div>
    <div class="proto-row"><span>Theme</span>${sel('theme', S.theme, [['light', 'Light'], ['dark', 'Dark']])}</div>
    <div class="proto-row"><span>State</span>${sel('state', S.state, [
      ['normal', 'Normal'], ['fresh', 'Nothing yet (workspace)'], ['emptyArea', 'Nothing yet (area)'], ['loading', 'Loading'],
      ['failure', 'Failure (forms)'], ['offline', 'No connection'], ['restricted', 'Restricted (Verdant)'], ['readonly', 'Read-only (final)'],
      ['selecting', 'Selecting several'], ['catchup', 'Sync: catching up'], ['remote', 'Sync: someone else editing']])}</div>
    <div class="proto-row"><span>New version</span><input type="checkbox" data-change="proto-update" ${S.update ? 'checked' : ''} aria-label="New version available"></div>
    <div class="proto-row"><span>Reset data</span><button class="link-btn" style="min-height:32px;padding:0 8px" data-act="proto-reset">Reset</button></div>
    <h4>Jump to</h4>
    <div class="proto-row"><a href="#/today">Today</a><a href="#/areas/verdant">Verdant</a><a href="#/mom/m1">Editor</a></div>
    <div class="proto-row"><a href="#/areas/meridian">Restricted</a><a href="#/s/a/verdant">Shared area</a><a href="#/deleted">Deleted</a></div>
    <p class="proto-note">Switches for review only. The page and width decide phone or desktop: resize the window or use the device toolbar. Demo password for restricted items: <b>${SHARE_PASSWORD}</b>.</p>
  </div>`;
}
function renderProto() { $('#proto').innerHTML = protoHTML(); }
on('proto-toggle', (d, el) => {
  const body = $('#protoBody');
  body.hidden = !body.hidden;
  el.setAttribute('aria-expanded', String(!body.hidden));
});
document.addEventListener('change', e => {
  const el = e.target;
  const key = el.dataset.change;
  if (!key || !key.startsWith('proto-')) return;
  const k = key.slice(6);
  if (k === 'update') { S.update = el.checked; render(); return; }
  S[k] = el.value;
  if (k === 'role') {
    S.role = el.value;
    const home = { admin: '#/today', member: '#/today', newmember: '#/new-member', visitor: '#/s/a/verdant', signedout: '#/signin' }[S.role];
    S.place = { area: S.role === 'admin' ? 'verdant' : 'verdant', group: null };
    applyScenario();
    renderProto();
    go(home);
    return;
  }
  if (k === 'theme') { document.documentElement.dataset.theme = S.theme; renderProto(); return; }
  if (k === 'state') {
    applyScenario();
    renderProto();
    render();
    if (S.state === 'remote') scheduleRemote();
    if (S.state === 'catchup') scheduleCatchup();
  }
});
on('proto-reset', () => { applyScenario(); render(); toast('Demo data reset'); });

/* Sync pill and banners */
function syncInfo() {
  if (S.state === 'offline') return { cls: 'offline', text: 'No connection' };
  if (S.state === 'catchup') return { cls: 'catching', text: 'Catching up…' };
  return { cls: '', text: 'All changes saved' };
}
function renderBanners() {
  const b = [];
  if (S.state === 'offline') b.push(`<div class="banner offline" role="status">${ic('cloud-off')}<span>You're offline. What's on screen stays readable; changes save here and sync when you reconnect.</span></div>`);
  if (S.update) b.push(`<div class="banner update" role="status">${ic('refresh')}<span>A new version of Daybook is ready.</span><button class="btn btn-primary" data-act="reload">Refresh to update</button></div>`);
  if (S.state === 'catchup') b.push(`<div class="banner sync" role="status">${ic('loader')}<span>Catching up on changes from your team…</span></div>`);
  $('#banners').innerHTML = b.join('');
}
on('reload', () => { S.update = false; toast('You are on the latest version'); render(); });

/* ---------- Boot ---------- */
document.documentElement.dataset.theme = S.theme;
