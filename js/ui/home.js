/* Today (F3, F4, F13), All areas (F6, O7) and the rows lists share (Flagged, Recent). Reads
   through the data layer; what each person sees comes from the visibility rules in store.js. */
'use strict';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const todayLine = () => { const d = new Date(); return `${DAYS[d.getDay()]}, ${d.getDate()} ${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

/* A row for a MoM ('m') or file ('f'): shows where it lives. opts.right is extra markup at the end. */
function itemRow(kind, id, opts = {}) {
  if (kind === 'm') {
    const m = mom(id); if (!m) return '';
    const a = area(m.folderId), g = m.momFolderId ? groupName(m.momFolderId) : '';
    return itemRowHTML({ href: '#/mom/' + encodeURIComponent(m.id), icon: 'doc', title: m.title || 'Untitled meeting', flagged: !!m.starred, final: !!m.readOnly, where: [a && a.name, g].filter(Boolean).join(' · '), meta: relDate(isoOf(m.date)), right: opts.right || '' });
  }
  const d = D.find(x => x.id === id); if (!d) return '';
  const k = KINDS[docKind(d)], a = area(d.folderId), g = d.docFolderId ? groupName(d.docFolderId) : '', at = docAddedValue(d), locked = lockedFile(d);
  return itemRowHTML({ href: a ? areaHref(a.id) : '#/areas', act: 'open-file', data: { id: d.id }, tile: k.tile, icon: k.icon, title: d.name || 'Untitled file', flagged: !!d.starred, final: !!d.readOnly, restricted: !!d.pw, where: [k.label, a && a.name, g].filter(Boolean).join(' · '), meta: locked ? 'Locked' : (at ? relDate(isoOf(at)) : ''), right: opts.right || '' });
}
function continueCard([k, id]) {
  if (k === 'm') {
    const m = mom(id), a = area(m.folderId);
    return continueCardHTML({ href: '#/mom/' + encodeURIComponent(m.id), icon: 'doc', title: m.title || 'Untitled meeting', where: `${a ? a.name : ''} · ${relDate(isoOf(m.date))}` });
  }
  const d = D.find(x => x.id === id), a = area(d.folderId), kd = KINDS[docKind(d)];
  return continueCardHTML({ href: a ? areaHref(a.id) : '#/areas', act: 'open-file', data: { id: d.id }, tile: kd.tile, icon: kd.icon, title: d.name || 'Untitled file', where: a ? a.name : '' });
}
/* Admin only: the newest MoMs and files across the workspace. Older items have no author on
   record (open gap G6), so for them only the time shows. */
function recentlyAdded() {
  const mk = (kind, x, at) => ({ kind, id: x.id, at, by: x.createdBy && x.createdBy.name });
  return M.filter(m => !hiddenItem('m', m)).map(m => mk('m', m, Number(m.created) || Number(m.date) || 0))
    .concat(D.filter(d => !hiddenItem('f', d)).map(d => mk('f', d, docAddedValue(d))))
    .filter(x => x.at).sort((a, b) => b.at - a.at).slice(0, 5);
}
const whoHTML = name => `<span class="who">${esc(firstWord(name).charAt(0).toUpperCase() + (String(name).split(/\s+/)[1] || '').charAt(0).toUpperCase())}</span>`;
const addedRight = x => `<span class="row-right">${x.by ? whoHTML(x.by) + esc(x.by) + ' · ' : ''}${esc(relDate(isoOf(x.at)))}</span>`;

/* ---------- Today ---------- */
VIEWS.today = {
  html() {
    const admin = isAdmin();
    if (!admin && !visibleRoots().length) return `<div class="page">${noAccessPartHTML()}</div>`;
    const nothing = !visibleAreas().length;
    const p = createPlace({ name: 'today' });
    const flagged = flaggedItems();
    const recent = recentEntries().map(x => [x.k, x.id]);
    const added = admin ? recentlyAdded() : [];
    const quick = nothing ? quickFirstHTML({}) : `<div class="place-line"><span>Creating in</span>${p ? placeChipHTML(placeName(p)) : ''}</div>
      <div class="quick">
        ${quickTileHTML({ primary: true, icon: 'doc', title: 'New MoM', sub: 'Today’s date, cursor ready', act: 'new-mom', data: { area: p && p.area, group: groupFor(p, 'mom') }, disabled: !p })}
        ${quickTileHTML({ icon: 'upload', title: 'Upload', sub: 'Files and PDFs', act: 'upload', data: { area: p && p.area, group: groupFor(p, 'file') }, disabled: !p })}
        ${quickTileHTML({ icon: 'link', title: 'Save a link', sub: 'Online material', act: 'save-link', data: { area: p && p.area, group: groupFor(p, 'file') }, disabled: !p })}
        ${admin ? quickTileHTML({ icon: 'shelf', title: 'New area', sub: 'Client, team or initiative', act: 'new-area', data: { parent: '' } }) : quickTileHTML({ icon: 'flag', title: 'Flagged', sub: `${flagged.length} important`, href: '#/flagged' })}
      </div>`;
    return `<div class="page">
      <section class="hero" aria-labelledby="hello">
        <p class="eyebrow">${esc(todayLine())}</p>
        <h1 class="h1" id="hello">${greeting()}${firstName() ? ', ' + esc(firstName()) : ''}</h1>
        <p class="hero-sub">${nothing ? 'Nothing here yet. Start with an area, then add your first meeting.' : 'Pick up where you left off, or start the next meeting in one tap.'}</p>
        ${quick}
      </section>
      ${nothing ? '' : `
      ${sectionHTML('cont', 'Continue where you left off', 0, '<a class="link-btn" href="#/recent">See all</a>', recent.length ? `<div class="cont-row">${recent.slice(0, 4).map(continueCard).join('')}</div>` : emptyHTML({ small: true, icon: 'clock', title: 'Nothing yet', text: 'Open a MoM or file and it appears here.' }))}
      ${sectionHTML('flg', 'Flagged', flagged.length, '<a class="link-btn" href="#/flagged">Open flagged</a>', flagged.length ? `<div class="list">${flagged.slice(0, 4).map(([k, id]) => itemRow(k, id)).join('')}</div>` : emptyHTML({ small: true, icon: 'flag', title: 'Nothing flagged', text: 'Flag a MoM or file to keep it close.' }))}
      ${admin ? sectionHTML('adds', 'Recently added across the workspace', 0, '', added.length ? `<div class="list">${added.map(x => itemRow(x.kind, x.id, { right: addedRight(x) })).join('')}</div>` : emptyHTML({ small: true, icon: 'sparkle', title: 'Nothing yet', text: 'New MoMs and files from across the team show here.' })) : ''}`}
    </div>`;
  },
};

/* ---------- All areas: a grid on desktop, the full tree on phone ---------- */
VIEWS.areas = {
  html() {
    const roots = visibleRoots(), total = visibleAreas().length, admin = isAdmin();
    const selectable = UI.selMode && admin;
    const cards = roots.map(a => {
      const locked = !!lockedArea(a.id), c = locked ? null : countsOf(a.id);
      const subs = locked ? [] : kids(a.id).filter(k => canSee(k.id)).map(k => ({ name: k.name, emoji: areaEmoji(k) }));
      return areaCardHTML({ id: a.id, name: a.name, emoji: areaEmoji(a), tint: tintOf(a), moms: c ? c.moms : 0, files: c ? c.files : 0, locked, kids: subs, selectable, selected: UI.sel.has('a:' + a.id) });
    }).join('');
    const empty = admin
      ? emptyHTML({ icon: 'shelf', title: 'No areas yet', text: 'Create an area for a client, a team or an initiative. Everything you write and upload goes inside one.', actions: btnHTML({ kind: 'primary', label: 'New area', icon: 'plus', act: 'new-area' }) })
      : noAccessPartHTML();
    return `<div class="page">
      <div class="page-head"><div class="page-head-main"><p class="eyebrow">Workspace</p><h1 class="h-page">Areas</h1><p class="page-sub">${total ? `${plural(roots.length, 'top-level area')}, each with its own MoMs and files.` : 'Areas hold the MoMs and files for one client, team or initiative.'}</p></div>${admin && total ? `<button type="button" class="btn btn-soft btn-sm" data-act="toggle-select" aria-pressed="${UI.selMode}">${ic('check-square', 'sm')}${UI.selMode ? 'Done selecting' : 'Select'}</button>` : ''}</div>
      ${UI.selMode ? '' : `<div class="phone-only">${total ? treeHTML({ name: 'areas' }, { cls: 'tree-page', roots }) : ''}</div>`}
      <div class="${UI.selMode ? '' : 'desk-only'}">${total ? `<div class="agrid">${cards}${admin ? `<button type="button" class="acard new-card" data-act="new-area" aria-label="New area">${ic('plus')}<span>New area</span></button>` : ''}</div>` : empty}</div>
      <div id="bulkHost">${bulkHTML({ name: 'areas' })}</div>
      <div class="phone-only">${total ? '' : empty}${admin && total ? `<div class="phone-new">${btnHTML({ kind: 'soft', label: 'New area', icon: 'plus', act: 'new-area' })}</div>` : ''}</div>
    </div>`;
  },
};
