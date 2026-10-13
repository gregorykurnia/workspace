/* Area page (F2, F5, F6, F8, O1–O8, P2, P3), groupings (O4), the
   destination picker used by move and create (O5), and the bulk bar (O7). */
'use strict';

const UNDO = {};
on('undo', d => { const f = UNDO[d.key]; if (f) { f(); delete UNDO[d.key]; } });
const EMOJIS = ['🏢', '🌿', '📦', '📈', '⚓', '🏥', '🎯', '👥', '🗓️', '💡', '🚀', '🧪', '🌱', '🛠️', '📚', '🧭', '🎨', '🔬', '💼', '🧾', '🏠', '🌍', '📣', '🧩'];

/* Age in months, as "3 months old". Used for F8. */
function ageText(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = (TODAY.getFullYear() - y) * 12 + (TODAY.getMonth() - (m - 1)) - (TODAY.getDate() < d ? 1 : 0);
  if (months < 1) return 'Created this month';
  return `${plural(months, 'month')} old`;
}
/* Size (F8). Counts skip anything inside a restricted area that isn't open (P3). */
const sizeText = id => { const c = countsOf(id); return `${plural(c.areas, 'sub-area')} · ${plural(c.moms, 'MoM')} · ${plural(c.files, 'file')}`; };

/* ---------- Matching and sorting for the filter bar (F2) ---------- */
function matchTerm() { return S.filter.trim().toLowerCase(); }
function filteredItems(areaId) {
  const t = matchTerm();
  const hit = s => !t || (s || '').toLowerCase().includes(t);
  const sortFn = (a, b) => S.sort === 'az' ? (a.title || a.name).localeCompare(b.title || b.name) : (b.date || b.created || '').localeCompare(a.date || a.created || '');
  const subs = kidsOf(areaId).filter(a => canSee(a.id) && hit(a.name)).sort((a, b) => a.name.localeCompare(b.name));
  const moms = momsOf(areaId).filter(m => !hiddenItem('m', m) && (hit(m.title) || hit(stripTags(m.body)))).sort(sortFn);
  const files = filesOf(areaId).filter(f => !hiddenItem('f', f) && (hit(f.name) || hit(f.note))).sort(sortFn);
  return { subs, moms, files };
}
/* Keys of everything matching the current filter, for "Select all matching" (O7). */
function matchingKeys(areaId) {
  const { subs, moms, files } = filteredItems(areaId);
  return [...(isAdmin() ? subs.map(a => 'a:' + a.id) : []), ...moms.map(m => 'm:' + m.id), ...files.map(f => 'f:' + f.id)];
}

