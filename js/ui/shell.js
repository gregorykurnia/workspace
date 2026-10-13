/* Shell: sidebar (desktop), tablet rail, top bar, phone tabs, area tree, the split New menu
   and the create sheet. The ⌘K bar and the destination picker come with their own tasks. */
'use strict';

/* ---------- Where "create" lands ---------- */
function createPlace(r) {
  if (r && r.name === 'area' && area(r.id)) return { area: r.id, group: null };
  const m = r && r.name === 'mom' ? mom(r.id) : null;
  if (m) return { area: m.folderId, group: m.momFolderId || null };
  return UI.place && UI.place.area && area(UI.place.area) ? UI.place : null;
}
function placeName(p) {
  if (!p || !p.area) return 'Choose a place';
  const a = area(p.area); if (!a) return 'Choose a place';
  const g = p.group && groupName(p.group);
  return `${areaEmoji(a) ? areaEmoji(a) + ' ' : ''}${a.name}${g ? ' · ' + g : ''}`;
}

/* ---------- Tree (sidebar on desktop, full screen on phone Areas tab) ---------- */
function treeHTML(r, opts = {}) {
  const curChain = r && r.name === 'area' ? chainOf(r.id).map(a => a.id) : [];
  const visible = new Set(visibleAreas().map(a => a.id));
  const childrenOf = pid => kids(pid).filter(a => visible.has(a.id));
  const roots = opts.roots || visibleRoots();
  const rowFor = (a, depth) => {
    const locked = !!lockedArea(a.id);
    const children = locked ? [] : childrenOf(a.id);
    const open = UI.open.has(a.id) || curChain.includes(a.id);
    const current = r && r.name === 'area' && r.id === a.id;
    const c = locked ? null : countsOf(a.id);
    const count = c ? c.moms + c.files : null;
    const toggle = children.length
      ? `<button type="button" class="tg" data-act="tree-toggle" data-id="${esc(a.id)}" aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(a.name)}">${ic('chev-d', 'sm')}</button>`
      : `<span class="tg" disabled aria-hidden="true"></span>`;
    let html = `<div class="tree-row" role="treeitem" aria-level="${depth + 1}" data-depth="${Math.min(depth, 8)}"${children.length ? ` aria-expanded="${open}"` : ''} aria-current="${current}">${toggle}<a class="nm" href="${areaHref(a.id)}" ${current ? 'aria-current="page"' : ''}>${locked ? `<span class="lk" aria-label="Restricted">${ic('lock', 'sm')}</span>` : ''}<span class="em" aria-hidden="true">${esc(areaEmoji(a))}</span><span>${esc(a.name)}</span>${count != null ? `<span class="ct">${count}</span>` : ''}</a></div>`;
    if (open && children.length) html += children.map(k => rowFor(k, depth + 1)).join('');
    return html;
  };
  return `<div class="side-tree ${opts.cls || ''}" role="tree" aria-label="Areas">${roots.map(a => rowFor(a, 0)).join('')}</div>`;
}

/* ---------- Sidebar ---------- */
function sidebarHTML(r) {
  const flaggedCount = M.filter(m => m.starred && canSee(m.folderId) && !hiddenItem('m', m)).length + D.filter(d => d.starred && canSee(d.folderId) && !hiddenItem('f', d)).length;
  const nav = (href, icon, label, active, count) => `<a class="nav-item" href="${href}" ${active ? 'aria-current="page"' : ''}>${ic(icon)}<span>${label}</span>${count ? `<span class="count">${count}</span>` : ''}</a>`;
  const me = currentUser();
  return `<div class="side-brand"><span class="brand-mark">${ic('book')}</span><span>${esc(APP_NAME)}</span></div>
    <nav class="side-nav" aria-label="Main">
      ${nav('#/today', 'sun', 'Today', r.name === 'today')}
      ${nav('#/flagged', 'flag', 'Flagged', r.name === 'flagged', flaggedCount || '')}
      ${nav('#/recent', 'clock', 'Recent', r.name === 'recent')}
      ${nav('#/areas', 'grid', 'All areas', r.name === 'areas')}
    </nav>
    <div class="side-cap"><span>Areas</span>${isAdmin() ? `<button class="icon-btn side-add" data-act="new-area" aria-label="New area">${ic('plus', 'sm')}</button>` : ''}</div>
    ${visibleAreas().length ? treeHTML(r) : `<div class="side-empty">${isAdmin() ? `No areas yet. <button class="link-btn" data-act="new-area">Create one</button>` : 'No areas shared with you yet.'}</div>`}
    <div class="side-bottom">
      <nav class="side-nav" aria-label="Recovery">${nav('#/deleted', 'bin', 'Deleted', r.name === 'deleted', deletedCount() || '')}</nav>
      <div class="side-foot">
        <span class="who side-who">${esc(me.ini)}</span>
        <div class="who-name"><b>${esc(me.name)}</b><small>${me.roleLabel}</small></div>
        <button class="icon-btn side-acct" data-act="account" aria-label="Account and settings">${ic('user', 'sm')}</button>
      </div>
    </div>`;
}

