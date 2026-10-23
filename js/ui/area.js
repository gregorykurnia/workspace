/* The Area page (F2, F5, F6, F8, F9, F10, F14, O3–O8, P2, P3): header, sub-areas, filter, sort,
   groupings and their shelves, MoM cards, file tiles and rows, selecting several with the bulk
   bar, the destination picker (Move), Undo, and the menus. Reads through the data layer. */
'use strict';

/* ---------- What the page shows ---------- */
const matchTerm = () => UI.filter.trim().toLowerCase();
const itemTime = x => Number(x.date) || Number(x.created) || 0;
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
/* Everything in an area that matches the filter, in the chosen order. */
function areaItems(a) {
  const t = matchTerm(), hit = s => !t || String(s || '').toLowerCase().includes(t);
  const az = UI.sort === 'az';
  const pick = (x, y) => (az ? byName(x, y) : y.at - x.at);
  const subs = kids(a.id).filter(k => canSee(k.id) && hit(k.name));
  const moms = momsOf(a.id)
    .filter(m => hit(m.title) || (t && plainText(m.content, m.id).toLowerCase().includes(t)))
    .map(m => ({ m, name: m.title || 'Untitled meeting', at: itemTime(m) })).sort(pick).map(x => x.m);
  const files = docsOf(a.id)
    .filter(d => hit(d.name) || hit(d.note))
    .map(d => ({ d, name: d.name || 'Untitled file', at: docAddedValue(d) })).sort(pick).map(x => x.d);
  return { subs, moms, files };
}
/* Groupings of an area, MoM and file ones together. kind is 'mom', 'file' or 'both' (holds both). */
const groupsOf = a => [
  ...momFoldersOf(a.id).map(g => ({ id: g.id, name: g.name || 'Grouping', kind: g.holds === 'both' ? 'both' : 'mom' })),
  ...docFoldersOf(a.id).map(g => ({ id: g.id, name: g.name || 'Grouping', kind: 'file' })),
].sort(byName);
/* Keys of everything matching the filter, for "Select all N matching" (O7). */
function matchingKeys(r) {
  if (r.name === 'areas') return isAdmin() ? visibleRoots().map(a => 'a:' + a.id) : [];
  const a = area(r.id); if (!a) return [];
  const { subs, moms, files } = areaItems(a);
  return [...(isAdmin() ? subs.map(x => 'a:' + x.id) : []), ...moms.map(m => 'm:' + m.id), ...files.map(d => 'f:' + d.id)];
}

/* ---------- Cards ---------- */
const momCardFor = m => momCardHTML({ id: m.id, title: m.title || 'Untitled meeting', date: isoOf(m.date), flagged: !!m.starred, final: !!m.readOnly, preview: notePreview(m.content, m.id), tags: Array.isArray(m.tags) ? m.tags : [], selectable: UI.selMode, selected: UI.sel.has('m:' + m.id) });
function fileProps(d) {
  const kind = docKind(d), at = docAddedValue(d);
  return { id: d.id, name: d.name || 'Untitled file', kind, note: d.note || '', locked: lockedFile(d), flagged: !!d.starred, final: !!d.readOnly, selectable: UI.selMode, selected: UI.sel.has('f:' + d.id), date: at ? isoOf(at) : '', thumb: kind === 'image' ? thumbUrl(d) : '' };
}
const fileTileFor = d => fileTileHTML(fileProps(d));
const fileRowFor = d => fileRowHTML(fileProps(d));
const filesHTML = list => (UI.fileView === 'list' ? `<div class="flist">${list.map(fileRowFor).join('')}</div>` : `<div class="ftiles">${list.map(fileTileFor).join('')}</div>`);

const sectionHTML = (id, title, count, add, body) => `<section class="section" aria-labelledby="${id}"><div class="section-head"><h2 class="h2" id="${id}">${title}${count ? ` <span class="count">${count}</span>` : ''}</h2><span class="spacer"></span>${add}</div>${body}</section>`;
const noAccessAreaHTML = a => `<div class="locked locked-top locked-plain"><div class="art">${ic('lock')}</div><h1>You don’t have access to ${esc(a.name)}</h1><p>An admin can grant you access. Everything inside the area will show once they do.</p>${btnHTML({ kind: 'soft', label: 'Back to Today', href: '#/today' })}</div>`;
const missingAreaHTML = () => `<div class="page">${emptyHTML({ icon: 'shelf', title: 'This area isn’t here', text: 'It may have moved to Deleted, or the link may be out of date.', actions: btnHTML({ kind: 'primary', label: 'Go to Today', href: '#/today' }) + btnHTML({ kind: 'soft', label: 'Open Deleted', href: '#/deleted' }) })}</div>`;

function shelfFor(g, a, items, filtering) {
  const holdsMoms = g.kind !== 'file', holdsFiles = g.kind !== 'mom';
  const moms = holdsMoms ? items.moms.filter(m => m.momFolderId === g.id) : [];
  const files = holdsFiles ? items.files.filter(d => d.docFolderId === g.id) : [];
  const total = (holdsMoms ? momsOfMF(g.id).length : 0) + (holdsFiles ? docsOfDF(g.id).length : 0);
  if (filtering && !moms.length && !files.length) return '';
  const emptyText = g.kind === 'both' ? 'Add a MoM, a file or a link here, or move one in.' : holdsMoms ? 'Add a MoM here, or move one in.' : 'Add a file or link here, or move one in.';
  const body = moms.length || files.length
    ? (moms.length ? `<div class="cards">${moms.map(momCardFor).join('')}</div>` : '') + (files.length ? filesHTML(files) : '')
    : emptyHTML({ small: true, icon: holdsMoms ? 'doc' : 'upload', title: 'Empty grouping', text: emptyText });
  return shelfBoxHTML({ name: g.name, kind: g.kind, count: total, addData: { area: a.id, group: g.id }, groupId: g.id, body });
}