/* ---------- Area page ---------- */
function lockedGateHTML(lockArea, targetName) {
  const fail = S.state === 'failure';
  return `<div class="page"><div class="locked">
      <div class="art">${ic('lock')}<span class="lk">${ic('key', 'sm')}</span></div>
      <h1>${esc(lockArea.name)} is restricted</h1>
      <p>${targetName ? `“${esc(targetName)}” is inside a restricted area. ` : ''}Enter the password to open it. It stays open for this session.</p>
      <form data-form="unlock" data-kind="a" data-id="${lockArea.id}" novalidate class="field ${fail ? 'err' : ''}" id="gateField" style="text-align:left">
        <label class="lab" for="gatePw" style="display:block;font-size:13.5px;font-weight:700;color:var(--text-2);margin-bottom:8px">Password</label>
        <input class="input" id="gatePw" name="password" type="password" autocomplete="off" autofocus>
        <span class="ferr" role="alert">That password isn’t right. Try again.</span>
        <button class="btn btn-primary" type="submit" style="width:100%;margin-top:14px">Open ${esc(lockArea.name)}</button>
      </form>
    </div></div>`;
}
VIEWS.area = {
  html(r) {
    const a = area(r.id);
    if (!a) return VIEWS.missing.html();
    if (!canSee(a.id)) return `<div class="page">${noAccessAreaHTML(a)}</div>`;
    const lock = lockedArea(a.id);
    if (lock) return lockedGateHTML(lock, null);
    const p = { area: a.id, group: null };
    const { subs, moms, files } = filteredItems(a.id);
    const all = contents(a.id);
    const empty = all.areas === 0 && all.moms === 0 && all.files === 0 && groupsIn(a.id).length === 0;
    const count = subs.length + moms.length + files.length;
    const filtering = !!matchTerm();
    const unlocked = a.restricted ? S.unlocked.has('a:' + a.id) : false;
    const adminAct = (k, label) => adminAttr(k, label);
    const restrictedSession = a.restricted && unlocked;
    const ageLine = `Created ${fmtDate(a.created)} · ${ageText(a.created)}`;

    const momCards = moms.map(m => momCardHTML2(m)).join('');
    const fileTiles = files.map(f => fileTileHTML(f)).join('');
    const groups = groupsIn(a.id);
    const shelves = groups.map(g => shelfHTML(g, a, filtering)).join('');
    const looseMoms = moms.filter(m => !m.group);
    const looseFiles = files.filter(f => !f.group);

    return `<div class="page">
      <nav class="crumbs phone-only" aria-label="Where you are">${crumbPath(a.id).map((x, i, arr) => `${i ? `<span class="crumb-sep">${ic('chev-r', 'sm')}</span>` : ''}<a class="crumb" href="#/areas/${x.id}" ${i === arr.length - 1 ? 'aria-current="page"' : ''}>${x.emoji} ${esc(x.name)}</a>`).join('')}</nav>
      <div class="ahead">
        <span class="blob ${a.tint}">${a.emoji}</span>
        <div class="ttl">
          <p class="eyebrow">${crumbPath(a.id).length > 1 ? 'Sub-area' : 'Area'}${a.restricted ? ' · Restricted' : ''}</p>
          <h1 class="h-page" style="margin-top:4px">${esc(a.name)}</h1>
          <div class="meta"><span>${sizeText(a.id)}</span><span>${ageLine}</span>${restrictedSession ? `<span class="lock-pill open">${ic('unlock', 'sm')}Open for this session <button class="link-btn" style="min-height:32px;padding:0 8px" data-act="relock" data-id="${a.id}">Lock again</button></span>` : ''}${a.restricted && !unlocked ? `<span class="lock-pill">${ic('lock', 'sm')}Restricted</span>` : ''}</div>
        </div>
        <div class="aactions">
          <button class="btn btn-primary" data-act="new-mom" data-area="${a.id}">${ic('plus', 'sm')}New MoM</button>
          <button class="btn btn-soft" data-act="upload" data-area="${a.id}">${ic('upload', 'sm')}Upload</button>
          <button class="btn btn-soft" data-act="save-link" data-area="${a.id}">${ic('link', 'sm')}Save link</button>
          <button class="icon-btn" data-act="area-menu" data-id="${a.id}" aria-label="More actions for ${esc(a.name)}" aria-haspopup="menu">${ic('more')}</button>
        </div>
      </div>

      ${subs.length || (isAdmin() && !filtering) ? `<section class="section" aria-labelledby="subs"><div class="section-head"><h2 class="h2" id="subs">Sub-areas ${subs.length ? `<span class="count">${subs.length}</span>` : ''}</h2></div>
        <div class="subgrid">${subs.map(s => `${S.selMode && isAdmin() ? `<div class="cw${S.sel.has('a:' + s.id) ? ' is-selected' : ''}"><span class="sel-box" role="checkbox" aria-checked="${S.sel.has('a:' + s.id)}" data-act="sel" data-key="a:${s.id}" tabindex="0" aria-label="Select ${esc(s.name)}" style="position:absolute;left:12px;top:12px;z-index:2">${S.sel.has('a:' + s.id) ? ic('check') : ''}</span>` : ''}<a class="subcard" href="#/areas/${s.id}" ${S.selMode && isAdmin() ? `data-act="sel-card" data-key="a:${s.id}"` : ''}><span class="blob ${s.tint}">${s.emoji}</span><span><b>${esc(s.name)}</b><small>${s.restricted ? ic('lock', 'sm') + 'Restricted' : `${plural(countsOf(s.id).moms, 'MoM')} · ${plural(countsOf(s.id).files, 'file')}`}</small></span></a>${S.selMode && isAdmin() ? '</div>' : ''}`).join('')}
          ${isAdmin() && !filtering ? `<button class="subcard new-card" data-act="new-area" data-parent="${a.id}" ${adminAct('createArea', 'create sub-areas')}>${ic('plus', 'sm')}New sub-area</button>` : ''}</div></section>` : ''}

      <div class="filterbar" role="search">
        <label class="search-in"><span class="sr">Filter this area</span>${ic('search', 'sm')}<input type="search" data-input="area-filter" value="${esc(S.filter)}" placeholder="Filter this area" autocomplete="off"></label>
        <div class="seg" role="group" aria-label="Sort">
          <button type="button" data-act="sort" data-v="newest" aria-pressed="${S.sort !== 'az'}">Newest</button>
          <button type="button" data-act="sort" data-v="az" aria-pressed="${S.sort === 'az'}">A–Z</button>
        </div>
        <div class="seg phone-hide" role="group" aria-label="Files view">
          <button type="button" data-act="fview" data-v="grid" aria-pressed="${S.view !== 'list'}" aria-label="Tiles">${ic('grid', 'sm')}</button>
          <button type="button" data-act="fview" data-v="list" aria-pressed="${S.view === 'list'}" aria-label="List">${ic('list', 'sm')}</button>
        </div>
        <span class="spacer"></span>
        <button class="btn btn-soft btn-sm" data-act="toggle-select" aria-pressed="${S.selMode}">${ic('check-square', 'sm')}${S.selMode ? 'Done selecting' : 'Select'}</button>
      </div>

      ${count === 0 && !empty ? `<div class="noresult" style="margin-top:20px"><b>No matches for “${esc(S.filter)}”</b>Nothing in ${esc(a.name)} matches. <div style="margin-top:12px"><button class="btn btn-soft btn-sm" data-act="clear-filter">Clear filter</button></div></div>` : ''}
      ${empty && !filtering ? areaEmptyHTML(a) : ''}

      ${shelves}

      ${(looseMoms.length || (!filtering && !empty)) ? `<section class="section" aria-labelledby="mtg"><div class="section-head"><h2 class="h2" id="mtg">Meeting notes ${looseMoms.length ? `<span class="count">${looseMoms.length}</span>` : ''}</h2><span class="spacer"></span><button class="shelf-add" data-act="new-mom" data-area="${a.id}">${ic('plus', 'sm')}New MoM<span class="hide-sm"> here</span></button></div>
        ${looseMoms.length ? `<div class="cards">${looseMoms.map(m => momCardHTML2(m)).join('')}</div>` : (filtering ? '' : `<div class="empty small" style="padding-left:0"><div class="art">${ic('doc')}</div><h3>No meeting notes yet</h3><p>Start the first MoM for this area.</p></div>`)}
      </section>` : ''}

      ${(looseFiles.length || (!filtering && !empty)) ? `<section class="section" aria-labelledby="fls"><div class="section-head"><h2 class="h2" id="fls">Files and links ${looseFiles.length ? `<span class="count">${looseFiles.length}</span>` : ''}</h2><span class="spacer"></span><button class="shelf-add" data-act="upload" data-area="${a.id}">${ic('upload', 'sm')}Upload<span class="hide-sm"> here</span></button></div>
        ${looseFiles.length ? (S.view === 'list' ? `<div class="flist">${looseFiles.map(f => fileRowHTML(f)).join('')}</div>` : `<div class="ftiles">${looseFiles.map(f => fileTileHTML(f)).join('')}</div>`) : (filtering ? '' : `<div class="empty small" style="padding-left:0"><div class="art">${ic('upload')}</div><h3>No files yet</h3><p>Upload a file or save a link to keep it with this area.</p></div>`)}
      </section>` : ''}

      <div id="bulkHost">${bulkBarHTML(a.id)}</div>
    </div>`;
  },
  mount(r, el) {
    const a = area(r.id);
    if (!a) return;
    if (S.state === 'selecting' && !S.sel.size) S.sel.add('m:m3');
  },
};

