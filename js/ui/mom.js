/* The MoM editor (C1–C5, W1–W8, P7): Tiptap with the design's toolbar, Aa and alignment menus,
   selection bubble, "/" menu, tables with Long text columns and the Detailed Remarks drawer, the
   prospect journal, images, links, tags, date and attached document; autosave with status.
   Data goes through js/data (updateMom, createMom, toEditorHTML, journalize). */
'use strict';

const ED = {
  id: null, editor: null, token: 0, timer: null, ro: false, bodyDirty: false, pending: {},
  known: null,          // the stored fields this editor last loaded or saved (remote-change check)
  remote: null,         // a colleague's saved version waiting behind the remote bar
  unwatch: null, slash: null, cell: null, rmTimer: null, uploads: new Map(), created: new Set(),
};
const FONT_STACK = { serif: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' };
const SAVE_DELAY = 800;

/* ---------- Status pill (C2) ---------- */
function setStatus(kind) {
  UI.edStatus = kind;
  $$('.js-status').forEach(el => { const t = document.createElement('div'); t.innerHTML = statusPillHTML(kind); el.replaceWith(t.firstElementChild); });
}

/* ---------- Creating a MoM (C1) ---------- */
function newMomIn(areaId, groupId, title) {
  const a = area(areaId);
  if (!a || !canSee(areaId)) { toast('Create an area first, then add a MoM to it.', { icon: 'alert', tone: 'warn' }); return; }
  if (lockedArea(areaId)) { toast(`Open ${lockedArea(areaId).name} first, then add a MoM to it.`, { icon: 'lock', tone: 'warn' }); return; }
  const today = isoOf(Date.now());
  const fields = { folderId: areaId, title: title || `Meeting – ${fmtDate(today)}`, date: msOf(today) };
  if (groupId) fields.momFolderId = groupId;
  const { id, done } = createMom(fields);
  done.catch(() => toast('Couldn’t create the MoM. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
  ED.created.add(id);
  UI.place = { area: areaId, group: groupId || null };
  go('#/mom/' + encodeURIComponent(id));
}
on('new-mom', d => {
  const cp = d.area ? null : createPlace(route());
  const p = d.area ? { area: d.area, group: d.group || null } : cp && { area: cp.area, group: groupFor(cp, 'mom') || null };
  closeAll();
  if (!p || !p.area) { toast('Create an area first, then add a MoM to it.', { icon: 'alert', tone: 'warn' }); return; }
  newMomIn(p.area, p.group);
});

/* ---------- The editor page ---------- */
function edHeadHTML(m, ro, a) {
  return `<div class="ed-head" aria-label="MoM">
    <button type="button" class="ed-back" data-act="done" aria-label="Done, back to ${esc(a ? a.name : 'the area')}">${ic('arrow-left', 'sm')}<span class="done-l">Done</span><span class="area-l">${esc(a ? a.name : '')}</span></button>
    ${ro ? edReadOnlyHTML() : statusPillHTML(UI.edStatus || 'saved')}
    <span class="spacer"></span>
    ${iconBtnHTML({ icon: m.starred ? 'flag-fill' : 'flag', label: m.starred ? 'Unflag' : 'Flag as important', pressed: !!m.starred, sm: true, act: 'flag', data: { kind: 'm', id: m.id } })}
    <button type="button" class="icon-btn" data-act="editor-menu" data-id="${esc(m.id)}" aria-haspopup="menu" aria-label="More for this MoM">${ic('more', 'sm')}</button>
  </div>`;
}
function edPathHTML(m) {
  const path = crumbPath(m.folderId);
  const g = m.momFolderId ? groupName(m.momFolderId) : '';
  return `<nav class="ed-path" aria-label="Where this MoM lives">${path.map((x, i) => `${i ? ic('chev-r', 'sm') : ''}<a href="${areaHref(x.id)}">${emojiLead(x)}${esc(x.name)}</a>`).join('')}${g ? `${ic('chev-r', 'sm')}<span>${esc(g)}</span>` : ''}</nav>`;
}
/* The document chip: the stored gdoc address. */
function docChipHTML(url, ro) {
  if (!url) return ro ? '' : `<button type="button" class="mchip" data-act="doc-attach">${ic('link', 'sm')}Attach a document</button>`;
  const href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  let label = 'Document';
  try { const h = new URL(href).hostname; label = /docs\.google\./.test(h) ? 'Google Doc' : h.replace(/^www\./, ''); } catch (e) { /* keep "Document" */ }
  return `<a class="mchip doc" href="${esc(href)}" target="_blank" rel="noopener">${ic('doc', 'sm')}${esc(label)}${ic('external', 'sm')}</a>`;
}
function metaHTML(v, ro) {
  return `${dateChipHTML({ id: 'edDate', value: v.date, disabled: ro, change: 'ed-date' })}
    ${v.tags.map(t => `<span class="mchip tagc">#${esc(t)}${ro ? '' : `<button type="button" data-act="tag-remove" data-t="${esc(t)}" aria-label="Remove tag ${esc(t)}">${ic('x', 'sm')}</button>`}</span>`).join('')}
    ${ro ? '' : `<form class="inline-form" data-form="ed-tag" novalidate><input class="tag-add" name="tag" placeholder="Add tag" aria-label="Add a tag" autocomplete="off"></form>`}
    ${docChipHTML(v.gdoc, ro)}
    ${v.starred ? `<span class="mchip flagc">${ic('flag-fill', 'sm')}Flagged</span>` : ''}`;
}
/* The fields as the editor shows them now: stored values with unsaved changes on top. */
function current(m) {
  const p = ED.pending;
  return {
    title: 'title' in p ? p.title : (m.title || ''),
    date: isoOf('date' in p ? p.date : m.date),
    tags: 'tags' in p ? p.tags : (Array.isArray(m.tags) ? m.tags : []),
    gdoc: 'gdoc' in p ? p.gdoc : (m.gdoc || ''),
    starred: !!m.starred,
  };
}
function paintMeta() {
  const m = mom(ED.id), host = $('#edMeta');
  if (m && host) host.innerHTML = metaHTML(current(m), ED.ro);
}

VIEWS.mom = {
  html(r) {
    const m = mom(r.id);
    if (!m) return ED.created.has(r.id) ? null : missingMomHTML();   // a new MoM is on its way
    if (!canSee(m.folderId)) return `<div class="page">${noAccessPartHTML()}</div>`;
    const lock = lockedArea(m.folderId);
    if (lock) return lockedGateHTML({ id: lock.id, name: lock.name, targetName: m.title || 'Untitled meeting' });
    const ro = readOnly(m), a = area(m.folderId);
    if (ED.id !== m.id) { ED.pending = {}; UI.edStatus = 'saved'; }
    const v = current(m);
    return `${edHeadHTML(m, ro, a)}
      ${ro ? '' : editorToolbarHTML({})}
      <div class="canvas" id="edCanvas">
        <div id="ttHost"></div><div id="bubbleHost" data-keepfocus></div><div id="slashHost" data-keepfocus></div>
        ${edPathHTML(m)}
        <h1 class="ed-title" id="edTitle" contenteditable="${ro ? 'false' : 'plaintext-only'}" spellcheck="true" aria-label="Title" data-input="ed-title" data-key="ed-title">${esc(v.title)}</h1>
        <div class="ed-meta" id="edMeta">${metaHTML(v, ro)}</div>
        ${ro ? noticeHTML({ tone: 'info', icon: 'lock', title: 'Marked final.', text: 'An admin has agreed this record, so you can read, flag and export it, but not change it.', role: 'note' }) : ''}
        <div id="remoteHost"></div>
        <div id="journalHost"></div>
        <div id="edMount" class="ed-mount" aria-busy="true"><div class="skel skel-line"></div><div class="skel skel-line"></div></div>
      </div>`;
  },
  mount(r) {
    const m = mom(r.id);
    if (!m || !$('#edMount')) return;
    openEditor(m);
  },
  unmount() { closeEditor(); },
};
const missingMomHTML = () => `<div class="page">${emptyHTML({ icon: 'doc', title: 'This MoM isn’t here', text: 'It may have moved to Deleted, or the link may be out of date.', actions: btnHTML({ kind: 'primary', label: 'Go to Today', href: '#/today' }) + btnHTML({ kind: 'soft', label: 'Open Deleted', href: '#/deleted' }) })}</div>`;

function whenTiptap() {
  return window._TT ? Promise.resolve(window._TT) : new Promise(res => document.addEventListener('tt-ready', () => res(window._TT), { once: true }));
}

/* The editor's schema and behaviour. One list, so tests and any other editor use the same. */
function editorExtensions(TT) {
  return [
    TT.StarterKit, TT.Table, TT.TableRow, TT.TableHeader, TT.TableCell, TT.Underline,
    TT.Link.extend({
      renderHTML({ HTMLAttributes }) {
        const href = HTMLAttributes.href || '', cls = linkClass(href);
        return ['a', TT.mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, cls ? { class: cls } : {}), 0];
      },
    }).configure({ openOnClick: false }),
    TT.TextStyle, TT.Color, TT.Highlight.configure({ multicolor: true }), TT.FontFamily,
    TT.TextAlign.configure({ types: ['heading', 'paragraph'] }), TT.FontSize, TT.ResizableImage,
    TT.Placeholder.configure({ placeholder: 'Type / to add a table, an image or a link' }),
    TT.LongText, TT.UploadSlots,
    TT.SlashCommand.configure({ suggestion: { items: ({ query }) => slashItemsFor(query), render: slashRenderer, command: ({ editor: e, range, props }) => { e.chain().focus().deleteRange(range).run(); runSlash(props.i); } } }),
  ];
}
async function openEditor(m) {
  const token = ++ED.token;
  ED.id = m.id; ED.ro = readOnly(m); ED.bodyDirty = false; ED.remote = null;
  ED.known = { content: m.content || '', title: m.title || '', date: m.date, tags: JSON.stringify(m.tags || []), gdoc: m.gdoc || '' };
  let TT, loaded;
  try {
    [TT, loaded] = await Promise.all([whenTiptap(), toEditorHTML(m.content)]);
  } catch (e) {
    if (token !== ED.token) return;
    // An old note that can't be converted right now is never opened empty (it could be saved over).
    const host = $('#edMount');
    if (host) { host.removeAttribute('aria-busy'); host.innerHTML = emptyHTML({ small: true, icon: 'alert', title: 'This note couldn’t be opened', text: 'It was written in an older format that needs a connection to open. Check your connection, then try again.', actions: btnHTML({ kind: 'soft', label: 'Try again', act: 'ed-reopen' }) }); }
    ED.ro = true; $$('.toolbar').forEach(t => { t.hidden = true; });
    return;
  }
  if (token !== ED.token || !$('#edMount')) return;
  let html = loaded.html;
  let journal = null;
  if (isProspectJournal(m)) { journal = journalize(html); html = journal.html; }
  const host = $('#edMount');
  host.innerHTML = ''; host.removeAttribute('aria-busy');
  const editor = new TT.Editor({
    element: host,
    editable: !ED.ro,
    content: html,
    extensions: editorExtensions(TT),
    editorProps: {
      attributes: { class: 'ed-body', spellcheck: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Meeting notes' },
      handlePaste: (view, event) => imagesFrom(event.clipboardData) && (event.preventDefault(), true),
      handleDrop: (view, event) => imagesFrom(event.dataTransfer, view.posAtCoords({ left: event.clientX, top: event.clientY })) && (event.preventDefault(), true),
      handleClick: (view, pos, event) => onBodyClick(event),
    },
    onUpdate: ({ transaction }) => {
      if (transaction.getMeta('remote') || transaction.getMeta('preventUpdate')) return;
      ED.bodyDirty = true; schedule();
    },
    onSelectionUpdate: () => refreshChrome(),
    onTransaction: () => refreshChrome(),
    onBlur: () => setTimeout(refreshChrome, 0),
  });
  ED.editor = editor;
  refreshChrome(); paintJournal();
  ED.unwatch = watchMom(m.id, onRemoteSnap);
  touchRecent('m', m.id);
  // The prospect journal is converted once and saved, with the original kept (plan 2.8).
  ED.backup = null;
  if (journal && journal.changed && !ED.ro) {
    const converted = editor.getHTML();
    ED.backup = m.content; ED.known.content = converted;
    convertMomContent(m.id, m.content, converted).then(done => { if (done && ED.id === m.id) ED.backup = null; }, () => { /* offline: the next save keeps the backup */ });
  }
  if (ED.created.has(m.id)) { ED.created.delete(m.id); editor.commands.focus('end'); }
}

function closeEditor() {
  saveNow(false);
  ED.token++;
  if (ED.unwatch) { ED.unwatch(); ED.unwatch = null; }
  clearTimeout(ED.timer); clearTimeout(ED.rmTimer);
  closeSlash();
  if (ED.editor) { try { ED.editor.destroy(); } catch (e) { /* already gone */ } ED.editor = null; }
  ED.id = null; ED.cell = null; ED.remote = null; ED.pending = {}; ED.bodyDirty = false;
}
on('ed-reopen', () => render());

/* ---------- Autosave (C2, C3) ---------- */
function schedule() {
  if (ED.ro) return;
  setStatus(syncState() === 'offline' ? 'local' : 'saving');
  clearTimeout(ED.timer);
  ED.timer = setTimeout(() => saveNow(false), SAVE_DELAY);
}
function saveNow(withToast) {
  clearTimeout(ED.timer);
  const id = ED.id;
  if (!id || ED.ro || !ED.editor) return Promise.resolve();
  const fields = { ...ED.pending };
  if (ED.bodyDirty) fields.content = ED.editor.getHTML();
  const stored = mom(id);
  if (fields.content != null && ED.backup != null && stored && stored.contentBackup == null) { fields.contentBackup = ED.backup; ED.backup = null; }
  if ('date' in fields) fields.date = msOf(isoOf(fields.date));
  if (!Object.keys(fields).length) { if (withToast) toast('Saved', { icon: 'check', ms: 2000 }); return Promise.resolve(); }
  ED.pending = {}; ED.bodyDirty = false;
  Object.keys(fields).forEach(k => { ED.known[k] = k === 'tags' ? JSON.stringify(fields[k]) : fields[k]; });
  setStatus(syncState() === 'offline' ? 'local' : 'saving');
  return updateMom(id, fields).then(() => {
    if (ED.id === id && !ED.bodyDirty && !Object.keys(ED.pending).length) setStatus('saved');
    if (withToast) toast('Saved', { icon: 'check', ms: 2000 });
  }, () => {
    if (ED.id !== id) return;
    // Put what failed back, under anything typed since, so Retry sends it.
    ED.pending = { ...fields, ...ED.pending };
    if ('content' in ED.pending) { delete ED.pending.content; ED.bodyDirty = true; }
    setStatus('failed');
  });
}
on('retry-save', () => saveNow(true));
KEYS.save = () => { if (route().name === 'mom') saveNow(true); };
on('done', () => {
  const m = mom(ED.id);
  saveNow(false);
  go(m && area(m.folderId) ? areaHref(m.folderId) : '#/today');
});
window.addEventListener('pagehide', () => saveNow(false));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(false); });

/* ---------- Title, date, tags, document (C4, C5) ---------- */
onInput('ed-title', el => { ED.pending.title = el.textContent.replace(/\s+/g, ' ').trim(); schedule(); });
onKey('ed-title', e => { if (e.key === 'Enter') { e.preventDefault(); if (ED.editor) ED.editor.commands.focus('start'); } });
onInput('ed-date', el => { if (!el.value) return; ED.pending.date = el.value; paintMeta(); schedule(); });
onForm('ed-tag', f => {
  const raw = f.elements.tag.value.trim().replace(/^#+/, '');
  if (!raw) return;
  const m = mom(ED.id); if (!m) return;
  const tags = current(m).tags;
  if (!tags.some(t => t.toLowerCase() === raw.toLowerCase())) { ED.pending.tags = [...tags, raw]; schedule(); }
  paintMeta();
  const input = $('#edMeta .tag-add'); if (input) input.focus();
});
on('tag-remove', d => {
  const m = mom(ED.id); if (!m) return;
  ED.pending.tags = current(m).tags.filter(t => t !== d.t);
  paintMeta(); schedule();
});
on('doc-attach', () => {
  const m = mom(ED.id); if (!m || ED.ro) return;
  const cur = current(m).gdoc;
  layer({
    label: 'Attach a document',
    html: `<form data-form="ed-doc" novalidate>${dialogHTML({
      title: 'Attach a document', text: 'Link the Google Doc or other document this meeting belongs to.',
      body: fieldHTML({ id: 'docUrl', label: 'Address', control: inputHTML({ id: 'docUrl', name: 'url', value: cur, placeholder: 'docs.google.com/…', inputmode: 'url' }) }),
      foot: (cur ? btnHTML({ kind: 'soft', label: 'Remove link', act: 'doc-remove' }) + '<span class="left"></span>' : '') + btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + btnHTML({ kind: 'primary', label: 'Attach', type: 'submit' }),
    })}</form>`,
  });
});
onForm('ed-doc', f => {
  const url = f.elements.url.value.trim();
  if (!url) { fieldError(f, 'docUrl', 'Paste the document’s address.'); return; }
  ED.pending.gdoc = url; closeAll(); paintMeta(); schedule();
  toast('Document attached', { icon: 'link' });
});
on('doc-remove', () => { ED.pending.gdoc = ''; closeAll(); paintMeta(); schedule(); });
/* Mark a field as wrong, with its message (design: .field.err + .ferr). */
function fieldError(form, id, msg) {
  const field = form.querySelector('#' + id + '-field'), input = form.querySelector('#' + id);
  if (!field || !input) return;
  field.classList.add('err');
  input.setAttribute('aria-invalid', 'true');
  let err = field.querySelector('.ferr');
  if (!err) { field.insertAdjacentHTML('beforeend', `<span class="ferr" role="alert" id="${id}-err">${ic('alert', 'sm')}${esc(msg)}</span>`); }
  input.setAttribute('aria-describedby', id + '-err');
  input.focus();
}

/* ---------- The ⋯ menu ---------- */
on('editor-menu', (d, el) => {
  const m = mom(d.id); if (!m) return;
  const ro = readOnly(m);
  const blocked = (label, icon, act, data) => (ro ? { label, icon, act: 'blocked-final', data } : { label, icon, act, data });
  menu(el, [
    { label: 'Export as A4 PDF', icon: 'export', act: 'export-pdf', data: { id: m.id } },
    ro ? { label: 'Attach a document', icon: 'link', act: 'blocked-final', note: 'Final' } : { label: current(m).gdoc ? 'Change document link' : 'Attach a document', icon: 'link', act: 'doc-attach' },
    '-',
    { label: m.starred ? 'Unflag' : 'Flag as important', icon: m.starred ? 'flag' : 'flag-fill', act: 'flag', data: { kind: 'm', id: m.id } },
    blocked('Rename', 'pencil', 'ed-rename', { id: m.id }),
    blocked('Move to…', 'move', 'move-item', { kind: 'm', id: m.id }),
    { label: m.readOnly ? 'Unmark final' : 'Mark as final', icon: 'lock', act: 'final', data: { kind: 'm', id: m.id }, admin: { k: 'final', label: 'mark MoMs as final' } },
    { label: 'Share a link', icon: 'share', act: 'share', data: { kind: 'm', id: m.id }, admin: { k: 'shareLinks', label: 'share links' } },
    '-',
    { label: 'Delete', icon: 'trash', act: 'delete-item', data: { kind: 'm', id: m.id }, danger: true, admin: { k: 'deleteItem', label: 'delete MoMs' } },
  ], 'MoM');
});
on('blocked-final', () => toast('This is marked final, so it can’t be changed.', { icon: 'lock', tone: 'warn' }));
on('ed-rename', () => { const t = $('#edTitle'); if (!t) return; t.focus(); const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });

/* ---------- Toolbar, bubble and menus (W1, W2, W5) ---------- */
function chain() { return ED.editor.chain().focus(); }
function runCmd(cmd) {
  const e = ED.editor; if (!e || ED.ro) return;
  const c = chain();
  const map = {
    undo: () => c.undo(), redo: () => c.redo(),
    bold: () => c.toggleBold(), italic: () => c.toggleItalic(), underline: () => c.toggleUnderline(), strike: () => c.toggleStrike(),
    ul: () => c.toggleBulletList(), ol: () => c.toggleOrderedList(), quote: () => c.toggleBlockquote(),
    alignStart: () => c.setTextAlign('left'), alignCenter: () => c.setTextAlign('center'), alignEnd: () => c.setTextAlign('right'),
    removeFormat: () => c.unsetAllMarks().unsetTextAlign(),
  };
  if (map[cmd]) map[cmd]().run();
}
on('ed', d => runCmd(d.cmd));
onInput('ed-block', el => {
  if (!ED.editor) return;
  const c = chain();
  if (el.value === 'p') c.setParagraph().run(); else c.setHeading({ level: Number(el.value.slice(1)) }).run();
});
on('align-menu', (d, el) => menu(el, [
  { label: 'Align start', icon: 'al', act: 'ed', data: { cmd: 'alignStart' } },
  { label: 'Align centre', icon: 'ac', act: 'ed', data: { cmd: 'alignCenter' } },
  { label: 'Align end', icon: 'ar', act: 'ed', data: { cmd: 'alignEnd' } },
], 'Alignment'));
on('text-menu', (d, el) => {
  if (!ED.editor) return;
  const ts = ED.editor.getAttributes('textStyle');
  const font = ts.fontFamily === FONT_STACK.serif ? 'serif' : ts.fontFamily === FONT_STACK.mono ? 'mono' : ts.fontFamily ? '' : 'sans';
  const size = ts.fontSize ? parseInt(ts.fontSize, 10) : 16;
  layer({
    cls: 'layer-menu', label: 'Typeface, size and colour', html: textMenuHTML({ font, size }),
    onMount(panel) {
      if (isPhone()) return;
      const r = el.getBoundingClientRect();
      panel.style.top = (r.bottom + 8) + 'px';
      panel.style.left = Math.max(12, Math.min(r.left - 40, window.innerWidth - 340)) + 'px';
    },
  });
});
on('tm-font', d => { closeAll(); if (d.v === 'sans') chain().unsetFontFamily().run(); else chain().setFontFamily(FONT_STACK[d.v]).run(); });
on('tm-size', d => { closeAll(); chain().setFontSize(d.v + 'px').run(); });
on('swatch-pick', d => {
  closeAll();
  if (d.kind === 'text') { if (d.c) chain().setColor(d.c).run(); else chain().unsetColor().run(); }
  else if (d.c) chain().setHighlight({ color: d.c }).run(); else chain().unsetHighlight().run();
});

/* Toolbar pressed states (W2), the bubble, the image bar and the table bar follow the selection. */
let _chromeFrame = 0;
function refreshChrome() {
  if (_chromeFrame) return;
  _chromeFrame = requestAnimationFrame(() => { _chromeFrame = 0; paintToolbar(); paintBubble(); paintTableBar(); paintJournal(); });
}
function paintToolbar() {
  const e = ED.editor, bar = $('#view .toolbar');
  if (!e || !bar) return;
  const set = (cmd, on) => { const b = bar.querySelector(`[data-cmd="${cmd}"]`); if (b) b.setAttribute('aria-pressed', String(!!on)); };
  ['bold', 'italic', 'underline', 'strike'].forEach(k => set(k, e.isActive(k)));
  set('ul', e.isActive('bulletList')); set('ol', e.isActive('orderedList')); set('quote', e.isActive('blockquote'));
  const undo = bar.querySelector('[data-cmd="undo"]'), redo = bar.querySelector('[data-cmd="redo"]');
  if (undo) undo.disabled = !e.can().undo();
  if (redo) redo.disabled = !e.can().redo();
  const sel = bar.querySelector('[data-change="ed-block"]');
  if (sel && document.activeElement !== sel) sel.value = [1, 2, 3].find(l => e.isActive('heading', { level: l })) ? 'h' + [1, 2, 3].find(l => e.isActive('heading', { level: l })) : 'p';
  const align = bar.querySelector('[data-act="align-menu"]');
  if (align) {
    const icon = e.isActive({ textAlign: 'center' }) ? 'ac' : e.isActive({ textAlign: 'right' }) ? 'ar' : 'al';
    align.innerHTML = ic(icon) + ic('chev-d', 'sm');
    align.setAttribute('aria-pressed', String(icon !== 'al'));
  }
}
function paintBubble() {
  const host = $('#bubbleHost'), e = ED.editor;
  if (!host) return;
  if (!e || ED.ro || isPhone() || (!e.isFocused && !host.contains(document.activeElement))) { host.innerHTML = ''; return; }
  const { selection } = e.state;
  if (selection.node && selection.node.type.name === 'image') {
    const dom = e.view.nodeDOM(selection.from);
    if (!dom || !dom.getBoundingClientRect) { host.innerHTML = ''; return; }
    const r = dom.getBoundingClientRect();
    host.innerHTML = imageBubbleHTML({ mode: selection.node.attrs.px != null ? 'float' : 'inline' });
    placeBubble(host.firstElementChild, r.left + r.width / 2, r.top, r.bottom);
    return;
  }
  if (selection.empty || selection.node || e.isActive('table') && selection.$from.parent.type.name !== 'paragraph') { host.innerHTML = ''; return; }
  const a = e.view.coordsAtPos(selection.from), b = e.view.coordsAtPos(selection.to);
  const active = {}; ['bold', 'italic', 'underline', 'strike'].forEach(k => { active[k] = e.isActive(k); });
  host.innerHTML = bubbleHTML({ active });
  placeBubble(host.firstElementChild, (a.left + b.right) / 2, Math.min(a.top, b.top), Math.max(a.bottom, b.bottom));
}
/* Above the selection, or below it when the toolbar (or the window top) is in the way.
   The bubble's CSS lifts it by its own height (translate -100%). */
function placeBubble(el, x, top, bottom) {
  if (!el) return;
  const h = el.offsetHeight || 48;
  const tb = $('#view .toolbar .tb-inner');
  const limit = Math.max(8, tb ? tb.getBoundingClientRect().bottom + 6 : 8);
  place(el, x, top - 8 - h >= limit ? top - 8 : bottom + 8 + h);
}
function place(el, x, y) { if (!el) return; el.style.left = Math.round(x) + 'px'; el.style.top = Math.round(Math.max(8, y)) + 'px'; }

/* Links (W5) */
on('ed-link', () => {
  const e = ED.editor; if (!e || ED.ro) return;
  const href = e.getAttributes('link').href || '';
  layer({
    label: 'Link',
    html: `<form data-form="ed-link" novalidate>${dialogHTML({
      title: 'Add a link', text: 'Turn the selected text into a web link.',
      body: fieldHTML({ id: 'lkIn', label: 'Web address', control: inputHTML({ id: 'lkIn', name: 'url', type: 'url', inputmode: 'url', placeholder: 'https://', value: href }) }),
      foot: (href ? btnHTML({ kind: 'soft', label: 'Remove link', act: 'ed-unlink' }) + '<span class="left"></span>' : '') + btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + btnHTML({ kind: 'primary', label: 'Add link', type: 'submit' }),
    })}</form>`,
  });
});
onForm('ed-link', f => {
  const raw = f.elements.url.value.trim();
  if (!/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(raw)) { fieldError(f, 'lkIn', 'Enter a web address that starts with https://'); return; }
  const href = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
  closeAll();
  const e = ED.editor; if (!e) return;
  if (e.state.selection.empty && !e.isActive('link')) chain().insertContent(`<a href="${esc(href)}">${esc(raw)}</a> `).run();
  else chain().extendMarkRange('link').setLink({ href }).run();
  toast('Link added', { icon: 'link' });
});
on('ed-unlink', () => { closeAll(); if (ED.editor) chain().extendMarkRange('link').unsetLink().run(); });
/* Links to MoMs (https://mom.local/{id}) and to workspace files show as pills (W7). */
function linkClass(href) {
  if (/^https:\/\/mom\.local\//.test(href)) return 'ref mom';
  if (href && D.some(d => d.url === href)) return 'ref';
  return '';
}
function onBodyClick(event) {
  const a = event.target.closest && event.target.closest('a[href]');
  if (!a || !ED.editor) return false;
  const href = a.getAttribute('href');
  event.preventDefault();
  const momId = (href.match(/^https:\/\/mom\.local\/([^/?#]+)/) || [])[1];
  if (momId) { saveNow(false); go('#/mom/' + encodeURIComponent(momId)); return true; }
  const f = D.find(d => d.url === href);
  window.open(href, '_blank', 'noopener');
  toast(`“${f ? f.name : a.textContent}” opened in a new tab`, { icon: 'external' });
  return true;
}

/* ---------- "/" menu (plan 2.9) and the ＋ insert button ---------- */
const slashRenderer = () => ({
  onStart: p => { ED.slash = { items: p.items, idx: 0, run: p.command, rect: p.clientRect }; drawSlash(); },
  onUpdate: p => { ED.slash = { ...ED.slash, items: p.items, run: p.command, rect: p.clientRect, idx: Math.min(ED.slash ? ED.slash.idx : 0, Math.max(p.items.length - 1, 0)) }; drawSlash(); },
  onKeyDown: ({ event }) => {
    const s = ED.slash; if (!s) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { s.idx = (s.idx + (event.key === 'ArrowDown' ? 1 : -1) + s.items.length) % Math.max(s.items.length, 1); drawSlash(); return true; }
    if (event.key === 'Enter') { const it = s.items[s.idx]; if (it) s.run({ i: it.i }); return true; }
    if (event.key === 'Escape') { closeSlash(); event.preventDefault(); return true; }
    return false;
  },
  onExit: () => closeSlash(),
});
function drawSlash() {
  const host = $('#slashHost'), s = ED.slash; if (!host || !s) return;
  host.innerHTML = slashHTML({ items: s.items, idx: s.idx });
  const r = s.rect && s.rect();
  if (r) place(host.firstElementChild, Math.max(12, r.left), r.bottom + 6);
  const cur = host.querySelector('[aria-selected="true"]'); if (cur) cur.scrollIntoView({ block: 'nearest' });
}
function closeSlash() { ED.slash = null; const h = $('#slashHost'); if (h) h.innerHTML = ''; }
on('slash-pick', d => { const s = ED.slash; if (s) s.run({ i: Number(d.i) }); else runSlash(Number(d.i)); });
on('ed-insert', (d, el) => menu(el, SLASH_ITEMS.map((x, i) => ({ label: x.title, icon: x.i, act: 'slash-pick', data: { i } })), 'Insert'));
function runSlash(i) {
  const e = ED.editor; if (!e) return;
  const c = () => chain();
  switch (i) {
    case 0: c().setHeading({ level: 1 }).run(); break;
    case 1: c().setHeading({ level: 2 }).run(); break;
    case 2: c().toggleBulletList().run(); break;
    case 3: c().toggleOrderedList().run(); break;
    case 4: c().toggleBlockquote().run(); break;
    case 5: c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
    case 6: c().insertContent(`<table data-template="${window._TT.JOURNAL}"><tbody><tr><th><p>Company</p></th><th><p>Contact</p></th><th><p>Stage</p></th><th><p>Next step</p></th><th data-coltype="longtext"><p>Detailed Remarks</p></th></tr><tr><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr></tbody></table><p></p>`).run(); break;
    case 7: openImageDialog(); break;
    case 8: pickLinks('files'); break;
    case 9: pickLinks('moms'); break;
  }
}

/* ---------- Tables (W3) and Long text (P-1) ---------- */
function tableCtx() {
  const e = ED.editor; if (!e || !e.isActive('table')) return null;
  const $f = e.state.selection.$from;
  let d = $f.depth, cellD = -1, rowD = -1, tableD = -1;
  for (; d > 0; d--) {
    const n = $f.node(d).type.name;
    if (cellD < 0 && (n === 'tableCell' || n === 'tableHeader')) cellD = d;
    else if (rowD < 0 && n === 'tableRow') rowD = d;
    else if (n === 'table') { tableD = d; break; }
  }
  if (tableD < 0 || rowD < 0 || cellD < 0) return null;
  const table = $f.node(tableD), tablePos = $f.before(tableD);
  const row = $f.index(tableD), col = $f.index(rowD);
  const head = table.firstChild;
  const longHere = !!(head && head.childCount > col && head.child(col).attrs.coltype === 'longtext');
  return { table, tablePos, row, col, journal: table.attrs.template === window._TT.JOURNAL, longHere };
}
function paintTableBar() {
  const host = $('#ttHost'); if (!host) return;
  const ctx = !ED.ro && !isPhone() ? tableCtx() : null;
  if (!ctx) { host.innerHTML = ''; return; }
  host.innerHTML = tableBarHTML({ longtextHere: ctx.longHere, headerRow: ctx.row === 0, journal: ctx.journal });
  const bar = host.firstElementChild, dom = ED.editor.view.nodeDOM(ctx.tablePos), canvas = $('#edCanvas');
  if (bar && dom && canvas) bar.style.top = Math.round(dom.getBoundingClientRect().top - canvas.getBoundingClientRect().top - 56) + 'px';
}
const simpleTable = t => { let ok = true; t.forEach(r => r.forEach(c => { if (c.attrs.colspan > 1 || c.attrs.rowspan > 1) ok = false; })); return ok; };
function replaceTable(ctx, rows) {
  const e = ED.editor, { table, tablePos } = ctx;
  const next = table.type.create(table.attrs, rows, table.marks);
  e.view.dispatch(e.state.tr.replaceWith(tablePos, tablePos + table.nodeSize, next));
}
on('table-op', d => {
  const e = ED.editor, ctx = tableCtx(); if (!e || !ctx || ED.ro) return;
  const { table, row, col, journal, longHere } = ctx;
  const c = () => chain();
  const rows = []; table.forEach(r => rows.push(r));
  switch (d.op) {
    case 'row-above': c().addRowBefore().run(); break;
    case 'row-below': c().addRowAfter().run(); break;
    case 'row-up': case 'row-down': {
      const to = d.op === 'row-up' ? row - 1 : row + 1;
      if (row === 0 || to < 1 || to >= rows.length) break;
      [rows[row], rows[to]] = [rows[to], rows[row]];
      replaceTable(ctx, rows); break;
    }
    case 'col-left': c().addColumnBefore().run(); break;
    case 'col-right': c().addColumnAfter().run(); break;
    case 'col-move-left': case 'col-move-right': {
      if (journal && longHere) { toast('The Detailed Remarks column stays where it is.', { icon: 'lock', tone: 'warn' }); break; }
      if (!simpleTable(table)) { toast('This table has merged cells, so its columns can’t be moved.', { icon: 'alert', tone: 'warn' }); break; }
      const to = d.op === 'col-move-left' ? col - 1 : col + 1;
      if (to < 0 || to >= rows[0].childCount) break;
      replaceTable(ctx, rows.map(r => { const cells = []; r.forEach(x => cells.push(x)); [cells[col], cells[to]] = [cells[to], cells[col]]; return r.type.create(r.attrs, cells, r.marks); }));
      break;
    }
    case 'toggle-longtext': {
      if (journal && longHere) { toast('Detailed Remarks is part of the Prospect journal and stays long text.', { icon: 'lock', tone: 'warn' }); break; }
      const head = rows[0]; if (col >= head.childCount) break;
      let pos = ctx.tablePos + 2; for (let i = 0; i < col; i++) pos += head.child(i).nodeSize;
      const cell = head.child(col);
      e.view.dispatch(e.state.tr.setNodeMarkup(pos, null, { ...cell.attrs, coltype: longHere ? null : 'longtext' }));
      toast(longHere ? 'Column is plain text again' : 'Column set to Long text. Tap a cell to write in it.', { icon: 'text' });
      break;
    }
    case 'del-row': if (row > 0) c().deleteRow().run(); break;
    case 'del-col':
      if (journal && longHere) { toast('Detailed Remarks can’t be deleted from the Prospect journal.', { icon: 'lock', tone: 'warn' }); break; }
      c().deleteColumn().run(); break;
    case 'del-table': c().deleteTable().run(); toast('Table deleted', { icon: 'trash', action: { label: 'Undo', act: 'ed-undo' } }); break;
  }
  refreshChrome();
});
on('ed-undo', () => { if (ED.editor) chain().undo().run(); });
on('ed-table', (d, el) => {
  const e = ED.editor; if (!e || ED.ro) return;
  const ctx = tableCtx();
  if (!ctx) { chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); return; }
  if (!isPhone()) return;   // desktop: the table bar is already showing
  const op = (label, icon, o, danger = false) => ({ label, icon, act: 'table-op', data: { op: o }, danger });
  menu(el, [
    op('Row above', 'arrow-up', 'row-above'), op('Row below', 'arrow-down', 'row-below'),
    op('Move row up', 'arrow-up', 'row-up'), op('Move row down', 'arrow-down', 'row-down'), '-',
    op('Column left', 'arrow-left', 'col-left'), op('Column right', 'arrow-right', 'col-right'),
    op('Move column left', 'chev-r', 'col-move-left'), op('Move column right', 'chev-r', 'col-move-right'), '-',
    op(ctx.longHere ? 'Make text' : 'Long text column', 'text', 'toggle-longtext'),
    op('Delete row', 'trash', 'del-row', true), op('Delete column', 'trash', 'del-col', true), op('Delete table', 'trash', 'del-table', true),
  ], 'Table');
});

/* The prospect journal bar (W8): entries, and New entry. */
function journalTable() {
  const e = ED.editor; if (!e) return null;
  let found = null;
  e.state.doc.descendants((n, pos) => { if (found) return false; if (n.type.name === 'table' && n.attrs.template === window._TT.JOURNAL) { found = { node: n, pos }; return false; } return true; });
  return found;
}
function paintJournal() {
  const host = $('#journalHost'), canvas = $('#edCanvas'); if (!host) return;
  const j = journalTable();
  if (canvas) canvas.classList.toggle('wide', !!j);
  host.innerHTML = j ? journalBarHTML({ count: Math.max(0, j.node.childCount - 1), readOnly: ED.ro }) : '';
}
on('new-entry', () => {
  const e = ED.editor, j = journalTable(); if (!e || !j || ED.ro) return;
  let pos = j.pos + 1; for (let i = 0; i < j.node.childCount - 1; i++) pos += j.node.child(i).nodeSize;
  // caret into the last row's first cell, add a row after it, then into the new row
  e.chain().focus().setTextSelection(pos + 3).addRowAfter().run();
  const nj = journalTable(); let p2 = nj.pos + 1; for (let i = 0; i < nj.node.childCount - 1; i++) p2 += nj.node.child(i).nodeSize;
  e.chain().focus().setTextSelection(p2 + 3).scrollIntoView().run();
});

/* Detailed Remarks drawer (W8): the cell's full text, roomy; journal entries show their other
   fields too. Writes plain text back into the note, only when something changed. */
function cellOf(td) {
  const e = ED.editor; if (!e || !td || !td.isConnected) return null;
  let pos; try { pos = e.view.posAtDOM(td, 0); } catch (err) { return null; }
  const $p = e.state.doc.resolve(pos);
  for (let d = $p.depth; d > 0; d--) {
    const n = $p.node(d);
    if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') {
      const rowD = d - 1, tableD = d - 2;
      return { node: n, pos: $p.before(d), row: $p.index(tableD), col: $p.index(rowD), rowNode: $p.node(rowD), table: $p.node(tableD), tablePos: $p.before(tableD) };
    }
  }
  return null;
}
const plain = cell => cell.textBetween(0, cell.content.size, '\n', '\n');
function setCellPlain(info, text) {
  const e = ED.editor; if (!e || ED.ro) return;
  const schema = e.state.schema;
  const paras = text.split('\n').map(l => schema.nodes.paragraph.create(null, l ? schema.text(l) : null));
  e.view.dispatch(e.state.tr.replaceWith(info.pos + 1, info.pos + info.node.nodeSize - 1, paras));
}
on('remarks-open', (d, el) => {
  const td = el.closest('td,th'); const info = cellOf(td); if (!info) return;
  ED.cell = { td, col: info.col };
  const labels = []; info.table.firstChild.forEach(c => labels.push(c.textContent.trim()));
  const journal = info.table.attrs.template === window._TT.JOURNAL;
  const cells = []; info.rowNode.forEach(c => cells.push(plain(c)));
  const label = labels[info.col] || 'Long text';
  const head = info.table.firstChild;
  const fields = journal ? cells.map((v, i) => ({ id: 'c' + i, label: labels[i] || `Column ${i + 1}`, value: v, i })).filter(f => f.i !== info.col && !(head.child(f.i) && head.child(f.i).attrs.coltype === 'longtext')) : null;
  const stageI = labels.findIndex(l => /stage/i.test(l)), nextI = labels.findIndex(l => /next/i.test(l));
  const sub = journal && (cells[stageI] || cells[nextI]) ? `<div class="sub">${stageI > -1 && cells[stageI] ? rolePillHTML(cells[stageI]) : ''} ${nextI > -1 && cells[nextI] ? `<span class="muted">Next: ${esc(cells[nextI])}</span>` : ''}</div>` : '';
  layer({
    cls: 'layer-drawer', label,
    html: remarksDrawerHTML({ title: journal ? (cells[0] || 'New company') : label, sub, text: cells[info.col], fields, status: UI.edStatus || 'saved' }),
    onMount(panel) {
      if (ED.ro) panel.querySelectorAll('textarea, input').forEach(x => { x.readOnly = true; });
      const t = panel.querySelector('#rmText'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
    },
    onClose() { flushRemark(); ED.cell = null; },
  });
});
function flushRemark() {
  clearTimeout(ED.rmTimer);
  const t = $('#rmText'), c = ED.cell; if (!t || !c || ED.ro) return;
  const info = cellOf(c.td); if (!info) return;
  if (plain(info.node) !== t.value) setCellPlain(info, t.value);
}
onInput('remark-text', () => { if (ED.ro) return; setStatus('saving'); clearTimeout(ED.rmTimer); ED.rmTimer = setTimeout(flushRemark, 350); });
onInput('remark-field', el => {
  const c = ED.cell; if (!c || ED.ro) return;
  const info = cellOf(c.td); if (!info) return;
  const i = Number(el.dataset.i);
  let pos = info.pos - (() => { let off = 0; for (let k = 0; k < info.col; k++) off += info.rowNode.child(k).nodeSize; return off; })();
  for (let k = 0; k < i; k++) pos += info.rowNode.child(k).nodeSize;
  const cell = info.rowNode.child(i);
  if (plain(cell) !== el.value) setCellPlain({ node: cell, pos }, el.value);
});

/* ---------- Images (W4) ---------- */
function openImageDialog() {
  layer({
    label: 'Add an image',
    html: `<form data-form="img-url" novalidate>${dialogHTML({
      title: 'Add an image', text: 'Place it in the MoM. You can resize it and float it anywhere over the note.',
      body: fieldHTML({ id: 'imgUrl', label: 'From a web address', control: inputHTML({ id: 'imgUrl', name: 'url', type: 'url', inputmode: 'url', placeholder: 'https://' }) }),
      foot: btnHTML({ kind: 'soft', label: 'From your device', icon: 'upload', act: 'img-device' }) + '<span class="left"></span>' + btnHTML({ kind: 'primary', label: 'Add image', type: 'submit' }),
    })}</form>`,
  });
}
on('ed-image', () => { if (ED.editor && !ED.ro) openImageDialog(); });
onForm('img-url', f => {
  const url = f.elements.url.value.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) { fieldError(f, 'imgUrl', 'Enter a web address for the image.'); return; }
  closeAll();
  chain().setImage({ src: url }).run();
});
on('img-device', () => { closeAll(); pickFiles(files => files.filter(x => /^image\//.test(x.type)).forEach(x => uploadImage(x)), 'image/*'); });
/* Images pasted or dropped into the note upload with a placeholder. Returns true if it took them. */
function imagesFrom(dt, at) {
  if (!dt || ED.ro) return false;
  const files = Array.from(dt.files || []).filter(f => /^image\//.test(f.type));
  if (!files.length) return false;
  files.forEach(f => uploadImage(f, at && at.pos));
  return true;
}
function uploadImage(file, pos) {
  const e = ED.editor; if (!e || ED.ro) return;
  const TT = window._TT, id = newId();
  const at = pos != null ? pos : e.state.selection.from;
  ED.uploads.set(id, file);
  e.view.dispatch(e.state.tr.setMeta(TT.uploadKey, { add: { id, pos: at } }));
  let last = 0;
  uploadCL(file, pct => {
    if (!ED.editor || pct - last < 5) return; last = pct;
    ED.editor.view.dispatch(ED.editor.state.tr.setMeta(TT.uploadKey, { set: { id, pct } }));
  }).then(res => {
    const ed = ED.editor; if (!ed) return;
    const p = TT.uploadSlotPos(ed.state, id); if (p == null) return;
    ED.uploads.delete(id);
    ed.view.dispatch(ed.state.tr.setMeta(TT.uploadKey, { remove: id }));
    ed.chain().insertContentAt(p, { type: 'image', attrs: { src: res.url, alt: '' } }).run();
  }, () => {
    const ed = ED.editor; if (!ed) return;
    ed.view.dispatch(ed.state.tr.setMeta(TT.uploadKey, { set: { id, failed: true } }));
  });
}
on('img-retry', d => {
  const e = ED.editor, file = ED.uploads.get(d.id); if (!e || !file) return;
  const TT = window._TT, p = TT.uploadSlotPos(e.state, d.id);
  e.view.dispatch(e.state.tr.setMeta(TT.uploadKey, { remove: d.id }));
  ED.uploads.delete(d.id);
  uploadImage(file, p);
});
on('img-mode', d => {
  const e = ED.editor; if (!e || ED.ro) return;
  const sel = e.state.selection; if (!sel.node || sel.node.type.name !== 'image') return;
  let attrs;
  if (d.mode === 'float') {
    const dom = e.view.nodeDOM(sel.from), root = e.view.dom.getBoundingClientRect();
    const r = dom && dom.getBoundingClientRect ? dom.getBoundingClientRect() : root;
    attrs = { ...sel.node.attrs, px: Math.max(0, Math.round(r.left - root.left)), py: Math.max(0, Math.round(r.top - root.top)), width: sel.node.attrs.width || Math.round(Math.min(r.width, root.width * 0.46)) + 'px' };
  } else attrs = { ...sel.node.attrs, px: null, py: null };
  e.view.dispatch(e.state.tr.setNodeMarkup(sel.from, null, attrs));
  e.commands.setNodeSelection(sel.from);
});
on('img-remove', () => { if (ED.editor && !ED.ro) chain().deleteSelection().run(); });

/* ---------- Links to files and MoMs (W6, W7) ---------- */
function pickLinks(kind) {
  const isFiles = kind === 'files';
  const items = isFiles
    ? D.filter(f => f.url && !hiddenItem('f', f)).map(f => ({ id: f.id, label: f.name || 'Untitled file', sub: [area(f.folderId) && area(f.folderId).name, f.docFolderId && groupName(f.docFolderId)].filter(Boolean).join(' · '), icon: KINDS[docKind(f)].icon, href: f.url }))
    : M.filter(x => x.id !== ED.id && !hiddenItem('m', x)).sort((a, b) => (Number(b.date) || 0) - (Number(a.date) || 0)).map(x => ({ id: x.id, label: x.title || 'Untitled meeting', sub: `${area(x.folderId) ? area(x.folderId).name : ''} · ${fmtDate(isoOf(x.date))}`, icon: 'doc', href: 'https://mom.local/' + x.id }));
  const chosen = new Set();
  const rowsHTML = q => {
    const t = q.trim().toLowerCase();
    if (!items.length) return emptyHTML({ small: true, icon: isFiles ? 'upload' : 'doc', title: 'Nothing yet', text: isFiles ? 'Upload a file or save a link first.' : 'Meetings you write will show here, newest first.' });
    const list = items.filter(x => !t || x.label.toLowerCase().includes(t) || x.sub.toLowerCase().includes(t));
    if (!list.length) return noResultHTML({ title: `No matches for “${q.trim()}”`, text: 'Try another name.' });
    return list.map(x => `<button type="button" class="dest" role="option" aria-selected="${chosen.has(x.id)}" data-act="link-pick" data-id="${esc(x.id)}"><span class="gi">${ic(x.icon, 'sm')}</span><span class="mid"><b>${esc(x.label)}</b><small>${esc(x.sub)}</small></span>${chosen.has(x.id) ? ic('check', 'sm') : ''}</button>`).join('');
  };
  ED.picker = { items, chosen, rowsHTML, isFiles };
  layer({
    label: isFiles ? 'Link files' : 'Link MoMs',
    html: dialogHTML({
      title: isFiles ? 'Link workspace files' : 'Link earlier MoMs',
      text: isFiles ? 'Pick several at once. Each becomes a named link.' : 'Newest first, with area and date. Opening a link saves this MoM first.',
      body: `<div class="dest-search">${ic('search', 'sm')}<input class="input" id="lkSearch" type="search" placeholder="Search by name" autocomplete="off" aria-label="Search" data-input="link-search"></div><div class="dests" id="lkList" role="listbox" aria-multiselectable="true">${rowsHTML('')}</div>`,
      foot: btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + `<button type="button" class="btn btn-primary" id="lkGo" data-act="link-insert" disabled>Insert links</button>`,
    }),
    onClose() { ED.picker = null; },
  });
}
function refreshPicker() {
  const p = ED.picker; if (!p) return;
  const list = $('#lkList'), go2 = $('#lkGo'), q = $('#lkSearch');
  if (list) list.innerHTML = p.rowsHTML(q ? q.value : '');
  if (go2) { go2.disabled = !p.chosen.size; go2.textContent = p.chosen.size ? `Insert ${p.chosen.size} link${p.chosen.size === 1 ? '' : 's'}` : 'Insert links'; }
}
onInput('link-search', () => refreshPicker());
on('link-pick', d => { const p = ED.picker; if (!p) return; p.chosen.has(d.id) ? p.chosen.delete(d.id) : p.chosen.add(d.id); refreshPicker(); });
on('link-insert', () => {
  const p = ED.picker; if (!p || !p.chosen.size || !ED.editor) return;
  const parts = [...p.chosen].map(id => p.items.find(i => i.id === id)).filter(Boolean).map(x => `<a href="${esc(x.href)}">${esc(x.label)}</a>`);
  const n = parts.length;
  closeAll();
  chain().insertContent(parts.join(' ') + ' ').run();
  toast(`Inserted ${n} link${n === 1 ? '' : 's'}`, { icon: 'link' });
});

/* ---------- A colleague's save (S2) ---------- */
function onRemoteSnap(snap) {
  if (!snap.exists || snap.metadata.hasPendingWrites || !ED.editor) return;
  const d = snap.data(), k = ED.known; if (!k) return;
  const changed = (d.content || '') !== k.content || (d.title || '') !== k.title || d.date !== k.date || JSON.stringify(d.tags || []) !== k.tags || (d.gdoc || '') !== k.gdoc;
  if (!changed) return;
  ED.remote = d;
  const host = $('#remoteHost');
  if (host) host.innerHTML = remoteBarHTML({ who: (d.editedBy && d.editedBy.name) || 'Someone' });
}
on('apply-remote', async () => {
  const d = ED.remote, e = ED.editor; if (!d || !e) return;
  let html;
  try { html = (await toEditorHTML(d.content)).html; } catch (err) { toast('Couldn’t show the changes. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }); return; }
  const { from, to } = e.state.selection;
  e.chain().command(({ tr }) => { tr.setMeta('remote', true); return true; }).setContent(html, false).run();
  const size = e.state.doc.content.size;
  try { e.commands.setTextSelection({ from: Math.min(from, size), to: Math.min(to, size) }); } catch (err) { /* the old place is gone */ }
  ED.known = { content: d.content || '', title: d.title || '', date: d.date, tags: JSON.stringify(d.tags || []), gdoc: d.gdoc || '' };
  ED.pending = {}; ED.bodyDirty = false; ED.remote = null;
  const t = $('#edTitle'); if (t) t.textContent = d.title || '';
  paintMeta(); paintJournal();
  $('#remoteHost').innerHTML = '';
  setStatus('saved');
  toast(`Updated with ${(d.editedBy && d.editedBy.name) || 'the latest'} changes. Your place is kept.`, { icon: 'cloud-check' });
});

/* Data changes elsewhere repaint what the editor shows around the note (flag, meta, journal). */
Store.onChange(what => {
  if (what !== 'moms' || !ED.id || !ED.editor) return;
  const m = mom(ED.id); if (!m) return;
  if (readOnly(m) !== ED.ro) { render(); return; }   // final mark changed: rebuild in the right mode
  paintMeta();
  const head = $('#view .ed-head'); if (head) { const a = area(m.folderId); const t = document.createElement('div'); t.innerHTML = edHeadHTML(m, ED.ro, a); head.replaceWith(t.firstElementChild); }
});
/* The phone toolbar sits above the on-screen keyboard. */
if (window.visualViewport) {
  const kb = () => { const v = window.visualViewport; document.documentElement.style.setProperty('--kb', Math.max(0, Math.round(window.innerHeight - v.height - v.offsetTop)) + 'px'); };
  window.visualViewport.addEventListener('resize', kb);
  window.visualViewport.addEventListener('scroll', kb);
}
