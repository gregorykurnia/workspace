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
  const me = SEED.me;
  return `<div class="side-brand"><span class="brand-mark">${ic('book')}</span><span>Daybook</span></div>
    <nav class="side-nav" aria-label="Main">
      ${nav('#/today', 'sun', 'Today', r.name === 'today')}
      ${nav('#/flagged', 'flag', 'Flagged', r.name === 'flagged', flaggedCount || '')}
      ${nav('#/recent', 'clock', 'Recent', r.name === 'recent')}
    </nav>
    <div class="side-cap"><span>Areas</span><button class="icon-btn" style="width:32px;height:32px;min-height:32px" data-act="new-area" ${adminAttr('createArea', 'create areas')} aria-label="New area">${ic('plus', 'sm')}</button></div>
    ${treeHTML(r)}
    <div class="side-bottom">
      <nav class="side-nav" aria-label="Recovery">${nav('#/deleted', 'bin', 'Deleted', r.name === 'deleted', DB.deleted.length || '')}</nav>
      <div class="side-foot">
        <span class="who" style="width:36px;height:36px;font-size:13px;background:var(--accent-tint-2);color:var(--accent-strong)">${me.ini}</span>
        <div class="who-name"><b>${esc(me.name)}</b><small>${S.role === 'admin' ? 'Admin' : 'Member'}</small></div>
        <button class="icon-btn" style="width:36px;height:36px;min-height:36px" data-act="account" aria-label="Account and settings">${ic('user', 'sm')}</button>
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
function crumbsHTML(areaId) {
  const path = crumbPath(areaId);
  const items = path.map((a, i) => ({ a, last: i === path.length - 1 }));
  let parts = items;
  if (items.length > 3) parts = [items[0], 'more', ...items.slice(-2)];
  const html = parts.map((p, i) => {
    if (p === 'more') return `<span class="crumb-sep">${ic('chev-r', 'sm')}</span><span class="crumb-more" aria-hidden="true">…</span>`;
    const sep = i === 0 ? '' : `<span class="crumb-sep">${ic('chev-r', 'sm')}</span>`;
    return `${sep}<a class="crumb" href="#/areas/${p.a.id}" ${p.last ? 'aria-current="page"' : ''} title="${esc(p.a.name)}">${p.a.emoji} ${esc(p.a.name)}</a>`;
  }).join('');
  return `<nav class="crumbs" aria-label="Where you are" style="margin:0">${html}</nav>`;
}
function topbarHTML(r) {
  const info = syncInfo();
  const [title, sub] = titleFor(r);
  const p = createPlace(r);
  const crumbs = r.name === 'area' ? crumbsHTML(r.id) : r.name === 'mom' && mom(r.id) ? crumbsHTML(mom(r.id).area) : `<span class="muted" style="font-weight:600">${esc(title)}</span>`;
  const showBack = r.name !== 'today';
  return `
    <button class="icon-btn back-btn" data-act="back" aria-label="Back">${ic('arrow-left')}</button>
    <div class="phone-title"><span>${esc(title)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</div>
    <div class="top-crumbs">${crumbs}</div>
    <button class="cmd-trigger" type="button" data-act="palette" aria-label="Search or jump to (⌘K)">${ic('search', 'sm')}<span>Search or jump to…</span><kbd>⌘K</kbd></button>
    <div class="top-right">
      <span class="sync ${info.cls}" role="status" title="Sync status"><span class="dot"></span><span>${info.text}</span></span>
      <div class="split" role="group" aria-label="New">
        <button class="split-main" type="button" data-act="new-mom" data-area="${p ? p.area : ''}" data-group="${p && p.group ? p.group : ''}">${ic('plus', 'sm')}<span>New MoM</span></button>
        <button class="split-caret" type="button" data-act="new-menu" aria-label="More ways to create" aria-haspopup="menu">${ic('chev-d', 'sm')}</button>
      </div>
      <button class="icon-btn search-btn" data-act="palette" aria-label="Search">${ic('search')}</button>
      <button class="avatar-btn" data-act="account" aria-label="Account: ${esc(SEED.me.name)}"><span class="avatar">${SEED.me.ini}</span></button>
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
        <button class="cg" data-act="upload" data-area="${p ? p.area : ''}" data-group="${p && p.group ? p.group : ''}"${p ? '' : ' disabled'}><span class="qi">${ic('upload')}</span>Upload a file</button>
        <button class="cg" data-act="save-link" data-area="${p ? p.area : ''}" data-group="${p && p.group ? p.group : ''}"${p ? '' : ' disabled'}><span class="qi">${ic('link')}</span>Save a link</button>
        <button class="cg" data-act="new-group" data-area="${p ? p.area : ''}"${p ? '' : ' disabled'}><span class="qi">${ic('folder-plus')}</span>New grouping</button>
        <button class="cg" data-act="new-area" data-parent="${p ? p.area : ''}" ${adminAttr('createArea', 'create areas')}><span class="qi">${ic('shelf')}</span>New sub-area</button>
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
  acts.push({ kind: 'act', label: 'New area', sub: 'Admins create areas', ico: 'shelf', act: 'new-area', data: {}, admin: 'createArea' });
  if (term) acts.push({ kind: 'act', label: `New MoM ‘${q.trim()}’`, sub: p ? `in ${placeName(p)}` : 'Choose a place first', ico: 'doc', act: 'new-mom-title', data: { title: q.trim() } });
  const sections = [];
  if (!term || acts.some(a => match(a.label))) sections.push(['Actions', acts.filter(a => !term || match(a.label))]);
  if (!empty) {
    const areas = visibleAreas().filter(a => match(a.name) && !lockedArea(a.id)).slice(0, 6).map(a => ({ kind: 'area', id: a.id, label: `${a.emoji} ${a.name}`, sub: crumbPath(a.id).slice(0, -1).map(x => x.name).join(' › ') || 'Top level', ico: 'shelf' }));
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
    const cls = it.kind === 'area' ? 'tint-mint' : it.kind === 'mom' ? 'k-other' : KINDS[DB.files.find(f => f.id === it.id).kind].tile;
    return `<button class="pal-row" role="option" id="pal-${i}" aria-selected="${i === 0}" data-act="palette-go" data-kind="${it.kind}" data-id="${it.id}"><span class="ktile ${cls}">${it.kind === 'area' ? '' : ic(it.ico, 'sm')}</span><span class="mid"><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></span><span class="go">${ic('corner-down-left', 'sm')}</span></button>`;
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