/* ---------- Bulk bar ---------- */
const bulkHTML = r => (UI.sel.size ? bulkPillHTML({ count: UI.sel.size, matching: matchingKeys(r).length, canDelete: isAdmin() }) : '');
/* Selecting changes the cards in place (the keyboard keeps its place), not the whole page. */
function refreshSelection() {
  $$('#view .sel-box').forEach(b => {
    const on = UI.sel.has(b.dataset.key);
    b.setAttribute('aria-checked', String(on));
    b.innerHTML = on ? ic('check') : '';
    const cw = b.closest('.cw'); if (cw) cw.classList.toggle('is-selected', on);
  });
  const host = $('#bulkHost'); if (host) host.innerHTML = bulkHTML(route());
}
const toggleKey = k => { UI.sel.has(k) ? UI.sel.delete(k) : UI.sel.add(k); refreshSelection(); };
on('sel', d => toggleKey(d.key));
on('sel-card', d => { if (UI.selMode) toggleKey(d.key); });
on('toggle-select', () => { UI.selMode = !UI.selMode; if (!UI.selMode) UI.sel.clear(); render(); });
on('select-matching', () => { matchingKeys(route()).forEach(k => UI.sel.add(k)); refreshSelection(); toast(`${UI.sel.size} selected`, { icon: 'check-square' }); });
on('clear-sel', () => { UI.sel.clear(); UI.selMode = false; render(); });
on('clear-filter', () => { UI.filter = ''; render(); });
on('sort', d => { UI.sort = d.v === 'az' ? 'az' : 'newest'; render(); });
on('fview', d => { UI.fileView = d.v === 'list' ? 'list' : 'grid'; lsSet('G_fview', UI.fileView); render(); });
onInput('filter', el => { UI.filter = el.value; render(); });
on('relock', d => { UF.delete(d.id); toast('Locked again', { icon: 'lock' }); render(); });