/* ---------- Top bar ---------- */
function titleFor(r) {
  switch (r.name) {
    case 'today': return ['Today', ''];
    case 'areas': return ['Areas', ''];
    case 'area': { const a = area(r.id); return a ? [a.name, crumbPath(a.id).slice(0, -1).map(x => x.name).join(' › ')] : ['Area', '']; }
    case 'flagged': return ['Flagged', ''];
    case 'recent': return ['Recent', ''];
    case 'deleted': return ['Deleted', 'Kept for 7 days'];
    case 'account': return ['Account', ''];
    case 'mom': { const m = mom(r.id); return m ? [m.title || 'Untitled', area(m.folderId) ? area(m.folderId).name : ''] : ['Meeting', '']; }
    default: return [APP_NAME, ''];
  }
}
/* Breadcrumb (F5). Deep paths keep the first and the last two levels; the
   middle collapses into a "…" button that lists the hidden levels. */
function crumbsHTML(areaId, current = null) {
  const path = crumbPath(areaId);
  const items = path.map((a, i) => ({ a, last: !current && i === path.length - 1 }));
  let parts = items;
  let hidden = [];
  if (current && items.length > 1) { hidden = items.slice(0, -1); parts = ['more', items[items.length - 1]]; }
  else if (items.length > 3) { hidden = items.slice(1, -2); parts = [items[0], 'more', ...items.slice(-2)]; }
  const sep = `<span class="crumb-sep" aria-hidden="true">${ic('chev-r', 'sm')}</span>`;
  const html = parts.map((p, i) => {
    const s = i === 0 ? '' : sep;
    if (p === 'more') return `${s}<button type="button" class="crumb-more" data-act="crumb-more" data-ids="${esc(hidden.map(h => h.a.id).join(','))}" aria-label="Show ${hidden.length} more levels">…</button>`;
    return `${s}<a class="crumb" href="${areaHref(p.a.id)}" ${p.last ? 'aria-current="page"' : ''} title="${esc(p.a.name)}">${emojiLead(p.a)}${esc(p.a.name)}</a>`;
  }).join('') + (current ? `${sep}<span class="crumb crumb-now" aria-current="page" title="${esc(current)}">${esc(current)}</span>` : '');
  return `<nav class="crumbs" aria-label="Where you are">${html}</nav>`;
}
on('crumb-more', (d, el) => {
  menu(el, d.ids.split(',').map(id => area(id)).filter(Boolean).map(a => ({ label: (areaEmoji(a) ? areaEmoji(a) + ' ' : '') + a.name, act: 'go-area', data: { id: a.id } })), 'Enclosing areas');
});
on('go-area', (d) => go(areaHref(d.id)));

/* The top-level tabs on phone have no back arrow. */
const TAB_ROUTES = ['today', 'areas', 'flagged'];

function topbarHTML(r) {
  const info = syncInfo();
  const [title] = titleFor(r);
  const p = createPlace(r);
  const m = r.name === 'mom' ? mom(r.id) : null;
  const me = currentUser();
  const sync = syncPillHTML(info);
  const search = `<button class="cmd-trigger" type="button" data-act="palette" aria-label="Search or jump to (⌘K)">${ic('search', 'sm')}<span>Search</span><kbd>⌘K</kbd></button>`;
  const avatar = `<button class="avatar-btn" data-act="account" aria-label="Account: ${esc(me.name)}"><span class="avatar">${esc(me.ini)}</span></button>`;

  // In a MoM, the top bar is the editor's header: where it lives, save state, and Done.
  if (m && canSee(m.folderId) && !lockedArea(m.folderId)) {
    const ro = readOnly(m);
    return `
      <div class="top-crumbs">${crumbsHTML(m.folderId, m.title || 'Untitled')}</div>
      <div class="top-right">
        ${ro ? `<span class="ed-readonly">${ic('lock', 'sm')}Final · read only</span>` : `<span class="status-pill js-status" role="status" aria-live="polite">${ic('cloud-check', 'sm')}Saved</span>`}
        ${search}
        <button class="icon-btn" data-act="flag" data-kind="m" data-id="${esc(m.id)}" aria-pressed="${!!m.starred}" aria-label="${m.starred ? 'Unflag' : 'Flag as important'}">${ic(m.starred ? 'flag-fill' : 'flag', 'sm')}</button>
        <button class="icon-btn" data-act="editor-menu" data-id="${esc(m.id)}" aria-haspopup="menu" aria-label="More for this MoM">${ic('more', 'sm')}</button>
        <button class="btn btn-soft btn-sm" data-act="done">Done</button>
      </div>`;
  }
  const crumbs = r.name === 'area' && area(r.id) && canSee(r.id) ? crumbsHTML(r.id) : `<span class="top-title-d">${esc(title)}</span>`;
  return `
    ${TAB_ROUTES.includes(r.name) ? '' : `<button class="icon-btn back-btn" data-act="back" aria-label="Back">${ic('arrow-left')}</button>`}
    <div class="phone-title">${esc(title)}</div>
    <div class="top-crumbs">${crumbs}</div>
    <div class="top-right">
      ${search}
      ${sync}
      ${splitNewHTML(p)}
      <button class="icon-btn search-btn" data-act="palette" aria-label="Search">${ic('search')}</button>
      ${avatar}
    </div>`;
}
function tabbarHTML(r) {
  const cur = n => (r.name === n ? 'aria-current="page"' : '');
  return `<a class="tab" href="#/today" ${cur('today')}>${ic('sun')}<span>Today</span></a>
    <a class="tab" href="#/areas" ${cur('areas')}>${ic('grid')}<span>Areas</span></a>
    <button class="tab-create" type="button" data-act="create" aria-label="Create">${ic('plus')}</button>
    <a class="tab" href="#/flagged" ${cur('flagged')}>${ic('flag')}<span>Flagged</span></a>
    <button class="tab" type="button" data-act="palette">${ic('search')}<span>Search</span></button>`;
}
function renderShell(r) {
  $('#side').innerHTML = sidebarHTML(r);
  $('.topbar').innerHTML = topbarHTML(r);
  $('#tabbar').innerHTML = tabbarHTML(r);
  const [label] = titleFor(r);
  document.title = label === APP_NAME ? APP_NAME : `${label} — ${APP_NAME}`;
}
window.addEventListener('scroll', () => document.body.classList.toggle('scrolled', window.scrollY > 4), { passive: true });

