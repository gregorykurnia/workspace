/* Shell: sidebar (desktop), top bar, phone tabs, area tree, ⌘K search,
   the create sheet, and the split New menu. */
'use strict';

/* ---------- Where "create" lands ---------- */
function createPlace(r) {
  if (r && r.name === 'area' && area(r.id)) return { area: r.id, group: null };
  if (r && r.name === 'mom' && mom(r.id)) return { area: mom(r.id).area, group: mom(r.id).group };
  return S.place && S.place.area && area(S.place.area) ? S.place : null;
}

/* ---------- Tree (sidebar on desktop, full screen on phone Areas tab) ---------- */
function treeHTML(r, opts = {}) {
  const curChain = r && r.name === 'area' ? chainOf(r.id).map(a => a.id) : [];
  const visible = new Set(visibleAreas().map(a => a.id));
  const kids = pid => DB.areas.filter(a => a.parent === pid && visible.has(a.id));
  const roots = opts.roots || visibleRoots();
  const rowFor = (a, depth) => {
    const locked = !!lockedArea(a.id);
    const children = locked ? [] : kids(a.id);
    const open = S.open.has(a.id) || curChain.includes(a.id);
    const current = r && r.name === 'area' && r.id === a.id;
    const c = locked ? null : countsOf(a.id);
    const count = c ? c.moms + c.files : null;
    const toggle = children.length
      ? `<button type="button" class="tg" data-act="tree-toggle" data-id="${a.id}" aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(a.name)}">${ic('chev-d', 'sm')}</button>`
      : `<span class="tg" disabled aria-hidden="true"></span>`;
    let html = `<div class="tree-row" role="treeitem" aria-level="${depth + 1}" aria-current="${current}" style="padding-left:${6 + depth * 14}px">${toggle}<a class="nm" href="#/areas/${a.id}" ${current ? 'aria-current="page"' : ''}>${locked ? `<span class="lk" aria-label="Restricted">${ic('lock', 'sm')}</span>` : ''}<span class="em" aria-hidden="true">${a.emoji}</span><span>${esc(a.name)}</span>${count != null ? `<span class="ct">${count}</span>` : ''}</a>${opts.more ? '' : ''}</div>`;
    if (open && children.length) html += children.map(k => rowFor(k, depth + 1)).join('');
    return html;
  };
  return `<div class="side-tree ${opts.cls || ''}" role="tree" aria-label="Areas">${roots.map(a => rowFor(a, 0)).join('') || (S.state === 'fresh' ? '' : '')}</div>`;
}