function noAccessAreaHTML(a) {
  return `<div class="locked" style="margin-top:56px"><div class="art" style="background:var(--surface-2);color:var(--text-2)">${ic('lock')}</div><h1>You don’t have access to ${esc(a.name)}</h1><p>An admin can grant you access. Everything inside the area will show once they do.</p><a class="btn btn-soft" href="#/today">Back to Today</a></div>`;
}
function areaEmptyHTML(a) {
  return `<div class="empty" style="margin-top:28px"><div class="art">${ic('sparkle')}</div><h3>Nothing in ${esc(a.name)} yet</h3><p>Start with a meeting, a file, or a link. Groupings and sub-areas are optional and can come later.</p>
    <div class="acts"><button class="btn btn-primary" data-act="new-mom" data-area="${a.id}">${ic('plus', 'sm')}New MoM</button><button class="btn btn-soft" data-act="upload" data-area="${a.id}">${ic('upload', 'sm')}Upload a file</button><button class="btn btn-soft" data-act="save-link" data-area="${a.id}">${ic('link', 'sm')}Save a link</button>${isAdmin() ? `<button class="btn btn-soft" data-act="new-area" data-parent="${a.id}">${ic('shelf', 'sm')}New sub-area</button>` : ''}</div></div>`;
}

/* A MoM card with its selection box and more menu */
function momCardHTML2(m) {
  const sel = S.selMode ?`<span class="sel-box" role="checkbox" aria-checked="${S.sel.has('m:' + m.id)}" data-act="sel" data-key="m:${m.id}" tabindex="0" aria-label="Select ${esc(m.title)}" style="position:absolute;left:12px;top:12px;z-index:2">${S.sel.has('m:' + m.id) ? ic('check') : ''}</span>` : '';
  const flag = m.flagged ? `<span class="flagmark" aria-label="Flagged">${ic('flag-fill', 'sm')}</span>` : '';
  const fin = isFinal(m) ? `<span class="finalmark">${ic('lock', 'sm')}Final</span>` : '';
  const dim = m.date ? rel(m.date) : '';
  return `<div class="cw${S.sel.has('m:' + m.id) ? ' is-selected' : ''}" ${S.selMode ? 'data-selecting' : ''}>${sel}<a class="mcard" href="#/mom/${m.id}" ${S.selMode ? 'data-act="sel-card" data-key="m:' + m.id + '"' : ''} style="${S.selMode ? 'padding-left:46px' : ''}"><span class="d">${flag}${ic('calendar', 'sm')}${dim}${fin ? ' ' + fin : ''}</span><span class="t">${esc(m.title)}</span><span class="s">${esc(stripTags(m.body).slice(0, 150))}</span><span class="tags">${m.tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</span></a><button class="more" data-act="item-menu" data-kind="m" data-id="${m.id}" aria-label="More for ${esc(m.title)}" aria-haspopup="menu">${ic('more', 'sm')}</button></div>`;
}
function fileTileHTML(f) {
  const k = KINDS[f.kind];
  const sel = S.selMode ? `<span class="sel-box" role="checkbox" aria-checked="${S.sel.has('f:' + f.id)}" data-act="sel" data-key="f:${f.id}" tabindex="0" aria-label="Select ${esc(f.name)}" style="position:absolute;left:10px;top:10px;z-index:2">${S.sel.has('f:' + f.id) ? ic('check') : ''}</span>` : '';
  const locked = lockedFile(f);
  const thumb = f.thumb && !locked ? `<img src="${f.thumb}" alt="">` : '';
  const flag = f.flagged ? `<span class="flagmark">${ic('flag-fill', 'sm')}</span>` : '';
  const fin = isFinal(f) ? `<span class="finalmark" style="position:absolute;right:10px;top:10px">${ic('lock', 'sm')}Final</span>` : '';
  return `<div class="cw${S.sel.has('f:' + f.id) ? ' is-selected' : ''}" style="height:100%">${sel}<button class="ftile" data-act="open-file" data-id="${f.id}" aria-label="${esc(f.name)}, ${k.label}">
      <span class="thumb ${locked ? '' : k.tile}" style="background:${f.thumb && !locked ? 'var(--surface-2)' : ''}">${thumb}${locked ? `<span class="lockbig">${ic('lock', 'xl')}</span>` : `<span class="big-ic">${ic(k.icon, 'lg')}</span>`}<span class="ext">${k.ext}</span>${flag}${fin}</span>
      <span class="fbody"><span class="t">${esc(locked ? f.name : f.name)}</span><span class="p">${locked ? 'Restricted · note hidden' : esc(f.note || k.label)}</span></span>
    </button><button class="more on-thumb" data-act="item-menu" data-kind="f" data-id="${f.id}" aria-label="More for ${esc(f.name)}" aria-haspopup="menu" style="top:8px;right:8px">${ic('more', 'sm')}</button></div>`;
}
function fileRowHTML(f) {
  const k = KINDS[f.kind];
  const sel = S.selMode ? `<span class="sel-box" role="checkbox" aria-checked="${S.sel.has('f:' + f.id)}" data-act="sel" data-key="f:${f.id}" tabindex="0" aria-label="Select ${esc(f.name)}" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);z-index:2">${S.sel.has('f:' + f.id) ? ic('check') : ''}</span>` : '';
  const locked = lockedFile(f);
  return `<div class="cw${S.sel.has('f:' + f.id) ? ' is-selected' : ''}" style="position:relative">${sel}<button class="row" data-act="open-file" data-id="${f.id}" style="${S.selMode ? 'padding-left:52px' : ''}"><span class="ktile ${k.tile}">${ic(k.icon)}</span><span class="mid"><span class="t">${f.flagged ? ic('flag-fill', 'sm') : ''}${esc(f.name)}</span><span class="p">${k.label} · ${locked ? 'Restricted' : esc(f.note || '')}${f.size ? ' · ' + fmtSize(f.size) : ''} · ${fmtDate(f.date)}</span></span>${isFinal(f) ? `<span class="finalmark">${ic('lock', 'sm')}Final</span>` : ''}</button><button class="more" data-act="item-menu" data-kind="f" data-id="${f.id}" aria-label="More for ${esc(f.name)}" aria-haspopup="menu">${ic('more', 'sm')}</button></div>`;
}