/* ---------- The page ---------- */
VIEWS.area = {
  html(r) {
    const a = area(r.id);
    if (!a) return missingAreaHTML();
    if (!canSee(a.id)) return `<div class="page">${noAccessAreaHTML(a)}</div>`;
    const lock = lockedArea(a.id);
    if (lock) return lockedGateHTML({ id: lock.id, name: lock.name, targetName: lock.id === a.id ? '' : a.name });
    const items = areaItems(a), { subs, moms, files } = items;
    const all = contents(a.id), groups = groupsOf(a);
    const empty = !all.areas && !all.moms && !all.files && !groups.length;
    const filtering = !!matchTerm();
    const count = subs.length + moms.length + files.length;
    const path = crumbPath(a.id);
    const known = new Set(groups.map(g => g.id));
    const looseMoms = moms.filter(m => !m.momFolderId || !known.has(m.momFolderId));
    const looseFiles = files.filter(d => !d.docFolderId || !known.has(d.docFolderId));
    const created = a.created ? `Created ${fmtDate(isoOf(a.created))}${ageText(a.created) ? ' · ' + ageText(a.created) : ''}` : '';
    const selSubs = UI.selMode && isAdmin();
    const subsHTML = subs.length || (isAdmin() && !filtering)
      ? sectionHTML('subs', 'Sub-areas', subs.length, '', `<div class="subgrid">${subs.map(s => { const locked = !!lockedArea(s.id), c = locked ? null : countsOf(s.id); return subCardHTML({ id: s.id, name: s.name, emoji: areaEmoji(s), tint: tintOf(s), moms: c ? c.moms : 0, files: c ? c.files : 0, locked, selectable: selSubs, selected: UI.sel.has('a:' + s.id) }); }).join('')}${isAdmin() && !filtering ? newSubCardHTML({ parentId: a.id }) : ''}</div>`)
      : '';
    return `<div class="page">
      <nav class="crumbs phone-only" aria-label="Where you are">${path.map((x, i) => `${i ? `<span class="crumb-sep" aria-hidden="true">${ic('chev-r', 'sm')}</span>` : ''}<a class="crumb" href="${areaHref(x.id)}"${i === path.length - 1 ? ' aria-current="page"' : ''}>${emojiLead(x)}${esc(x.name)}</a>`).join('')}</nav>
      <div class="ahead">
        <span class="blob ${tintOf(a)}">${esc(areaEmoji(a))}</span>
        <div class="ttl">
          <p class="eyebrow">${path.length > 1 ? 'Sub-area' : 'Area'}${a.pw ? ' · Restricted' : ''}</p>
          <h1 class="h-page">${esc(a.name)}</h1>
          <div class="meta"><span>${sizeText(a.id)}</span>${created ? `<span>${esc(created)}</span>` : ''}${a.pw ? lockPillHTML({ open: UF.has(a.id), id: a.id }) : ''}</div>
        </div>
        <div class="aactions">
          ${btnHTML({ kind: 'primary', label: 'New MoM', icon: 'plus', act: 'new-mom', data: { area: a.id } })}
          ${btnHTML({ kind: 'soft', label: 'Upload', icon: 'upload', act: 'upload', data: { area: a.id } })}
          ${btnHTML({ kind: 'soft', label: 'Save link', icon: 'link', act: 'save-link', data: { area: a.id } })}
          <button type="button" class="icon-btn" data-act="area-menu" data-id="${esc(a.id)}" aria-label="More actions for ${esc(a.name)}" aria-haspopup="menu">${ic('more')}</button>
        </div>
      </div>
      ${subsHTML}
      <div class="filterbar" role="search">
        ${searchInHTML({ value: UI.filter, label: 'Filter this area', placeholder: 'Filter this area' })}
        <div class="seg" role="group" aria-label="Sort"><button type="button" data-act="sort" data-v="newest" aria-pressed="${UI.sort !== 'az'}">Newest</button><button type="button" data-act="sort" data-v="az" aria-pressed="${UI.sort === 'az'}">A–Z</button></div>
        <div class="seg phone-hide" role="group" aria-label="Files view"><button type="button" data-act="fview" data-v="grid" aria-pressed="${UI.fileView !== 'list'}" aria-label="Tiles">${ic('grid', 'sm')}</button><button type="button" data-act="fview" data-v="list" aria-pressed="${UI.fileView === 'list'}" aria-label="List">${ic('list', 'sm')}</button></div>
        <span class="spacer"></span>
        <button type="button" class="btn btn-soft btn-sm" data-act="toggle-select" aria-pressed="${UI.selMode}">${ic('check-square', 'sm')}${UI.selMode ? 'Done selecting' : 'Select'}</button>
      </div>
      ${count === 0 && !empty ? noResultHTML({ title: `No matches for “${UI.filter.trim()}”`, text: `Nothing in ${a.name} matches.`, action: btnHTML({ kind: 'soft', sm: true, label: 'Clear filter', act: 'clear-filter' }), cls: 'noresult-spaced' }) : ''}
      ${empty && !filtering ? emptyHTML({ icon: 'sparkle', title: `Nothing in ${a.name} yet`, text: 'Start with a meeting, a file, or a link. Groupings and sub-areas are optional and can come later.', actions: btnHTML({ kind: 'primary', label: 'New MoM', icon: 'plus', act: 'new-mom', data: { area: a.id } }) + btnHTML({ kind: 'soft', label: 'Upload a file', icon: 'upload', act: 'upload', data: { area: a.id } }) + btnHTML({ kind: 'soft', label: 'Save a link', icon: 'link', act: 'save-link', data: { area: a.id } }) + (isAdmin() ? btnHTML({ kind: 'soft', label: 'New sub-area', icon: 'shelf', act: 'new-area', data: { parent: a.id } }) : ''), cls: 'empty-spaced' }) : ''}
      ${groups.map(g => shelfFor(g, a, items, filtering)).join('')}
      ${looseMoms.length || (!filtering && !empty) ? sectionHTML('mtg', 'Meeting notes', looseMoms.length, `<button type="button" class="shelf-add" data-act="new-mom" data-area="${esc(a.id)}">${ic('plus', 'sm')}New MoM<span class="hide-sm"> here</span></button>`, looseMoms.length ? `<div class="cards">${looseMoms.map(momCardFor).join('')}</div>` : (filtering ? '' : emptyHTML({ small: true, icon: 'doc', title: 'No meeting notes yet', text: 'Start the first MoM for this area.' }))) : ''}
      ${looseFiles.length || (!filtering && !empty) ? sectionHTML('fls', 'Files and links', looseFiles.length, `<button type="button" class="shelf-add" data-act="upload" data-area="${esc(a.id)}">${ic('upload', 'sm')}Upload<span class="hide-sm"> here</span></button>`, looseFiles.length ? filesHTML(looseFiles) : (filtering ? '' : emptyHTML({ small: true, icon: 'upload', title: 'No files yet', text: 'Upload a file or save a link to keep it with this area.' }))) : ''}
      <div id="bulkHost">${bulkHTML(r)}</div>
    </div>`;
  },
};

/* ---------- Move: the destination picker (O3, O5) ---------- */
/* Rows for the picker: areas the viewer can see (restricted ones are shown but closed, and nothing
   inside them), and, when picking a place, the groupings of each area. */