on('tree-toggle', (d) => {
  UI.open.has(d.id) ? UI.open.delete(d.id) : UI.open.add(d.id);
  lsSet('G_exp', JSON.stringify([...UI.open]));
  keepFocus(() => renderShell(route()));
});

/* ---------- Split New menu and create sheet ---------- */
on('new-menu', (d, el) => {
  const p = createPlace(route()) || UI.place;
  menu(el, [
    { label: 'New MoM here', icon: 'doc', act: 'new-mom', data: { area: p && p.area, group: p && p.group || '' } },
    { label: 'Upload a file', icon: 'upload', act: 'upload', data: { area: p && p.area, group: p && p.group || '' } },
    { label: 'Save a link', icon: 'link', act: 'save-link', data: { area: p && p.area, group: p && p.group || '' } },
    '-',
    { label: 'New grouping', icon: 'folder-plus', act: 'new-group', data: { area: p && p.area } },
    { label: 'New sub-area', icon: 'shelf', act: 'new-area', data: { parent: p && p.area }, admin: { k: 'createArea', label: 'create areas' } },
  ], 'Create');
});

function createSheet() {
  const p = createPlace(route());
  const area0 = p ? esc(p.area) : '', group0 = p && p.group ? esc(p.group) : '';
  layer({
    label: 'Create',
    html: `<div class="dlg-head"><div class="tt2"><h2>Create</h2><button type="button" class="place-chip place-chip-sheet" data-act="pick-place">${ic('folder-plus', 'sm')}<span>Creating in ${esc(placeName(p))}</span></button></div><button class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <button class="create-hero" data-act="new-mom" data-area="${area0}" data-group="${group0}"${p ? '' : ' disabled'}><span class="qi">${ic('doc', 'lg')}</span><span><b>New MoM</b><small>Starts with today’s date, ready to type</small></span></button>
      <div class="create-grid">
        <button class="cg" data-act="upload" data-area="${area0}" data-group="${group0}"${p ? '' : ' disabled'}><span class="qi">${ic('upload')}</span>Upload</button>
        <button class="cg" data-act="save-link" data-area="${area0}" data-group="${group0}"${p ? '' : ' disabled'}><span class="qi">${ic('link')}</span>Save a link</button>
        <button class="cg" data-act="new-group" data-area="${area0}"${p ? '' : ' disabled'}><span class="qi">${ic('folder-plus')}</span>Grouping</button>
        <button class="cg" data-act="new-area" data-parent="${area0}" ${adminAttr('createArea', 'create areas')}><span class="qi">${ic('shelf')}</span>Sub-area</button>
      </div>
      ${p ? '' : `<p class="hint">${ic('info', 'sm')}Create an area first, then add MoMs and files to it.</p>`}`,
  });
}
on('create', () => createSheet());

/* ---------- Escape backs out of the current page ---------- */
/* Layers close first (core.js). Then: leave Select, leave the editor for its area, go up one
   area, never above where this viewer's path starts. */
KEYS.escape = () => {
  const r = route();
  if (UI.selMode) { UI.sel.clear(); UI.selMode = false; render(); return; }
  if (r.name === 'mom') { const m = mom(r.id); return go(m ? areaHref(m.folderId) : '#/today'); }
  if (r.name === 'area' && area(r.id)) {
    const path = crumbPath(r.id);
    if (path.length > 1) go(areaHref(path[path.length - 2].id));
  }
};

/* ---------- Account and back ---------- */
on('account', () => go('#/account'));
on('back', () => back());