/* Grouping shelf (O4). MoM groups hold MoMs, file groups hold files. */
function shelfHTML(g, a, filtering) {
  const isMom = g.kind === 'mom';
  const items = isMom ? filteredItems(a.id).moms.filter(m => m.group === g.id) : filteredItems(a.id).files.filter(f => f.group === g.id);
  const total = isMom ? momsIn(a.id, g.id).length : filesIn(a.id, g.id).length;
  if (filtering && !items.length) return '';
  const add = isMom
    ? `<button class="shelf-add" data-act="new-mom" data-area="${a.id}" data-group="${g.id}">${ic('plus', 'sm')}New MoM<span class="hide-sm"> here</span></button>`
    : `<button class="shelf-add" data-act="upload" data-area="${a.id}" data-group="${g.id}">${ic('upload', 'sm')}Add file<span class="hide-sm"> here</span></button>`;
  const body = items.length
    ? (isMom ? `<div class="cards">${items.map(momCardHTML2).join('')}</div>` : (S.view === 'list' ? `<div class="flist">${items.map(fileRowHTML).join('')}</div>` : `<div class="ftiles">${items.map(fileTileHTML).join('')}</div>`))
    : `<div class="empty small"><div class="art">${ic(isMom ? 'doc' : 'upload')}</div><h3>Empty grouping</h3><p>${isMom ? 'Add a MoM here, or move one in.' : 'Add a file or link here, or move one in.'}</p></div>`;
  return `<section class="shelf${total === 0 ? ' is-empty' : ''}" aria-label="${esc(g.name)}"><div class="shelf-head"><span class="shelf-ic">${ic(isMom ? 'doc' : 'file', 'sm')}</span><b>${esc(g.name)}</b><span class="count">${total}</span><span class="spacer"></span>${add}<button class="icon-btn" data-act="group-menu" data-id="${g.id}" aria-label="More for ${esc(g.name)}" aria-haspopup="menu">${ic('more', 'sm')}</button></div>${body}</section>`;
}

