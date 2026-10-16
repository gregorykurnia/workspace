/* Shell: sidebar (desktop), tablet rail, top bar, phone tabs, area tree, the split New menu
   and the create sheet. The ⌘K bar and the destination picker come with their own tasks. */
'use strict';

/* ---------- Where "create" lands ---------- */
/* Where "create" lands: the area you are in, the MoM's area, the place you chose, or the area you
   opened last. group is a grouping of that area; gkind says whether it holds MoMs or files. */
function createPlace(r) {
  const usable = id => id && area(id) && canSee(id) && !lockedArea(id);
  if (r && r.name === 'area' && usable(r.id)) return { area: r.id, group: null };
  const m = r && r.name === 'mom' ? mom(r.id) : null;
  if (m && usable(m.folderId)) return { area: m.folderId, group: m.momFolderId || null, gkind: 'mom' };
  if (UI.place && usable(UI.place.area)) return UI.place;
  const last = recentEntries()[0];
  const lastArea = last && (last.k === 'm' ? (mom(last.id) || {}).folderId : (D.find(d => d.id === last.id) || {}).folderId);
  if (usable(lastArea)) return { area: lastArea, group: null };
  const first = visibleRoots().find(a => !lockedArea(a.id));
  return first ? { area: first.id, group: null } : null;
}
/* The grouping to use for one kind of new item ('mom' or 'file'), or ''. */
const groupFor = (p, kind) => (p && p.group && p.gkind === kind ? p.group : '');
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
function sidebarHTML(r, opts = {}) {
  const loading = !!opts.loading;   // data is still arriving: skeleton rows, never "No areas yet"
  const areasTree = loading
    ? `<div class="side-skel" aria-hidden="true"><i class="skel"></i><i class="skel"></i><i class="skel"></i></div>`
    : visibleAreas().length ? treeHTML(r) : `<div class="side-empty">${isAdmin() ? `No areas yet. <button class="link-btn" data-act="new-area">Create one</button>` : 'No areas shared with you yet.'}</div>`;
  const flaggedCount = M.filter(m => m.starred && canSee(m.folderId) && !hiddenItem('m', m)).length + D.filter(d => d.starred && canSee(d.folderId) && !hiddenItem('f', d)).length;
  const nav = (href, icon, label, active, count) => `<a class="nav-item" href="${href}" ${active ? 'aria-current="page"' : ''}>${ic(icon)}<span>${label}</span>${count ? `<span class="count">${count}</span>` : ''}</a>`;
  const me = currentUser();
  return `<div class="side-brand"><img class="brand-mark brand-logo" src="icon.svg" alt=""><span>${esc(APP_NAME)}</span></div>
    <nav class="side-nav" aria-label="Main">
      ${nav('#/today', 'sun', 'Today', r.name === 'today')}
      ${nav('#/flagged', 'flag', 'Flagged', r.name === 'flagged', flaggedCount || '')}
      ${nav('#/recent', 'clock', 'Recent', r.name === 'recent')}
      ${nav('#/areas', 'grid', 'All areas', r.name === 'areas')}
    </nav>
    <div class="side-cap"><span>Areas</span>${isAdmin() && !loading ? `<button class="icon-btn side-add" data-act="new-area" aria-label="New area">${ic('plus', 'sm')}</button>` : ''}</div>
    ${areasTree}
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
        ${ro ? edReadOnlyHTML() : statusPillHTML(UI.edStatus || 'saved')}
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
function renderShell(r, opts = {}) {
  $('#side').innerHTML = sidebarHTML(r, opts);
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
    { label: 'New MoM here', icon: 'doc', act: 'new-mom', data: { area: p && p.area, group: groupFor(p, 'mom') } },
    { label: 'Upload a file', icon: 'upload', act: 'upload', data: { area: p && p.area, group: groupFor(p, 'file') } },
    { label: 'Save a link', icon: 'link', act: 'save-link', data: { area: p && p.area, group: groupFor(p, 'file') } },
    '-',
    { label: 'New grouping', icon: 'folder-plus', act: 'new-group', data: { area: p && p.area } },
    { label: 'New sub-area', icon: 'shelf', act: 'new-area', data: { parent: p && p.area }, admin: { k: 'createArea', label: 'create areas' } },
  ], 'Create');
});

function createSheet() {
  const p = createPlace(route());
  const area0 = p ? esc(p.area) : '', gMom = esc(groupFor(p, 'mom')), gFile = esc(groupFor(p, 'file'));
  layer({
    label: 'Create',
    html: `<div class="dlg-head"><div class="tt2"><h2>Create</h2><button type="button" class="place-chip place-chip-sheet" data-act="pick-place">${ic('folder-plus', 'sm')}<span>Creating in ${esc(placeName(p))}</span></button></div><button class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <button class="create-hero" data-act="new-mom" data-area="${area0}" data-group="${gMom}"${p ? '' : ' disabled'}><span class="qi">${ic('doc', 'lg')}</span><span><b>New MoM</b><small>Starts with today’s date, ready to type</small></span></button>
      <div class="create-grid">
        <button class="cg" data-act="upload" data-area="${area0}" data-group="${gFile}"${p ? '' : ' disabled'}><span class="qi">${ic('upload')}</span>Upload</button>
        <button class="cg" data-act="save-link" data-area="${area0}" data-group="${gFile}"${p ? '' : ' disabled'}><span class="qi">${ic('link')}</span>Save a link</button>
        <button class="cg" data-act="new-group" data-area="${area0}"${p ? '' : ' disabled'}><span class="qi">${ic('folder-plus')}</span>Grouping</button>
        <button class="cg" data-act="new-area" data-parent="${area0}" ${adminAttr('createArea', 'create areas')}><span class="qi">${ic('shelf')}</span>Sub-area</button>
      </div>
      ${p ? '' : `<p class="hint">${ic('info', 'sm')}Create an area first, then add MoMs and files to it.</p>`}`,
  });
}
on('create', () => createSheet());

/* ---------- ⌘K command bar (F1) ---------- */
/* Actions first, then what matches in Areas, MoMs and Files and links. Only what this viewer may
   see (search.js); a restricted area shows by name, with a lock, and nothing inside it. */
function paletteResults(q) {
  const term = q.trim().toLowerCase();
  const place = createPlace(route());
  const nothing = !visibleAreas().length;
  const acts = [];
  if (place) {
    const dm = { area: place.area, group: groupFor(place, 'mom') }, df = { area: place.area, group: groupFor(place, 'file') };
    acts.push({ title: `New MoM in ${placeName(place)}`, sub: 'Opens at today’s date', icon: 'doc', act: 'new-mom', data: dm });
    acts.push({ title: `Upload to ${placeName(place)}`, sub: 'Choose or drop a file', icon: 'upload', act: 'upload', data: df });
    acts.push({ title: `Save a link in ${placeName(place)}`, sub: 'Name, kind and address', icon: 'link', act: 'save-link', data: df });
  }
  if (isAdmin()) acts.push({ title: 'New area', sub: 'At the top level or inside another area', icon: 'shelf', act: 'new-area', data: {} });
  if (term && place) acts.push({ title: `New MoM ‘${q.trim()}’`, sub: `in ${placeName(place)}`, icon: 'doc', act: 'new-mom-title', data: { title: q.trim(), area: place.area, group: groupFor(place, 'mom') } });
  const sections = [];
  const shownActs = acts.filter(a => !term || a.title.toLowerCase().includes(term) || a.act === 'new-mom-title');
  if (shownActs.length) sections.push(['Actions', shownActs.map(a => ({ kind: 'act', ...a }))]);
  if (term && !nothing) {
    const f = searchAll(term);
    const path = id => crumbPath(id).slice(0, -1).map(x => x.name).join(' › ');
    if (f.areas.length) sections.push(['Areas', f.areas.map(a => ({ kind: 'area', id: a.id, title: a.name, emoji: areaEmoji(a), tile: tintOf(a), sub: path(a.id) || 'Top level', icon: 'shelf', locked: !!lockedArea(a.id) }))]);
    if (f.moms.length) sections.push(['MoMs', f.moms.map(m => ({ kind: 'mom', id: m.id, title: m.title || 'Untitled meeting', sub: `${area(m.folderId) ? area(m.folderId).name : ''} · ${fmtDate(isoOf(m.date))}`, icon: 'doc' }))]);
    if (f.files.length) sections.push(['Files and links', f.files.map(d => ({ kind: 'file', id: d.id, title: d.name || 'Untitled file', sub: `${area(d.folderId) ? area(d.folderId).name : ''}${d.docFolderId && groupName(d.docFolderId) ? ' · ' + groupName(d.docFolderId) : ''}`, tile: KINDS[docKind(d)].tile, icon: KINDS[docKind(d)].icon }))]);
  }
  return { sections, term, nothing };
}
function paletteListHTML(q) {
  const { sections, term, nothing } = paletteResults(q);
  // Enter acts on the selected row. With a typed word, that is the first match, never "New MoM ‘word’":
  // a search must not create something by accident.
  const flat = sections.flatMap(([, items]) => items);
  const pre = Math.max(0, flat.findIndex(it => it.kind !== 'act'));
  let i = 0;
  const rows = sections.map(([cap, items]) => paletteCapHTML(cap) + items.map(it => {
    const sel = i++ === (term ? pre : 0);
    if (it.kind === 'act') return paletteRowHTML({ icon: it.icon, title: it.title, sub: it.sub, selected: sel, act: 'palette-act', data: { cmd: it.act, ...it.data } });
    return paletteRowHTML({ tile: it.tile, icon: it.icon, emoji: it.emoji, title: it.title, sub: it.locked ? 'Restricted' : it.sub, selected: sel, act: 'palette-go', data: { kind: it.kind, id: it.id } });
  }).join('')).join('');
  if (nothing && !term) return noResultHTML({ title: 'Nothing yet', text: 'Create an area to get started.' });
  if (term && !sections.some(s => s[0] !== 'Actions')) return rows + noResultHTML({ title: `No matches for “${q.trim()}”`, text: 'Try another word, or create a MoM with this title above.' });
  return rows;
}
on('palette', () => {
  const role = sessionRole();
  if (role === 'visitor' || role === 'signedout' || role === 'loading' || LAYERS.some(l => l.el.classList.contains('layer-palette'))) return;
  closeAll();
  layer({
    cls: 'layer-palette', label: 'Search or jump to',
    html: paletteFrameHTML({ results: paletteListHTML('') }),
    onMount(panel) {
      const input = panel.querySelector('input[type="search"]');
      input.setAttribute('autofocus', '');
      input.addEventListener('input', () => { panel.querySelector('#palRes').innerHTML = paletteListHTML(input.value); input.removeAttribute('aria-activedescendant'); });
      input.addEventListener('keydown', e => {
        const rows = $$('.pal-row', panel);
        const cur = rows.findIndex(r => r.getAttribute('aria-selected') === 'true');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const n = (cur + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % Math.max(rows.length, 1);
          rows.forEach((r, i) => r.setAttribute('aria-selected', String(i === n)));
          if (rows[n]) { rows[n].scrollIntoView({ block: 'nearest' }); rows[n].id = rows[n].id || 'pal-' + n; input.setAttribute('aria-activedescendant', rows[n].id); }
        }
        if (e.key === 'Enter') { e.preventDefault(); const row = rows[cur >= 0 ? cur : 0]; if (row) row.click(); }
      });
    },
  });
});
on('palette-go', d => {
  closeAll();
  if (d.kind === 'area') return go(areaHref(d.id));
  if (d.kind === 'mom') return go('#/mom/' + encodeURIComponent(d.id));
  if (d.kind === 'file' && ACT['open-file']) ACT['open-file']({ id: d.id });
});
on('palette-act', d => {
  closeAll();
  const act = d.cmd === 'new-mom-title' ? 'new-mom-title' : d.cmd;
  if (ACT[act]) ACT[act](d); else console.warn(`No handler for data-act="${act}" yet`);
});
on('new-mom-title', d => {
  const p = d.area ? { area: d.area, group: d.group || null } : createPlace(route());
  if (!p || !p.area) { toast('Create an area first, then add a MoM to it.', { icon: 'alert', tone: 'warn' }); return; }
  newMomIn(p.area, d.area ? p.group : groupFor(p, 'mom') || null, d.title || 'Untitled meeting');
});

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