function destRows({ type, exclude, itemKind, q }) {
  const term = q.trim().toLowerCase(), rows = [];
  if (type === 'area') rows.push({ kind: 'top', id: '', depth: 0, label: 'Top level', sub: 'Highest level of the workspace' });
  const visible = new Set(visibleAreas().map(a => a.id));
  const walk = (list, d) => list.forEach(a => {
    const locked = !!lockedArea(a.id);
    const path = crumbPath(a.id).slice(0, -1).map(x => x.name).join(' › ');
    rows.push({ kind: 'area', id: a.id, depth: d, label: a.name, emoji: areaEmoji(a), sub: path || 'Top level', disabled: exclude.has(a.id) || locked, lock: locked });
    if (locked) return;
    if (type === 'place') groupsOf(a).forEach(g => rows.push({ kind: 'group', id: g.id, area: a.id, depth: d + 1, label: g.name, sub: `${a.name} · grouping, ${g.kind === 'both' ? 'MoMs and files' : g.kind === 'mom' ? 'MoMs' : 'files'}`, disabled: g.kind !== 'both' && (itemKind === 'mixed' || (!!itemKind && itemKind !== g.kind)) }));
    walk(kids(a.id).filter(k => visible.has(k.id)), d + 1);
  });
  walk(visibleRoots(), 0);
  return rows.filter(r => !term || r.kind === 'top' || r.label.toLowerCase().includes(term) || (r.sub || '').toLowerCase().includes(term));
}
const rowKey = r => `${r.kind}:${r.area || ''}:${r.id}`;
function destListHTML(P) {
  if (!P.rows.length) return noResultHTML({ title: 'No destination matches', text: 'Try another name, or clear the search.' });
  return P.rows.map((r, i) => {
    const lead = r.kind === 'group' ? `<span class="gi">${ic('shelf', 'sm')}</span>` : r.kind === 'top' ? `<span class="gi">${ic('arrow-up', 'sm')}</span>` : `<span class="em" aria-hidden="true">${esc(r.emoji)}</span>`;
    const badge = r.kind === 'group' ? `<span class="badge">${r.disabled ? 'Wrong kind' : 'Grouping'}</span>` : (r.lock ? ic('lock', 'sm') : '');
    return `<button type="button" class="dest" role="option" id="dest-${i}" aria-selected="${P.sel === rowKey(r)}" aria-disabled="${!!r.disabled}" data-act="pick-dest" data-i="${i}" data-depth="${Math.min(r.depth, 6)}">${lead}<span class="mid"><b>${esc(r.label)}</b><small>${esc(r.sub)}${r.disabled && r.kind !== 'group' ? (r.lock ? ' · restricted' : ' · can’t move here') : ''}</small></span>${badge}</button>`;
  }).join('');
}
/* opts: title, current ({area, group}), type ('area' | 'place'), exclude (Set of area ids),
   itemKind ('mom' | 'file' | 'mixed' | null), cta, onPick({area, group}). */
function destPicker({ title, current, type = 'area', exclude = new Set(), itemKind = null, cta, onPick }) {
  const P = UI.picker = { type, exclude, itemKind, onPick, rows: [], sel: null, layer: null };
  const here = current && current.area ? `Currently in <b>${esc(placeName(current))}</b>` : (type === 'area' ? 'Currently at the <b>top level</b>' : 'Choose a destination');
  P.rows = destRows({ type, exclude, itemKind, q: '' });
  P.layer = layer({
    label: title,
    html: `<div class="dlg-head"><div class="tt2"><h2>${esc(title)}</h2><p>${here}</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="dest-search">${ic('search', 'sm')}<input class="input" id="destQ" type="search" placeholder="Search areas and groupings" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="destList" aria-label="Search destinations" data-input="dest-search" data-key="dest-search"></div>
      <div class="dests" id="destList" role="listbox" aria-label="Destinations">${destListHTML(P)}</div>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button type="button" class="btn btn-primary" id="destGo" data-act="dest-go" disabled>${esc(cta)}</button></div>`,
    onMount(panel) { const q = panel.querySelector('#destQ'); q.focus(); },
    onClose() { if (UI.picker === P) UI.picker = null; },
  });
}
function repaintPicker() {
  const P = UI.picker; if (!P) return;
  P.rows = destRows({ type: P.type, exclude: P.exclude, itemKind: P.itemKind, q: ($('#destQ') || {}).value || '' });
  if (P.sel && !P.rows.some(r => rowKey(r) === P.sel && !r.disabled)) P.sel = null;
  $('#destList').innerHTML = destListHTML(P);
  $('#destGo').disabled = !P.sel;
}
onInput('dest-search', () => repaintPicker());
onKey('dest-search', e => {
  const P = UI.picker; if (!P) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const ok = P.rows.map((r, i) => (r.disabled ? -1 : i)).filter(i => i > -1);
    if (!ok.length) return;
    const cur = ok.findIndex(i => rowKey(P.rows[i]) === P.sel);
    const next = ok[Math.min(ok.length - 1, Math.max(0, cur + (e.key === 'ArrowDown' ? 1 : -1)))];
    P.sel = rowKey(P.rows[next]);
    $('#destList').innerHTML = destListHTML(P); $('#destGo').disabled = false;
    const n = $('#dest-' + next); if (n) { n.scrollIntoView({ block: 'nearest' }); $('#destQ').setAttribute('aria-activedescendant', n.id); }
  }
  if (e.key === 'Enter' && P.sel) { e.preventDefault(); ACT['dest-go'](); }
});
on('pick-dest', d => {
  const P = UI.picker; if (!P) return;
  const r = P.rows[Number(d.i)]; if (!r || r.disabled) return;
  P.sel = rowKey(r);
  $('#destList').innerHTML = destListHTML(P);
  $('#destGo').disabled = false;
  $('#destQ').focus();   // the search stays the keyboard's home: Enter confirms, ↑ ↓ move on
});
on('dest-go', () => {
  const P = UI.picker; if (!P || !P.sel) return;
  const r = P.rows.find(x => rowKey(x) === P.sel); if (!r) return;
  const place = r.kind === 'top' ? { area: null } : r.kind === 'area' ? { area: r.id } : { area: r.area, group: r.id, gkind: (groupsOf(area(r.area)).find(g => g.id === r.id) || {}).kind };
  const fn = P.onPick;
  P.layer.close();
  fn(place);
});