/* ---------- Bulk bar (O7) ---------- */
function bulkBarHTML(areaId) {
  if (!S.sel.size) return '';
  const n = S.sel.size;
  const matching = matchingKeys(areaId).length;
  return `<div class="bulkbar" role="region" aria-label="Selection"><b>${n} selected</b>
    ${matching > n ? `<button class="link-btn" data-act="select-matching" data-area="${areaId}">Select all ${matching} matching</button>` : ''}
    <button class="btn btn-soft" data-act="bulk-move">${ic('move', 'sm')}Move…</button>
    <button class="btn btn-danger-soft" data-act="bulk-delete" ${adminAttr('deleteItem', 'delete items')}>${ic('trash', 'sm')}Delete</button>
    <button class="link-btn" data-act="clear-sel">Clear</button></div>`;
}
const refreshBulk = () => { const host = $('#bulkHost'); const r = route(); if (host && r.name === 'area') host.innerHTML = bulkBarHTML(r.id); };
on('sel', (d) => { const k = d.key; S.sel.has(k) ? S.sel.delete(k) : S.sel.add(k); render(); });
on('sel-card', (d, el, e) => { if (S.selMode) { e.preventDefault(); S.sel.has(d.key) ? S.sel.delete(d.key) : S.sel.add(d.key); render(); } });
on('toggle-select', () => { S.selMode = !S.selMode; if (!S.selMode) S.sel.clear(); render(); });
on('select-matching', (d) => { matchingKeys(d.area || null).forEach(k => S.sel.add(k)); render(); toast(`${S.sel.size} selected`, { icon: 'check-square' }); });
on('clear-sel', () => { S.sel.clear(); S.selMode = false; render(); });
on('clear-filter', () => { S.filter = ''; render(); });
on('sort', d => { S.sort = d.v; render(); });
on('fview', d => { S.view = d.v; render(); });
onInput('area-filter', (el) => { S.filter = el.value; const r = route(); if (r.name !== 'area') return; const keep = document.activeElement === el; const pos = el.selectionStart; render(); if (keep) { const n = $('[data-input="area-filter"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } });
on('relock', (d) => { S.unlocked.delete('a:' + d.id); toast('Locked again'); render(); });

/* Bulk move and delete. Areas are admin-only and never part of a bulk move here. */
on('bulk-move', () => {
  const keys = [...S.sel];
  const kind = keys.every(k => k.startsWith('m:')) ? 'mom' : keys.every(k => k.startsWith('f:')) ? 'file' : null;
  // An area can't move into itself or anything inside it (O3).
  const exclude = new Set(keys.filter(k => k.startsWith('a:')).flatMap(k => descIds(k.slice(2))));
  const onlyAreas = keys.every(k => k.startsWith('a:'));
  destPicker({ title: `Move ${keys.length} ${keys.length === 1 ? 'item' : 'items'}`, current: null, type: onlyAreas ? 'area' : 'place', itemKind: kind, exclude, cta: 'Move here', onPick: (p) => {
    keys.forEach(k => {
      const [t, id] = k.split(':');
      if (t === 'a') { const a = area(id); if (a) a.parent = p.area || null; return; }
      const it = t === 'm' ? mom(id) : file(id);
      if (it && p.area) { it.area = p.area; it.group = p.group || null; }
    });
    S.sel.clear(); S.selMode = false;
    toast(`Moved ${keys.length} ${keys.length === 1 ? 'item' : 'items'} to ${area(p.area).name}`, { icon: 'move' });
    render();
  } });
});
on('bulk-delete', () => {
  const keys = [...S.sel];
  const names = keys.map(k => { const [t, id] = k.split(':'); return t === 'a' ? `${area(id).name} (area, with everything inside)` : t === 'm' ? mom(id).title : file(id).name; });
  confirmDialog({
    title: `Delete ${keys.length} ${keys.length === 1 ? 'item' : 'items'}?`, text: 'They move to Deleted and can be restored for 7 days.',
    impact: `<b>Deleting:</b> ${names.map(n => esc(n)).join(', ')}`, danger: true, cta: 'Delete', act: 'bulk-delete-now',
  });
});
on('bulk-delete-now', () => {
  [...S.sel].forEach(k => { const [t, id] = k.split(':'); if (t === 'a') { if (area(id)) trashArea(id); } else if (t === 'm') trashMom(id); else trashFile(id); });
  S.sel.clear(); S.selMode = false; closeAll(); toast('Moved to Deleted', { icon: 'trash', action: { label: 'Open Deleted', act: 'go-deleted' } }); render();
});
on('go-deleted', () => go('#/deleted'));

/* ---------- Trash helpers (keep a snapshot for 7 days, O9) ---------- */
function trashMom(id) {
  const m = mom(id); if (!m) return;
  DB.moms = DB.moms.filter(x => x.id !== id);
  DB.deleted.unshift({ key: nid('d'), t: 'mom', name: m.title, at: TODAY_ISO, snap: { moms: [m] } });
}
function trashFile(id) {
  const f = file(id); if (!f) return;
  DB.files = DB.files.filter(x => x.id !== id);
  DB.deleted.unshift({ key: nid('d'), t: 'file', name: f.name, at: TODAY_ISO, snap: { files: [f] } });
}
function trashArea(id) {
  const ids = descIds(id);
  const snap = {
    areas: ids.map(i => area(i)).filter(Boolean),
    groups: DB.groups.filter(g => ids.includes(g.area)),
    moms: DB.moms.filter(m => ids.includes(m.area)),
    files: DB.files.filter(f => ids.includes(f.area)),
  };
  const a = area(id);
  DB.areas = DB.areas.filter(x => !ids.includes(x.id));

  DB.groups = DB.groups.filter(g => !ids.includes(g.area));
  DB.moms = DB.moms.filter(m => !ids.includes(m.area));
  DB.files = DB.files.filter(f => !ids.includes(f.area));
  DB.deleted.unshift({ key: nid('d'), t: 'area', name: a.name, at: TODAY_ISO, snap });
  if (S.place && S.place.area && !area(S.place.area)) S.place = { area: DB.areas[0] ? DB.areas[0].id : null, group: null };
}

/* ---------- Dialogs: create, rename, group, delete ---------- */
function areaOptions(selected, exclude = new Set()) {
  const out = [];
  const walk = (pid, d) => DB.areas.filter(a => a.parent === pid && canSee(a.id)).forEach(a => {
    out.push(`<option value="${a.id}" ${a.id === selected ? 'selected' : ''} ${exclude.has(a.id) ? 'disabled' : ''}>${'  '.repeat(d)}${a.emoji} ${esc(a.name)}</option>`);
    walk(a.id, d + 1);
  });
  walk(null, 0);
  return out.join('');
}
function newAreaDialog(parent = null) {
  let emoji = '🌿';
  layer({
    label: 'New area',
    html: `<form data-form="new-area" novalidate><div class="dlg-head"><div class="tt2"><h2>${parent ? 'New sub-area' : 'New area'}</h2><p>An area holds the MoMs and files for one client, team or initiative.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="field" id="fName"><label class="lab" for="anName">Name <em>required</em></label><input class="input" id="anName" name="name" autocomplete="off" placeholder="e.g. Harbor Logistics"><span class="ferr" role="alert">Give the area a name, so you can find it later.</span></div>
      <div class="field"><span class="lab" id="emLab">Emoji</span><div class="emoji-grid" role="radiogroup" aria-labelledby="emLab">${EMOJIS.map((e, i) => `<button type="button" role="radio" aria-checked="${e === emoji}" data-act="pick-emoji" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div><input type="hidden" name="emoji" value="${emoji}"></div>
      <label class="field" style="margin-bottom:0"><span class="lab" style="margin-bottom:8px">Location</span><select class="select" name="parent">${`<option value="">Top level</option>`}${areaOptions(parent)}</select></label>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Create area</button></div></form>`,
    onMount(panel) { panel.querySelector('form').dataset.parent = parent || ''; },
  });
}
on('new-area', (d) => { if (!isAdmin()) return; newAreaDialog(d.parent || null); });
on('pick-emoji', (d, el) => {
  const f = el.closest('form');
  f.querySelectorAll('[role=radio]').forEach(b => b.setAttribute('aria-checked', String(b === el)));
  f.emoji.value = d.e;
});
onForm('new-area', (f) => {
  const name = f.elements.name.value.trim();
  $('#fName').classList.toggle('err', !name);
  if (!name) { f.elements.name.focus(); return; }
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + (++uid);
  const a = { id, name, emoji: f.emoji.value, parent: f.parent.value || null, created: TODAY_ISO, tint: ['tint-sky', 'tint-mint', 'tint-sun', 'tint-lilac', 'tint-rose'][DB.areas.length % 5] };
  DB.areas.push(a);
  S.open.add(a.parent);
  closeAll();
  toast(`Created “${name}”${a.parent ? ' inside ' + area(a.parent).name : ''}`, { icon: 'shelf' });
  go(`#/areas/${a.id}`);
});

/* Rename: area name and emoji, MoM title, or file name (O2, O6). */
function renameDialog(kind, id) {
  const item = kind === 'area' ? area(id) : kind === 'mom' ? mom(id) : file(id);
  if (!item) return;
  const label = kind === 'area' ? 'area' : kind === 'mom' ? 'MoM' : 'file';
  const val = kind === 'area' ? item.name : kind === 'mom' ? item.title : item.name;
  const blocked = (kind !== 'area' && readOnly(item));
  layer({
    label: `Rename ${label}`,
    html: `<form data-form="rename" data-kind="${kind}" data-id="${id}" novalidate><div class="dlg-head"><div class="tt2"><h2>Rename ${label}</h2><p>${kind === 'area' ? 'Change the name, and the emoji that marks it.' : 'Titles help you find things in search.'}</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="field" id="fRen"><label class="lab" for="renIn">Name <em>required</em></label><input class="input" id="renIn" name="name" value="${esc(val)}" autocomplete="off"><span class="ferr" role="alert">Give it a name.</span></div>
      ${kind === 'area' ? `<div class="field"><span class="lab" id="emLab2">Emoji</span><div class="emoji-grid" role="radiogroup" aria-labelledby="emLab2">${EMOJIS.map(e => `<button type="button" role="radio" aria-checked="${e === item.emoji}" data-act="pick-emoji" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div><input type="hidden" name="emoji" value="${item.emoji}"></div>` : ''}
      ${blocked ? `<div class="notice warn" style="margin-bottom:6px">${ic('lock')}<div><b>Marked final.</b> Only an admin can change it.</div></div>` : ''}
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" type="submit" ${blocked ? 'disabled' : ''}>Save</button></div></form>`,
  });
}
on('rename', (d) => renameDialog(d.kind, d.id));
onForm('rename', (f) => {
  const name = f.elements.name.value.trim();
  $('#fRen').classList.toggle('err', !name);
  if (!name) { f.elements.name.focus(); return; }
  const { kind, id } = f.dataset;
  if (kind === 'area') { const a = area(id); a.name = name; a.emoji = f.emoji.value; }
  if (kind === 'mom') mom(id).title = name;
  if (kind === 'file') file(id).name = name;
  closeAll();
  toast('Renamed', { icon: 'pencil' });
  render();
});

/* New grouping (O4): name it, and say which kind of item it holds. */
function newGroupDialog(areaId) {
  if (!areaId) return toast('Choose an area first', { icon: 'alert', tone: 'warn' });
  layer({
    label: 'New grouping',
    html: `<form data-form="new-group" data-area="${areaId}" novalidate><div class="dlg-head"><div class="tt2"><h2>New grouping</h2><p>A grouping bunches things inside ${esc(area(areaId).name)}. Removing one keeps its contents here.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="field" id="fGrp"><label class="lab" for="grpIn">Name <em>required</em></label><input class="input" id="grpIn" name="name" autocomplete="off" placeholder="e.g. Steering committee"><span class="ferr" role="alert">Give the grouping a name.</span></div>
      <fieldset class="field" style="border:0;padding:0"><legend class="lab" style="padding:0">Holds</legend><div class="kinds"><label class="kind" style="cursor:pointer"><input type="radio" name="kind" value="mom" checked class="sr">${ic('doc')}MoMs</label><label class="kind" style="cursor:pointer"><input type="radio" name="kind" value="file" class="sr">${ic('file')}Files and links</label></div></fieldset>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Create grouping</button></div></form>`,
  });
}
on('new-group', (d) => newGroupDialog(d.area || (createPlace(route()) || {}).area));
onForm('new-group', (f) => {
  const name = f.elements.name.value.trim();
  $('#fGrp').classList.toggle('err', !name);
  if (!name) return;
  const kind = f.kind.value;
  DB.groups.push({ id: nid('g-'), area: f.dataset.area, kind, name });
  closeAll();
  toast(`Added grouping “${name}”`, { icon: 'folder-plus' });
  render();
});
on('group-menu', (d, el) => {
  const g = group(d.id);
  menu(el, [
    { label: 'Rename grouping', icon: 'pencil', act: 'rename-group', data: { id: g.id } },
    '-',
    { label: 'Remove grouping', icon: 'trash', act: 'remove-group', data: { id: g.id }, danger: true, admin: { k: 'removeGroup', label: 'remove groupings' } },
  ], 'Grouping');
});
on('rename-group', (d) => {
  const g = group(d.id);
  layer({ label: 'Rename grouping', html: `<form data-form="rename-group" data-id="${g.id}" novalidate><div class="dlg-head"><div class="tt2"><h2>Rename grouping</h2></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div><div class="field"><label class="lab" for="rgIn">Name</label><input class="input" id="rgIn" name="name" value="${esc(g.name)}"></div><div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>` });
});
onForm('rename-group', (f) => { const g = group(f.dataset.id); const v = f.elements.name.value.trim(); if (v) g.name = v; closeAll(); toast('Renamed', { icon: 'pencil' }); render(); });
on('remove-group', (d) => {
  const g = group(d.id);
  const moms = momsIn(g.area, g.id).length, files = filesIn(g.area, g.id).length;
  confirmDialog({ title: `Remove “${g.name}”?`, text: 'Removing a grouping keeps everything in it, in the area.', impact: `${plural(moms, 'MoM')} and ${plural(files, 'file')} stay in ${esc(area(g.area).name)}.`, cta: 'Remove grouping', act: 'remove-group-now', data: { id: g.id } });
});
on('remove-group-now', (d) => {
  const g = group(d.id);
  const movedM = DB.moms.filter(m => m.group === g.id).map(m => m.id);
  const movedF = DB.files.filter(f => f.group === g.id).map(f => f.id);
  DB.moms.forEach(m => { if (m.group === g.id) m.group = null; });
  DB.files.forEach(f => { if (f.group === g.id) f.group = null; });
  DB.groups = DB.groups.filter(x => x.id !== g.id);
  DB.deleted.unshift({ key: nid('d'), t: 'group', name: g.name, at: TODAY_ISO, snap: { groups: [g] } });
  closeAll(); toast('Grouping removed. Its contents stayed in the area.', { icon: 'folder-plus', action: { label: 'Undo', act: 'undo', data: { key: 'g' + g.id } } });
  UNDO['g' + g.id] = () => {
    DB.groups.push(g);
    movedM.forEach(id => { if (mom(id)) mom(id).group = g.id; });
    movedF.forEach(id => { if (file(id)) file(id).group = g.id; });
    DB.deleted = DB.deleted.filter(x => x.snap.groups?.[0]?.id !== g.id);
    render();
  };
  render();
});

/* Area menu (move, restrict, share, delete) */
on('area-menu', (d, el) => {
  const a = area(d.id);
  const restricted = !!a.restricted;
  menu(el, [
    { label: 'Rename or change emoji', icon: 'pencil', act: 'rename', data: { kind: 'area', id: a.id } },
    { label: 'New sub-area', icon: 'shelf', act: 'new-area', data: { parent: a.id }, admin: { k: 'createArea', label: 'create sub-areas' } },
    { label: 'New grouping', icon: 'folder-plus', act: 'new-group', data: { area: a.id } },
    { label: 'Select several', icon: 'check-square', act: 'toggle-select' },
    '-',
    { label: 'Move to…', icon: 'move', act: 'move-area', data: { id: a.id }, admin: { k: 'moveArea', label: 'move areas' } },
    { label: restricted ? 'Remove password' : 'Restrict with password', icon: restricted ? 'unlock' : 'lock', act: restricted ? 'unrestrict' : 'restrict', data: { kind: 'a', id: a.id } },
    { label: 'Share a link', icon: 'share', act: 'share', data: { kind: 'a', id: a.id }, admin: { k: 'shareLinks', label: 'share links' } },
    { label: 'Access', icon: 'users', act: 'access', data: { id: a.id }, admin: { k: 'access', label: 'change access' } },
    '-',
    { label: 'Delete area', icon: 'trash', act: 'delete-area', data: { id: a.id }, danger: true, admin: { k: 'deleteItem', label: 'delete areas' } },
  ], 'Area');
});
on('move-area', (d) => {
  const a = area(d.id);
  const excl = new Set(descIds(a.id));
  destPicker({ title: `Move ${a.name}`, current: { area: a.parent }, type: 'area', exclude: excl, cta: 'Move here', onPick: (p) => {
    const old = a.parent;
    a.parent = p.area || null;
    S.open.add(a.parent);
    UNDO['mv' + a.id] = () => { a.parent = old; render(); };
    toast(`Moved ${a.name}`, { icon: 'move', action: { label: 'Undo', act: 'undo', data: { key: 'mv' + a.id } } });
    render();
  } });
});
on('delete-area', (d) => {
  const a = area(d.id);
  const c = contents(a.id);
  confirmDialog({
    title: `Delete “${a.name}”?`, text: 'The area goes to Deleted, with everything inside it. It stays recoverable for 7 days.',
    impact: `<b>This includes ${plural(c.areas, 'sub-area')}, ${plural(c.moms, 'MoM')}, ${plural(c.files, 'file')} and ${plural(c.groups, 'grouping')}.</b> Nothing is lost until the 7 days pass.`,
    danger: true, cta: 'Delete area', act: 'delete-area-now', data: { id: a.id },
  });
});
on('delete-area-now', (d) => {
  const a = area(d.id);
  trashArea(a.id);
  closeAll();
  toast(`Deleted “${a.name}”`, { icon: 'trash', action: { label: 'Open Deleted', act: 'go-deleted' } });
  go('#/areas');
});
on('item-menu', (d, el) => {
  const isMom = d.kind === 'm';
  const id = d.id;
  const item = isMom ? mom(id) : file(id);
  const ro = readOnly(item);
  const items = [];
  if (!isMom) items.push({ label: 'Open', icon: 'external', act: 'open-file', data: { id } });
  if (isMom) items.push({ label: 'Open MoM', icon: 'doc', act: 'open-mom', data: { id } });
  items.push({ label: item.flagged ? 'Unflag' : 'Flag as important', icon: item.flagged ? 'flag' : 'flag-fill', act: 'flag', data: { kind: d.kind, id } });
  items.push({ label: 'Rename', icon: 'pencil', act: ro ? null : 'rename', data: { kind: isMom ? 'mom' : 'file', id }, note: ro ? 'Final' : '' });
  items.push({ label: 'Move to…', icon: 'move', act: ro ? null : 'move-item', data: { kind: d.kind, id }, note: ro ? 'Final' : '' });
  if (!isMom) items.push({ label: item.restricted ? 'Remove password' : 'Restrict with password', icon: item.restricted ? 'unlock' : 'lock', act: ro ? null : 'restrict', data: { kind: 'f', id }, note: ro ? 'Final' : '' });
  if (!isMom) { items.push('-'); items.push({ label: 'Download', icon: 'download', act: 'download', data: { id } }); items.push({ label: 'Copy address', icon: 'copy', act: 'copy-address', data: { id } }); }
  items.push('-');
  items.push({ label: isFinal(item) ? 'Unmark final' : 'Mark as final', icon: 'lock', act: 'final', data: { kind: d.kind, id }, admin: { k: 'final', label: 'mark MoMs and files as final' } });
  items.push({ label: 'Share a link', icon: 'share', act: 'share', data: { kind: d.kind, id }, admin: { k: 'shareLinks', label: 'share links' } });
  items.push('-');
  items.push({ label: 'Delete', icon: 'trash', act: 'delete-item', data: { kind: d.kind, id }, danger: true, admin: { k: 'deleteItem', label: 'delete items' } });
  menu(el, items.map(it => (it !== '-' && it.act === null ? { ...it, act: 'blocked-final' } : it)), isMom ? 'MoM' : 'File');
});
on('blocked-final', (d, el) => toast('This is marked final, so it can’t be changed.', { icon: 'lock', tone: 'warn' }));
on('open-mom', (d) => go(`#/mom/${d.id}`));
on('move-item', (d) => moveItem(d.kind, d.id));
on('delete-item', (d) => {
  const item = d.kind === 'm' ? mom(d.id) : file(d.id);
  confirmDialog({ title: `Delete “${d.kind === 'm' ? item.title : item.name}”?`, text: 'It goes to Deleted and stays recoverable for 7 days.', impact: d.kind === 'm' ? 'Its link to the area is kept until you restore or remove it.' : '', danger: true, cta: 'Delete', act: 'delete-item-now', data: { kind: d.kind, id: d.id } });
});
on('delete-item-now', (d) => {
  const item = d.kind === 'm' ? mom(d.id) : file(d.id);
  const name = d.kind === 'm' ? item.title : item.name;
  if (d.kind === 'm') trashMom(d.id); else trashFile(d.id);
  closeAll();
  toast(`Moved “${name}” to Deleted`, { icon: 'trash', action: { label: 'Open Deleted', act: 'go-deleted' } });
  render();
});

/* Move one item (O5): shows where it is now, searchable destinations, undo. */
function moveItem(kind, id) {
  const item = kind === 'm' || kind === 'mom' ? mom(id) : file(id);
  const itemKind = kind === 'm' || kind === 'mom' ? 'mom' : 'file';
  const cur = { area: item.area, group: item.group };
  destPicker({ title: `Move “${itemKind === 'mom' ? item.title : item.name}”`, current: cur, type: 'place', itemKind, cta: 'Move here', onPick: (p) => {
    const old = { area: item.area, group: item.group };
    item.area = p.area; item.group = p.group || null;
    UNDO['mi' + id] = () => { item.area = old.area; item.group = old.group; render(); };
    toast(`Moved to ${placeName(p)}`, { icon: 'move', action: { label: 'Undo', act: 'undo', data: { key: 'mi' + id } } });
    render();
  } });
}

/* ---------- Destination picker (O5 move, O1 location, place choice) ---------- */
function destRowsFor({ type, exclude = new Set(), itemKind = null, q = '' }) {
  const term = q.trim().toLowerCase();
  const rows = [];
  if (type === 'area') rows.push({ kind: 'top', id: '', depth: 0, label: 'Top level', sub: 'Highest level of the workspace' });
  const walk = (pid, d) => DB.areas.filter(a => a.parent === pid && canSee(a.id)).forEach(a => {
    const path = crumbPath(a.id).slice(0, -1).map(x => x.name).join(' › ');
    const locked = !!lockedArea(a.id);
    rows.push({ kind: 'area', id: a.id, depth: d, label: a.name, sub: path || 'Top level', disabled: exclude.has(a.id) || locked, lock: locked });
    if (type === 'place') groupsIn(a.id).forEach(g => rows.push({ kind: 'group', id: g.id, area: a.id, depth: d + 1, label: g.name, sub: `${a.name} · grouping, ${g.kind === 'mom' ? 'MoMs' : 'files'}`, disabled: itemKind && g.kind !== itemKind }));
    walk(a.id, d + 1);
  });
  walk(null, 0);
  return rows.filter(r => !term || r.label.toLowerCase().includes(term) || (r.sub || '').toLowerCase().includes(term) || r.kind === 'top');
}
function destPicker({ title, current, type = 'area', exclude = new Set(), itemKind = null, cta, onPick }) {
  let sel = null;
  const curText = current && current.area ? `Currently in <b>${esc(placeName(current))}</b>` : (type === 'area' ? 'Currently at the <b>top level</b>' : 'Choose a destination');
  const rowHTML = () => {
    const rows = destRowsFor({ type, exclude, itemKind, q: $('#destQ') ? $('#destQ').value : '' });
    if (!rows.length) return `<div class="noresult"><b>No destination matches</b>Try another name, or clear the search.</div>`;
    return rows.map((r, i) => `<button type="button" class="dest" role="option" id="dest-${i}" aria-selected="${sel && sel.kind === r.kind && sel.id === r.id && sel.area === r.area}" aria-disabled="${!!r.disabled}" data-act="pick-dest" data-i="${i}" style="padding-left:${12 + r.depth * 18}px">
      ${r.kind === 'group' ? `<span class="gi" style="width:26px;display:grid;place-items:center;color:var(--accent-strong)">${ic('shelf', 'sm')}</span>` : `<span class="em">${r.kind === 'top' ? '⬆️' : (area(r.id) ? area(r.id).emoji : '')}</span>`}
      <span class="mid"><b>${esc(r.label)}</b><small>${esc(r.sub)}${r.disabled ? ' · can’t move here' : ''}</small></span>${r.kind === 'group' ? `<span class="badge">${r.disabled ? 'Wrong kind' : 'Grouping'}</span>` : ''}</button>`).join('');
  };
  let flat = [];
  layer({
    label: title,
    html: `<div class="dlg-head"><div class="tt2"><h2>${esc(title)}</h2><p>${curText}</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="dest-search">${ic('search', 'sm')}<input class="input" id="destQ" type="search" placeholder="Search areas and groupings" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="destList" aria-label="Search destinations"></div>
      <div class="dests" id="destList" role="listbox" aria-label="Destinations">${rowHTML()}</div>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" id="destGo" disabled>${esc(cta)}</button></div>`,
    onMount(panel, L) {
      const q = panel.querySelector('#destQ');
      const list = panel.querySelector('#destList');
      const go2 = panel.querySelector('#destGo');
      const pick = (i) => {
        const r = flat[i];
        if (!r || r.disabled) return;
        sel = r;
        list.innerHTML = rowHTML();
        go2.disabled = false;
      };
      const refresh = () => { list.innerHTML = rowHTML(); };
      q.addEventListener('input', () => { sel = null; go2.disabled = true; refresh(); });
      q.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const rows = $$('.dest', list); const cur = rows.findIndex(r => r.getAttribute('aria-selected') === 'true'); const n = Math.min(rows.length - 1, Math.max(0, cur + (e.key === 'ArrowDown' ? 1 : -1))); rows[n] && rows[n].click(); }
        if (e.key === 'Enter' && !go2.disabled) { e.preventDefault(); go2.click(); }
      });
      // pick handler closes over the flat list built for this render
      panel.addEventListener('click', e => {
        const b = e.target.closest('[data-act="pick-dest"]');
        if (b) pick(Number(b.dataset.i));
      });
      flat = destRowsFor({ type, exclude, itemKind });
      list.addEventListener('click', () => { flat = destRowsFor({ type, exclude, itemKind, q: q.value }); });
      go2.addEventListener('click', () => {
        if (!sel) return;
        const p = sel.kind === 'area' ? { area: sel.id } : sel.kind === 'top' ? { area: null } : { area: sel.area, group: sel.id };
        if (type === 'area') p.area = sel.kind === 'top' ? null : sel.id;
        L.close();
        onPick(p);
      });
      // keep the flat list in step with the search box
      q.addEventListener('input', () => { flat = destRowsFor({ type, exclude, itemKind, q: q.value }); });
      flat = destRowsFor({ type, exclude, itemKind, q: '' });
    },
  });
}
on('pick-dest', () => {});