/* ---------- Sidebar ---------- */
function sidebarHTML(r) {
  const flaggedCount = DB.moms.filter(m => m.flagged && canSee(m.area) && !hiddenItem('m', m)).length + DB.files.filter(f => f.flagged && canSee(f.area) && !hiddenItem('f', f)).length;
  const nav = (href, icon, label, active, count) => `<a class="nav-item" href="${href}" ${active ? 'aria-current="page"' : ''}>${ic(icon)}<span>${label}</span>${count ? `<span class="count">${count}</span>` : ''}</a>`;
  const me = currentUser();
  return `<div class="side-brand"><span class="brand-mark">${ic('book')}</span><span>Daybook</span></div>
    <nav class="side-nav" aria-label="Main">
      ${nav('#/today', 'sun', 'Today', r.name === 'today')}
      ${nav('#/flagged', 'flag', 'Flagged', r.name === 'flagged', flaggedCount || '')}
      ${nav('#/recent', 'clock', 'Recent', r.name === 'recent')}
      ${nav('#/areas', 'grid', 'All areas', r.name === 'areas')}
    </nav>
    <div class="side-cap"><span>Areas</span>${isAdmin() ? `<button class="icon-btn side-add" data-act="new-area" aria-label="New area">${ic('plus', 'sm')}</button>` : ''}</div>
    ${visibleAreas().length ? treeHTML(r) : `<div class="side-empty">${isAdmin() ? `No areas yet. <button class="link-btn" data-act="new-area">Create one</button>` : 'No areas shared with you yet.'}</div>`}
    <div class="side-bottom">
      <nav class="side-nav" aria-label="Recovery">${nav('#/deleted', 'bin', 'Deleted', r.name === 'deleted', DB.deleted.length || '')}</nav>
      <div class="side-foot">
        <span class="who" style="width:36px;height:36px;font-size:13px;background:var(--accent-tint-2);color:var(--accent-strong)">${me.ini}</span>
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
    case 'mom': { const m = mom(r.id); return m ? [m.title, area(m.area) ? area(m.area).name : ''] : ['Meeting', '']; }
    default: return ['Daybook', ''];
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
    if (p === 'more') return `${s}<button type="button" class="crumb-more" data-act="crumb-more" data-ids="${hidden.map(h => h.a.id).join(',')}" aria-label="Show ${hidden.length} more levels">…</button>`;
    return `${s}<a class="crumb" href="#/areas/${p.a.id}" ${p.last ? 'aria-current="page"' : ''} title="${esc(p.a.name)}">${p.a.emoji} ${esc(p.a.name)}</a>`;
  }).join('') + (current ? `${sep}<span class="crumb crumb-now" aria-current="page" title="${esc(current)}">${esc(current)}</span>` : '');
  return `<nav class="crumbs" aria-label="Where you are">${html}</nav>`;
}
on('crumb-more', (d, el) => {
  menu(el, d.ids.split(',').map(id => ({ label: `${area(id).emoji} ${area(id).name}`, act: 'go-area', data: { id } })), 'Enclosing areas');
});
on('go-area', (d) => go(`#/areas/${d.id}`));

/* The top-level tabs on phone have no back arrow. */
const TAB_ROUTES = ['today', 'areas', 'flagged'];

function topbarHTML(r) {
  const info = syncInfo();
  const [title] = titleFor(r);
  const p = createPlace(r);
  const m = r.name === 'mom' ? mom(r.id) : null;
  const sync = `<span class="sync ${info.cls}" role="status" title="${esc(info.text)}"><span class="dot" aria-hidden="true"></span><span>${info.short}</span></span>`;
  const search = `<button class="cmd-trigger" type="button" data-act="palette" aria-label="Search or jump to (⌘K)">${ic('search', 'sm')}<span>Search</span><kbd>⌘K</kbd></button>`;
  const avatar = `<button class="avatar-btn" data-act="account" aria-label="Account: ${esc(currentUser().name)}"><span class="avatar">${currentUser().ini}</span></button>`;

  // In a MoM, the top bar is the editor's header: where it lives, save state, and Done.
  if (m && canSee(m.area) && !lockedArea(m.area)) {
    const ro = readOnly(m);
    return `
      <div class="top-crumbs">${crumbsHTML(m.area, m.title)}</div>
      <div class="top-right">
        ${ro ? `<span class="ed-readonly">${ic('lock', 'sm')}Final · read only</span>` : `<span class="status-pill js-status" role="status" aria-live="polite">${ic('cloud-check', 'sm')}Saved</span>`}
        ${search}
        <button class="icon-btn" data-act="flag" data-kind="m" data-id="${m.id}" aria-pressed="${!!m.flagged}" aria-label="${m.flagged ? 'Unflag' : 'Flag as important'}">${ic(m.flagged ? 'flag-fill' : 'flag', 'sm')}</button>
        <button class="icon-btn" data-act="editor-menu" data-id="${m.id}" aria-haspopup="menu" aria-label="More for this MoM">${ic('more', 'sm')}</button>
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
      <div class="split" role="group" aria-label="New">
        <button class="split-main" type="button" data-act="new-mom" data-area="${p ? p.area : ''}" data-group="${p && p.group ? p.group : ''}">${ic('plus', 'sm')}<span>New MoM</span></button>
        <button class="split-caret" type="button" data-act="new-menu" aria-label="More ways to create" aria-haspopup="menu">${ic('chev-d', 'sm')}</button>
      </div>
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
  $('#topbar').innerHTML = topbarHTML(r);
  $('#tabbar').innerHTML = tabbarHTML(r);
  const label = (() => { const [t] = titleFor(r); return t; })();
  document.title = `${label} — Daybook`;
  document.body.classList.toggle('scrolled', false);
}
window.addEventListener('scroll', () => document.body.classList.toggle('scrolled', window.scrollY > 4), { passive: true });

on('tree-toggle', (d) => { S.open.has(d.id) ? S.open.delete(d.id) : S.open.add(d.id); const r = route(); renderShell(r); });

/* ---------- Split New menu and create sheet ---------- */
on('new-menu', (d, el) => {
  const p = createPlace(route()) || S.place;
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
  layer({
    label: 'Create',
    html: `<div class="dlg-head"><div class="tt2"><h2>Create</h2><button type="button" class="place-chip" style="min-height:36px;padding:0 12px;margin-top:8px;font-size:14px" data-act="pick-place">${ic('folder-plus', 'sm')}<span>Creating in ${esc(placeName(p))}</span></button></div><button class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <button class="create-hero" data-act="new-mom" data-area="${p ? p.area : ''}" data-group="${p && p.group ? p.group : ''}"${p ? '' : ' disabled'}><span class="qi">${ic('doc', 'lg')}</span><span><b>New MoM</b><small>Starts with today’s date, ready to type</small></span></button>
      <div class="create-grid">
        <button class="cg" data-act="upload" data-area="${p ? p.area : ''}" data-group="${p && p.group ? p.group : ''}"${p ? '' : ' disabled'}><span class="qi">${ic('upload')}</span>Upload</button>
        <button class="cg" data-act="save-link" data-area="${p ? p.area : ''}" data-group="${p && p.group ? p.group : ''}"${p ? '' : ' disabled'}><span class="qi">${ic('link')}</span>Save a link</button>
        <button class="cg" data-act="new-group" data-area="${p ? p.area : ''}"${p ? '' : ' disabled'}><span class="qi">${ic('folder-plus')}</span>Grouping</button>
        <button class="cg" data-act="new-area" data-parent="${p ? p.area : ''}" ${adminAttr('createArea', 'create areas')}><span class="qi">${ic('shelf')}</span>Sub-area</button>
      </div>
      ${p ? '' : `<p class="hint">${ic('info', 'sm')}Create an area first, then add MoMs and files to it.</p>`}`,
  });
}
on('create', () => createSheet());
on('pick-place', () => { destPicker({ title: 'Create in', current: createPlace(route()), type: 'place', cta: 'Use this place', onPick: (p) => { S.place = p; toast(`Creating in ${placeName(p)}`, { icon: 'folder-plus' }); } }); });

/* ---------- ⌘K command bar ---------- */
function paletteResults(q) {
  const term = q.trim().toLowerCase();
  const match = s => !term || (s || '').toLowerCase().includes(term);
  const p = createPlace(route());
  const out = [];
  const empty = S.state === 'fresh';
  const acts = [];
  if (p) {
    acts.push({ kind: 'act', label: `New MoM in ${placeName(p)}`, sub: 'Opens at today’s date', ico: 'doc', act: 'new-mom', data: { area: p.area, group: p.group || '' } });
    acts.push({ kind: 'act', label: `Upload to ${placeName(p)}`, sub: 'Choose or drop a file', ico: 'upload', act: 'upload', data: { area: p.area, group: p.group || '' } });
    acts.push({ kind: 'act', label: `Save a link in ${placeName(p)}`, sub: 'Name, kind and address', ico: 'link', act: 'save-link', data: { area: p.area, group: p.group || '' } });
  }
  acts.push({ kind: 'act', label: 'New area', sub: 'At the top level or inside another area', ico: 'shelf', act: 'new-area', data: {}, admin: 'createArea' });
  if (term) acts.push({ kind: 'act', label: `New MoM ‘${q.trim()}’`, sub: p ? `in ${placeName(p)}` : 'Choose a place first', ico: 'doc', act: 'new-mom-title', data: { title: q.trim() } });
  const sections = [];
  if (!term || acts.some(a => match(a.label))) sections.push(['Actions', acts.filter(a => !term || match(a.label))]);
  if (!empty) {
    const areas = visibleAreas().filter(a => match(a.name) && !lockedArea(a.id)).slice(0, 6).map(a => ({ kind: 'area', id: a.id, label: a.name, emoji: a.emoji, tint: a.tint, sub: crumbPath(a.id).slice(0, -1).map(x => x.name).join(' › ') || 'Top level', ico: 'shelf' }));
    const moms = DB.moms.filter(m => canSee(m.area) && !hiddenItem('m', m) && (match(m.title) || match(stripTags(m.body).slice(0, 220)))).slice(0, 6).map(m => ({ kind: 'mom', id: m.id, label: m.title, sub: `${area(m.area).name} · ${fmtDate(m.date)}`, ico: 'doc' }));
    const files = DB.files.filter(f => canSee(f.area) && !hiddenItem('f', f) && (match(f.name) || match(f.note))).slice(0, 6).map(f => ({ kind: 'file', id: f.id, label: f.name, sub: `${area(f.area).name}${f.group ? ' · ' + group(f.group).name : ''}`, ico: KINDS[f.kind].icon }));
    if (areas.length) sections.push(['Areas', areas]);
    if (moms.length) sections.push(['MoMs', moms]);
    if (files.length) sections.push(['Files and links', files]);
  }
  return { sections, term, empty };
}
function paletteListHTML(q) {
  const { sections, term, empty } = paletteResults(q);
  let idx = 0;
  const rows = sections.map(([cap, items]) => `<div class="pal-cap">${cap}</div>` + items.map(it => {
    const i = idx++;
    const adm = it.admin && !can(it.admin) ? ` data-admin="create areas" aria-disabled="true"` : '';
    if (it.kind === 'act') return `<button class="pal-row" role="option" id="pal-${i}" aria-selected="${i === 0}" data-act="palette-act" data-cmd="${it.act}"${attrs(it.data)}${adm}><span class="ktile k-other">${ic(it.ico, 'sm')}</span><span class="mid"><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></span><span class="go">${ic('corner-down-left', 'sm')}</span></button>`;
    const cls = it.kind === 'area' ? it.tint : it.kind === 'mom' ? 'k-other' : KINDS[DB.files.find(f => f.id === it.id).kind].tile;
    return `<button class="pal-row" role="option" id="pal-${i}" aria-selected="${i === 0}" data-act="palette-go" data-kind="${it.kind}" data-id="${it.id}"><span class="ktile ${cls}" aria-hidden="true">${it.kind === 'area' ? it.emoji : ic(it.ico, 'sm')}</span><span class="mid"><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></span><span class="go">${ic('corner-down-left', 'sm')}</span></button>`;
  }).join('')).join('');
  if (empty) return `<div class="noresult"><b>Nothing yet</b>Create an area to get started.</div>`;
  if (!sections.some(s => s[0] !== 'Actions') && term) return rows + `<div class="noresult"><b>No matches for “${esc(q)}”</b>Try another word, or create a MoM with this title above.</div>`;
  return rows;
}
on('palette', () => {
  if (S.role === 'visitor') return;
  const L = layer({
    cls: 'layer-palette', label: 'Search or jump to',
    html: `<div class="pal-in">${ic('search')}<input id="palIn" type="search" placeholder="Search areas, MoMs and files, or create…" autocomplete="off" aria-label="Search or jump to" role="combobox" aria-expanded="true" aria-controls="palRes" aria-autocomplete="list"><button class="icon-btn" data-act="close" aria-label="Close search">${ic('x', 'sm')}</button></div>
      <div class="pal-res" id="palRes" role="listbox" aria-label="Results">${paletteListHTML('')}</div>
      <div class="pal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>`,
    onMount(panel) {
      const input = panel.querySelector('#palIn');
      input.addEventListener('input', () => {
        panel.querySelector('#palRes').innerHTML = paletteListHTML(input.value);
      });
      input.addEventListener('keydown', e => {
        const rows = $$('.pal-row', panel);
        const cur = rows.findIndex(r => r.getAttribute('aria-selected') === 'true');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const n = (cur + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % Math.max(rows.length, 1);
          rows.forEach((r, i) => r.setAttribute('aria-selected', String(i === n)));
          rows[n] && rows[n].scrollIntoView({ block: 'nearest' });
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const row = rows[cur >= 0 ? cur : 0];
          row && row.click();
        }
      });
    },
  });
  return L;
});
on('palette-go', (d) => {
  closeAll();
  if (d.kind === 'area') return go(`#/areas/${d.id}`);
  if (d.kind === 'mom') return go(`#/mom/${d.id}`);
  if (d.kind === 'file') return openFile(d.id);
});
on('palette-act', (d) => {
  closeAll();
  const cmd = d.cmd;
  if (cmd === 'new-mom') return ACT['new-mom'](d);
  if (cmd === 'upload') return ACT.upload(d);
  if (cmd === 'save-link') return ACT['save-link'](d);
  if (cmd === 'new-area') return ACT['new-area'](d);
  if (cmd === 'new-mom-title') return ACT['new-mom-title'](d);
});

/* ---------- Escape backs out of the current page ---------- */
KEYS.escape = () => {
  const r = route();
  if (S.selMode) { S.sel.clear(); S.selMode = false; render(); return; }
  if (r.name === 'mom') { const m = mom(r.id); return go(m ? `#/areas/${m.area}` : '#/today'); }
  if (r.name === 'area') { const a = area(r.id); if (a && a.parent) go(`#/areas/${a.parent}`); }
};

/* ---------- Phone search button and account ---------- */
on('account', () => go('#/account'));
on('back', () => back());
on('reload-page', () => location.reload());