/* Moving, with a toast that says where and offers Undo (S4). */
function doMove(keys, p, name) {
  const mv = moveItems(keys, p);
  if (!mv.ok) { toast('Couldn’t move that here.', { icon: 'alert', tone: 'warn' }); return; }
  mv.done.catch(() => toast('Couldn’t move. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
  const key = 'mv' + Date.now();
  offerUndo(key, mv.undo);
  if (p.area && keys.some(k => k[0] === 'a')) { UI.open.add(p.area); lsSet('G_exp', JSON.stringify([...UI.open])); }
  const where = p.area ? placeName(p) : 'the top level';
  toast(keys.length === 1 && name ? `Moved “${name}” to ${where}` : `Moved ${plural(keys.length, 'item')} to ${where}`, { icon: 'move', action: { label: 'Undo', act: 'undo', data: { key } } });
  UI.sel.clear(); UI.selMode = false;
  render();
}
function moveItem(kind, id) {
  const it = itemOf(kind, id); if (!it) return;
  const isMom = kind === 'm';
  destPicker({
    title: `Move “${itemName(kind, it)}”`, current: { area: it.folderId, group: (isMom ? it.momFolderId : it.docFolderId) || null, gkind: isMom ? 'mom' : 'file' },
    type: 'place', itemKind: isMom ? 'mom' : 'file', cta: 'Move here', onPick: p => doMove([kind + ':' + id], p, itemName(kind, it)),
  });
}
on('move-item', d => moveItem(d.kind, d.id));
on('move-area', d => {
  const a = area(d.id); if (!a) return;
  destPicker({ title: `Move ${a.name}`, current: { area: a.parent || null }, type: 'area', exclude: new Set(descIds(a.id)), cta: 'Move here', onPick: p => doMove(['a:' + a.id], p, a.name) });
});
on('bulk-move', () => {
  const keys = [...UI.sel]; if (!keys.length) return;
  const kinds = new Set(keys.map(k => k[0]));
  const onlyAreas = kinds.size === 1 && kinds.has('a');
  const itemKind = onlyAreas ? null : kinds.size === 1 ? (kinds.has('m') ? 'mom' : 'file') : 'mixed';
  const exclude = new Set(keys.filter(k => k[0] === 'a').flatMap(k => descIds(k.slice(2))));   // an area can't go into itself or anything inside it
  destPicker({ title: `Move ${plural(keys.length, 'item')}`, current: null, type: onlyAreas ? 'area' : 'place', itemKind, exclude, cta: 'Move here', onPick: p => doMove(keys, p) });
});
/* The place chip: where new items land (UI.place). */
on('pick-place', () => destPicker({
  title: 'Create in', current: createPlace(route()), type: 'place', cta: 'Use this place',
  onPick: p => { UI.place = p; toast(`Creating in ${placeName(p)}`, { icon: 'folder-plus' }); render(); },
}));

/* ---------- Delete (O8) ---------- */
on('bulk-delete', () => {
  const keys = [...UI.sel]; if (!keys.length) return;
  const names = keys.map(k => { const id = k.slice(2); return k[0] === 'a' ? `${(area(id) || {}).name} (area, with everything inside)` : k[0] === 'm' ? (mom(id) || {}).title || 'Untitled meeting' : (D.find(d => d.id === id) || {}).name || 'Untitled file'; });
  confirmDialog({ title: `Delete ${plural(keys.length, 'item')}?`, text: 'They move to Deleted and can be restored for 7 days.', impact: `<b>Deleting:</b> ${names.map(n => esc(n)).join(', ')}`, danger: true, cta: 'Delete', act: 'bulk-delete-now' });
});
on('bulk-delete-now', () => {
  const keys = [...UI.sel];
  const jobs = keys.map(k => { const id = k.slice(2); return k[0] === 'a' ? dFDeep(id) : k[0] === 'm' ? dM(id) : dD(id); });
  UI.sel.clear(); UI.selMode = false; closeAll();
  Promise.all(jobs).catch(() => toast('Couldn’t delete everything. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
  toast('Moved to Deleted', { icon: 'trash', action: { label: 'Open Deleted', act: 'go-deleted' } });
  render();
});
on('delete-area', d => {
  const a = area(d.id); if (!a) return;
  const c = contents(a.id);
  confirmDialog({
    title: `Delete “${a.name}”?`, text: 'The area goes to Deleted, with everything inside it. It stays recoverable for 7 days.',
    impact: `<b>This includes ${plural(c.areas, 'sub-area')}, ${plural(c.moms, 'MoM')}, ${plural(c.files, 'file')} and ${plural(c.groups, 'grouping')}.</b> Nothing is lost until the 7 days pass.`,
    danger: true, cta: 'Delete area', act: 'delete-area-now', data: { id: a.id },
  });
});
on('delete-area-now', d => {
  const a = area(d.id); if (!a) return;
  const up = a.parent && area(a.parent) && canSee(a.parent) ? areaHref(a.parent) : '#/areas';
  closeAll();
  dFDeep(a.id).catch(() => toast('Couldn’t delete it. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
  toast(`Deleted “${a.name}”`, { icon: 'trash', action: { label: 'Open Deleted', act: 'go-deleted' } });
  go(up);
});

/* ---------- Menus ---------- */
on('area-menu', (d, el) => {
  const a = area(d.id); if (!a) return;
  menu(el, [
    { label: 'Rename or change emoji', icon: 'pencil', act: 'rename', data: { kind: 'area', id: a.id } },
    { label: 'New sub-area', icon: 'shelf', act: 'new-area', data: { parent: a.id }, admin: { k: 'createArea', label: 'create sub-areas' } },
    { label: 'New grouping', icon: 'folder-plus', act: 'new-group', data: { area: a.id } },
    { label: 'Select several', icon: 'check-square', act: 'toggle-select' },
    '-',
    { label: 'Move to…', icon: 'move', act: 'move-area', data: { id: a.id }, admin: { k: 'moveArea', label: 'move areas' } },
    { label: a.pw ? 'Remove password' : 'Restrict with password', icon: a.pw ? 'unlock' : 'lock', act: a.pw ? 'unrestrict' : 'restrict', data: { kind: 'a', id: a.id } },
    { label: 'Share a link', icon: 'share', act: 'share', data: { kind: 'a', id: a.id }, admin: { k: 'shareLinks', label: 'share links' } },
    { label: 'Access', icon: 'users', act: 'access', data: { id: a.id }, admin: { k: 'access', label: 'change access' } },
    '-',
    { label: 'Delete area', icon: 'trash', act: 'delete-area', data: { id: a.id }, danger: true, admin: { k: 'deleteItem', label: 'delete areas' } },
  ], 'Area');
});
on('group-menu', (d, el) => menu(el, groupMenuItems(d.id), 'Grouping'));
on('item-menu', (d, el) => {
  const isMom = d.kind === 'm', id = d.id;
  const it = itemOf(d.kind, id); if (!it) return;
  const ro = readOnly(it);
  const guard = o => (ro ? { ...o, act: 'blocked-final', note: 'Final' } : o);
  const items = [];
  items.push(isMom ? { label: 'Open MoM', icon: 'doc', act: 'open-mom', data: { id } } : { label: 'Open', icon: 'external', act: 'open-file', data: { id } });
  items.push({ label: it.starred ? 'Unflag' : 'Flag as important', icon: it.starred ? 'flag' : 'flag-fill', act: 'flag', data: { kind: d.kind, id } });
  items.push(guard({ label: 'Rename', icon: 'pencil', act: 'rename', data: { kind: isMom ? 'mom' : 'file', id } }));
  items.push(guard({ label: 'Move to…', icon: 'move', act: 'move-item', data: { kind: d.kind, id } }));
  if (!isMom) items.push(guard({ label: it.pw ? 'Remove password' : 'Restrict with password', icon: it.pw ? 'unlock' : 'lock', act: 'restrict', data: { kind: 'f', id } }));
  if (!isMom) items.push('-', { label: 'Download', icon: 'download', act: 'download', data: { id } }, { label: 'Copy address', icon: 'copy', act: 'copy-address', data: { id } });
  items.push('-', { label: it.readOnly ? 'Unmark final' : 'Mark as final', icon: 'lock', act: 'final', data: { kind: d.kind, id }, admin: { k: 'final', label: 'mark MoMs and files as final' } });
  items.push({ label: 'Share a link', icon: 'share', act: 'share', data: { kind: d.kind, id }, admin: { k: 'shareLinks', label: 'share links' } });
  items.push('-', { label: 'Delete', icon: 'trash', act: 'delete-item', data: { kind: d.kind, id }, danger: true, admin: { k: 'deleteItem', label: 'delete items' } });
  menu(el, items, isMom ? 'MoM' : 'File');
});
on('open-mom', d => go('#/mom/' + encodeURIComponent(d.id)));

/* ---------- Files: open, download, copy the address (F9, F10, F14) ---------- */
function fileGate(f) {
  layer({
    label: `${f.name || 'File'} is restricted`,
    html: `<form data-form="unlock" data-kind="f" data-id="${esc(f.id)}" novalidate>${dialogHTML({
      title: f.name || 'Untitled file', text: 'This file is restricted. Enter the password to open it, download it or see its note.',
      body: fieldHTML({ id: 'gateF', label: 'Password', control: inputHTML({ id: 'gateF', name: 'password', type: 'password' }) }),
      foot: btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + btnHTML({ kind: 'primary', label: 'Unlock', type: 'submit' }),
    })}</form>`,
  });
}
on('open-file', d => {
  const f = D.find(x => x.id === d.id); if (!f || hiddenItem('f', f) && !lockedFile(f)) return;
  if (lockedFile(f)) { fileGate(f); return; }
  touchRecent('f', f.id);
  if (docKind(f) === 'image' && f.url) { layer({ cls: 'layer-lightbox', label: f.name || 'Image', html: lightboxHTML({ id: f.id, name: f.name || 'Image', src: f.url }) }); return; }
  if (!f.url) return;
  window.open(f.url, '_blank', 'noopener');
  toast(`“${f.name || 'File'}” opened in a new tab`, { icon: 'external' });
});
on('download', d => {
  const f = D.find(x => x.id === d.id); if (!f || lockedFile(f) || !f.url) return;
  downloadFile(f);
});
/* Save a file to the device (guest pages use it too, after their own checks). */
async function downloadFile(f) {
  const name = f.name || 'file';
  if (docKind(f) === 'link' || f.type === 'link') { window.open(f.url, '_blank', 'noopener'); toast(`Links can’t be downloaded, so “${name}” opened in a new tab`, { icon: 'external' }); return; }
  toast(`Downloading “${name}”`, { icon: 'download' });
  try {
    const blob = await (await fetch(f.url)).blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) { window.open(f.url, '_blank', 'noopener'); toast(`“${name}” opened in a new tab`, { icon: 'external' }); }   // the file's host may refuse a direct fetch
}
on('copy-address', d => {
  const f = D.find(x => x.id === d.id); if (!f || lockedFile(f) || !f.url) return;
  const done = () => toast('Address copied', { icon: 'copy' });
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(f.url).then(done, () => toast('Couldn’t copy. Select the address and copy it by hand.', { icon: 'alert', tone: 'warn' }));
  else toast('Couldn’t copy. Select the address and copy it by hand.', { icon: 'alert', tone: 'warn' });
});

/* ---------- Dialogs: New area, Rename, groupings (O1, O2, O4) ---------- */
/* Areas as a list for a "Location" choice: the same tree the Move picker shows, locked ones off. */
function areaLocationOptions(selected) {
  return destRows({ type: 'area', exclude: new Set(), itemKind: null, q: '' })
    .filter(r => r.kind === 'area')
    .map(r => [r.id, `${'  '.repeat(r.depth)}${r.emoji ? r.emoji + ' ' : ''}${r.label}`, r.disabled])
    .map(([v, l, off]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}${off ? ' disabled' : ''}>${esc(l)}</option>`).join('');
}
function newAreaDialog(parent = null) {
  const sel = emojiGridHTML({ name: 'emoji', label: 'Emoji', selected: '🌿' });
  layer({
    label: parent ? 'New sub-area' : 'New area',
    html: `<form data-form="new-area" novalidate>${dialogHTML({
      title: parent ? 'New sub-area' : 'New area', text: 'An area holds the MoMs and files for one client, team or initiative.',
      body: fieldHTML({ id: 'anName', label: 'Name', required: true, control: inputHTML({ id: 'anName', name: 'name', placeholder: 'e.g. Harbor Logistics' }) })
        + sel.replace('<div class="field">', '<div class="field" id="emoji-field">')
        + `<label class="field" for="anParent"><span class="lab">Location</span><select class="select" id="anParent" name="parent"><option value="">Top level</option>${areaLocationOptions(parent || '')}</select></label>`
        + `<input type="hidden" name="emoji" value="🌿">`,
      foot: btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + btnHTML({ kind: 'primary', label: 'Create area', type: 'submit' }),
    })}</form>`,
  });
}
on('new-area', d => {
  if (!isAdmin()) { toast('Only admins can create areas.', { icon: 'alert', tone: 'warn' }); return; }
  newAreaDialog(d.parent || null);
});
/* The emoji grid: the choice goes into the form's hidden emoji field. */
on('pick-emoji', (d, el) => {
  const f = el.closest('form'); if (!f) return;
  f.querySelectorAll('[role=radio]').forEach(b => b.setAttribute('aria-checked', String(b === el)));
  f.elements.emoji.value = d.e;
});
onForm('new-area', f => {
  if (!isAdmin()) return;
  const name = f.elements.name.value.trim();
  if (!name) { fieldError(f, 'anName', 'Give the area a name, so you can find it later.'); return; }
  const parent = f.elements.parent.value || null;
  const { id } = { id: newId() };
  const doc = { id, name, icon: f.elements.emoji.value || '', created: Date.now(), createdBy: { uid: (signedInUser() || {}).uid || '', name: currentUser().name } };
  if (parent) doc.parent = parent;
  sF(doc).then(() => {}, () => toast('Couldn’t create the area. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
  closeAll();
  if (parent) { UI.open.add(parent); lsSet('G_exp', JSON.stringify([...UI.open])); }
  toast(`Created “${name}”${parent && area(parent) ? ' inside ' + area(parent).name : ''}`, { icon: 'shelf' });
  go(areaHref(id));
});

/* Rename: an area's name and emoji, a MoM's title, or a file's name (O2, O6). */
function renameDialog(kind, id) {
  const item = kind === 'area' ? gf(id) : kind === 'mom' ? mom(id) : D.find(d => d.id === id);
  if (!item) return;
  const label = kind === 'area' ? 'area' : kind === 'mom' ? 'MoM' : 'file';
  const val = kind === 'mom' ? (item.title || '') : (item.name || '');
  const blocked = kind !== 'area' && readOnly(item);
  const emoji = kind === 'area' ? emojiGridHTML({ name: 'emoji', label: 'Emoji', selected: areaEmoji(item) }).replace('<div class="field">', '<div class="field" id="emoji-field">') : '';
  layer({
    label: `Rename ${label}`,
    html: `<form data-form="rename" data-kind="${kind}" data-id="${esc(id)}" novalidate>${dialogHTML({
      title: `Rename ${label}`, text: kind === 'area' ? 'Change the name, and the emoji that marks it.' : 'Titles help you find things in search.',
      body: fieldHTML({ id: 'renIn', label: 'Name', required: true, control: inputHTML({ id: 'renIn', name: 'name', value: val }) })
        + emoji + (kind === 'area' ? `<input type="hidden" name="emoji" value="${esc(areaEmoji(item))}">` : '')
        + (blocked ? noticeHTML({ tone: 'warn', icon: 'lock', title: 'Marked final.', text: 'Only an admin can change it.' }) : ''),
      foot: btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + btnHTML({ kind: 'primary', label: 'Save', type: 'submit', disabled: blocked }),
    })}</form>`,
  });
}
on('rename', d => {
  if (d.kind !== 'area' && !(d.kind === 'mom' ? mom(d.id) : D.find(x => x.id === d.id))) return;
  renameDialog(d.kind, d.id);
});
onForm('rename', f => {
  const { kind, id } = f.dataset;
  const name = f.elements.name.value.trim();
  if (!name) { fieldError(f, 'renIn', 'Give it a name.'); return; }
  const done = kind === 'area' ? renameArea(id, name, f.elements.emoji.value || '')
    : kind === 'mom' ? updateMom(id, { title: name })
    : renameFile(id, name);
  closeAll();
  afterWrite(done, ['Renamed', { icon: 'pencil' }], 'Couldn’t rename it. Check your connection, then try again.');
});

/* ---------- Groupings (O4) ---------- */
function newGroupDialog(areaId) {
  if (!areaId || !area(areaId)) { toast('Choose an area first', { icon: 'alert', tone: 'warn' }); return; }
  layer({
    label: 'New grouping',
    html: `<form data-form="new-group" data-area="${esc(areaId)}" novalidate>${dialogHTML({
      title: 'New grouping', text: `A grouping bunches MoMs, files and links inside ${area(areaId).name}. Removing one keeps its contents here.`,
      body: fieldHTML({ id: 'grpIn', label: 'Name', required: true, control: inputHTML({ id: 'grpIn', name: 'name', placeholder: 'e.g. Steering committee' }) }),
      foot: btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + btnHTML({ kind: 'primary', label: 'Create grouping', type: 'submit' }),
    })}</form>`,
  });
}
on('new-group', d => newGroupDialog(d.area || (createPlace(route()) || {}).area));
onForm('new-group', f => {
  const name = f.elements.name.value.trim();
  if (!name) { fieldError(f, 'grpIn', 'Give the grouping a name.'); return; }
  // New groupings hold MoMs and files both. They live with the MoM groupings, marked holds: 'both'.
  const write = sMF({ id: newId(), folderId: f.dataset.area, name, holds: 'both' });
  closeAll();
  afterWrite(write, [`Added grouping “${name}”`, { icon: 'folder-plus' }], 'Couldn’t create the grouping. Check your connection, then try again.');
});
const groupOf = id => { const m = MF.find(g => g.id === id); return m ? { kind: m.holds === 'both' ? 'both' : 'mom', g: m } : (() => { const f = DF.find(g => g.id === id); return f ? { kind: 'file', g: f } : null; })(); };
on('rename-group', d => {
  const hit = groupOf(d.id); if (!hit) return;
  layer({
    label: 'Rename grouping',
    html: `<form data-form="rename-group" data-id="${esc(d.id)}" data-kind="${hit.kind}" novalidate>${dialogHTML({
      title: 'Rename grouping', body: fieldHTML({ id: 'rgIn', label: 'Name', required: true, control: inputHTML({ id: 'rgIn', name: 'name', value: hit.g.name || '' }) }),
      foot: btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + btnHTML({ kind: 'primary', label: 'Save', type: 'submit' }),
    })}</form>`,
  });
});
onForm('rename-group', f => {
  const name = f.elements.name.value.trim();
  if (!name) { fieldError(f, 'rgIn', 'Give the grouping a name.'); return; }
  const { id, kind } = f.dataset;
  closeAll();
  afterWrite(renameGroup(kind, id, name), ['Renamed', { icon: 'pencil' }], 'Couldn’t rename it. Check your connection, then try again.');
});
on('remove-group', d => {
  const hit = groupOf(d.id); if (!hit) return;
  const moms = hit.kind !== 'file' ? M.filter(m => m.momFolderId === d.id).length : 0;
  const files = hit.kind !== 'mom' ? D.filter(x => x.docFolderId === d.id).length : 0;
  const what = hit.kind === 'both' ? `${plural(moms, 'MoM')} and ${plural(files, 'file')}` : hit.kind === 'mom' ? plural(moms, 'MoM') : plural(files, 'file');
  const a = area(hit.g.folderId);
  confirmDialog({
    title: `Remove “${hit.g.name}”?`, text: 'Removing a grouping keeps everything in it, in the area.',
    impact: `${what} stay in ${esc(a ? a.name : 'the area')}.`,
    cta: 'Remove grouping', act: 'remove-group-now', data: { id: d.id, kind: hit.kind },
  });
});
on('remove-group-now', d => {
  closeAll();
  const job = removeGroup(d.kind, d.id);
  job.done.then(() => {}, () => toast('Couldn’t remove the grouping. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
  const key = 'g' + d.id;
  offerUndo(key, job.undo);
  toast('Grouping removed. Its contents stayed in the area.', { icon: 'folder-plus', action: { label: 'Undo', act: 'undo', data: { key } } });
});
