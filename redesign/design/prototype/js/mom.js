/* The MoM editor: writing and formatting (W1–W11), autosave (C2, C3),
   Detailed Remarks and Long text columns (W8, P-1), remote edits (S2),
   read-only (P7), export (W9), and creating MoMs (C1, C4, C5). Look only:
   the real app uses Tiptap, which these styles are matched to. */
'use strict';

const ED = { id: null, timer: null, cell: null, remarkCell: null, saved: '' };
const SWATCH_TEXT = ['#161B2E', '#4338CA', '#1D5FB8', '#067647', '#B45309', '#B42318'];
const SWATCH_HL = ['#FFF4E0', '#E4F6EC', '#E4F0FD', '#EEEAFD', '#FDECEB', '#F1F3FA'];
const FONTS = { sans: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'ui-monospace, Menlo, Consolas, monospace' };

/* ---------- Creating MoMs (C1, C4) ---------- */
function newMomIn(areaId, groupId) {
  const a = area(areaId);
  if (!a) {
    toast('Create an area first, then add a MoM to it.', { icon: 'alert', tone: 'warn' });
    return;
  }
  const id = nid('m');
  const d = TODAY_ISO;
  const title = `Meeting – ${fmtDate(d).replace(/^(\d+) (\w+) (\d+)$/, '$1 $2 $3')}`;
  DB.moms.push({ id, title, date: d, tags: [], area: areaId, group: groupId || null, body: '' });
  S.place = { area: areaId, group: groupId || null };
  touchRecent('m', id);
  go(`#/mom/${id}`);
}
on('new-mom', (d) => {
  const p = d.area ? { area: d.area, group: d.group || null } : createPlace(route());
  if (!p || !p.area) { toast('Create an area first, then add a MoM to it.', { icon: 'alert', tone: 'warn' }); return; }
  closeAll();
  newMomIn(p.area, p.group);
});
on('new-mom-title', (d) => {
  const p = createPlace(route());
  if (!p) { toast('Create an area first, then add a MoM to it.', { icon: 'alert', tone: 'warn' }); return; }
  const id = nid('m');
  DB.moms.push({ id, title: d.title || 'Untitled meeting', date: TODAY_ISO, tags: [], area: p.area, group: p.group || null, body: '' });
  closeAll();
  go(`#/mom/${id}`);
});

/* ---------- Editor view ---------- */
VIEWS.mom = {
  html(r) {
    const m = mom(r.id);
    if (!m) return VIEWS.missing.html();
    if (!canSee(m.area)) return `<div class="page">${noAccessAreaHTML(area(m.area))}</div>`;
    const lock = lockedArea(m.area);
    if (lock) return lockedGateHTML(lock, m.title);
    const a = area(m.area);
    const ro = readOnly(m);
    if (m.journal) buildJournalFor(m);
    const path = crumbPath(m.area);
    const groupName = m.group ? group(m.group).name : '';
    touchRecent('m', m.id);
    return `
    <div class="ed-head" aria-label="MoM">
      <button class="ed-back" data-act="done" aria-label="Done, back to ${esc(a.name)}">${ic('arrow-left', 'sm')}<span>Done</span></button>
      ${ro ? `<span class="ed-readonly">${ic('lock', 'sm')}Read only</span>` : `<span class="status-pill js-status" role="status" aria-live="polite">${ic('cloud-check', 'sm')}Saved</span>`}
      <span class="spacer"></span>
      <button class="icon-btn" data-act="flag" data-kind="m" data-id="${m.id}" aria-pressed="${!!m.flagged}" aria-label="${m.flagged ? 'Unflag' : 'Flag as important'}">${ic(m.flagged ? 'flag-fill' : 'flag', 'sm')}</button>
      <button class="icon-btn" data-act="editor-menu" data-id="${m.id}" aria-haspopup="menu" aria-label="More for this MoM">${ic('more', 'sm')}</button>
    </div>
    <div class="toolbar" id="edToolbar" role="toolbar" aria-label="Formatting" ${ro ? 'hidden' : ''}>${toolbarHTML()}</div>
    <div class="canvas${m.journal ? ' wide' : ''}" id="edCanvas">
      <div id="ttools" class="ttools" hidden><div class="tt-inner" role="toolbar" aria-label="Table"></div></div>
      <div class="bubble" id="bubble" role="toolbar" aria-label="Selection formatting" hidden></div>
      <div class="slash" id="slash" role="listbox" aria-label="Insert" hidden></div>
      <nav class="ed-path" aria-label="Where this MoM lives">${path.map((x, i) => `${i ? ic('chev-r', 'sm') : ''}<a href="#/areas/${x.id}">${x.emoji} ${esc(x.name)}</a>`).join('')}${groupName ? `${ic('chev-r', 'sm')}<span>${esc(groupName)}</span>` : ''}</nav>
      <h1 class="ed-title" id="edTitle" contenteditable="${!ro}" spellcheck="false" aria-label="Title" data-id="${m.id}">${esc(m.title)}</h1>
      <div class="ed-meta">
        <button type="button" class="mchip" data-act="pick-date" ${ro ? 'disabled' : ''} aria-label="Meeting date, ${fmtDate(m.date)}. Change date">${ic('calendar', 'sm')}<span>${fmtDate(m.date)}</span></button><input type="date" id="edDate" class="sr" tabindex="-1" aria-hidden="true" value="${m.date}" data-change="ed-date">
        ${m.tags.map(t => `<span class="mchip tagc">#${esc(t)}<button type="button" data-act="tag-remove" data-t="${esc(t)}" aria-label="Remove tag ${esc(t)}" ${ro ? 'hidden' : ''}>${ic('x', 'sm')}</button></span>`).join('')}
        ${ro ? '' : `<input class="tag-add" id="edTag" placeholder="Add tag" aria-label="Add a tag" autocomplete="off">`}
        ${m.doc ? `<a class="mchip doc" href="https://${esc(m.doc.url)}" target="_blank" rel="noopener">${ic('doc', 'sm')}${esc(m.doc.label)}${ic('external', 'sm')}</a>` : (ro ? '' : `<button class="mchip" data-act="doc-attach" data-id="${m.id}">${ic('link', 'sm')}Attach a document</button>`)}
        ${m.flagged ? `<span class="mchip flagc">${ic('flag-fill', 'sm')}Flagged</span>` : ''}
      </div>
      ${ro ? `<div class="notice" role="note" style="margin-bottom:18px">${ic('lock')}<div><b>Marked final.</b> An admin has agreed this record, so you can read, flag and export it, but not change it.</div></div>` : ''}
      <div id="remoteHost"></div>
      ${m.journal ? `<div class="journal-bar"><span class="ktile k-other">${ic('table', 'sm')}</span><span class="mid"><b>Prospect journal</b><small>${plural(DB.journal.length, 'entry').replace('entrys', 'entries')} · tap Detailed Remarks to read or write in full</small></span>${ro ? '' : `<button class="btn btn-primary btn-sm" data-act="new-entry">${ic('plus', 'sm')}New entry</button>`}</div>` : ''}
      <div class="ed-body" id="edBody" contenteditable="${!ro}" spellcheck="${!ro}" role="textbox" aria-multiline="true" aria-label="Meeting notes" style="position:relative" data-id="${m.id}">${m.body || ''}</div>
    </div>`;
  },
  mount(r, el) {
    const m = mom(r.id);
    if (!m) return;
    ED.id = m.id; ED.saved = '';
    const ro = readOnly(m);
    const body = $('#edBody');
    body.addEventListener('input', onEdInput);
    body.addEventListener('keydown', onEdKey);
    body.addEventListener('click', onEdClick);
    body.addEventListener('mousedown', onEdMouseDown);
    body.addEventListener('paste', onEdPaste);
    body.addEventListener('keyup', updateToolbar);
    body.addEventListener('mouseup', () => { updateToolbar(); updateBubble(); });
    $('#edTitle').addEventListener('input', onEdInput);
    $('#edTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); body.focus(); placeCaretStart(body); } });
    if (!ro) bindTagInput(m);
    if (!ro && !body.textContent.trim() && !body.querySelector('img, table')) body.focus({ preventScroll: true });
    if (S.state === 'remote' && !S.remoteDone) setTimeout(() => showRemote(m), 1400);
    if (S.state === 'offline') setStatus('local');
    if (S.state === 'failure') setStatus('failed');
    $$('.img', body).forEach(w => w.setAttribute('contenteditable', 'false'));
    decorateTables();
    updateToolbar();
  },
};
function buildJournalFor(m) { if (m.id === 'pj' && !m.body) buildJournal(); }
function placeCaret(el, atStart) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(!!atStart); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
function placeCaretStart(el) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

/* Toolbar markup: the same look on desktop (docked) and phone (above the keyboard). */
/* Formatting toolbar (W1, W2). Frequent controls stay visible; typeface, size,
   colour and highlight live in one "Aa" menu, alignment in one menu. */
function toolbarHTML() {
  const b = (cmd, icon, label, key = '') => `<button type="button" class="tb" data-act="ed" data-cmd="${cmd}" aria-label="${label}" aria-pressed="false" title="${label}${key ? ' ' + key : ''}">${ic(icon)}</button>`;
  return `<div class="tb-inner">
    ${b('undo', 'undo', 'Undo', '⌘Z')}${b('redo', 'redo', 'Redo', '⇧⌘Z')}<span class="tb-div"></span>
    <label class="tb-sel"><span class="sr">Text style</span><select data-change="ed-block"><option value="p">Normal text</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select></label>
    <span class="tb-div"></span>
    ${b('bold', 'bold', 'Bold', '⌘B')}${b('italic', 'italic', 'Italic', '⌘I')}${b('underline', 'underline', 'Underline', '⌘U')}${b('strike', 'strike', 'Strikethrough')}
    <button type="button" class="tb tb-wide" data-act="text-menu" aria-haspopup="dialog" aria-label="Typeface, size and colour" title="Typeface, size and colour"><span class="aa">Aa</span>${ic('chev-d', 'sm')}</button>
    <button type="button" class="tb tb-wide" data-act="align-menu" aria-haspopup="menu" aria-label="Alignment" title="Alignment" id="tbAlign">${ic('al')}${ic('chev-d', 'sm')}</button>
    <span class="tb-div"></span>
    ${b('ul', 'ul', 'Bulleted list')}${b('ol', 'ol', 'Numbered list')}${b('quote', 'quote', 'Quote')}
    <span class="tb-div"></span>
    <button type="button" class="tb" data-act="ed-link" aria-label="Link" title="Link ⌘K in text">${ic('link')}</button>
    <button type="button" class="tb" data-act="ed-table" aria-label="Table" title="Table">${ic('table')}</button>
    <button type="button" class="tb" data-act="ed-image" aria-label="Image" title="Image">${ic('image')}</button>
    <button type="button" class="tb" data-act="ed-insert" aria-label="Insert: link files, link MoMs, journal table" title="Insert (or type /)">${ic('plus')}</button>
    <span class="tb-div"></span>
    ${b('removeFormat', 'clear', 'Clear formatting')}
  </div>`;
}

/* Keep the last selection inside the body, so menus can apply to it. */
document.addEventListener('selectionchange', () => {
  const s = getSelection();
  if (s.rangeCount && inBody(s.anchorNode)) ED.range = s.getRangeAt(0).cloneRange();
});
function restoreRange() {
  const s = getSelection();
  if (s.rangeCount && inBody(s.anchorNode)) return;
  if (ED.range) { s.removeAllRanges(); s.addRange(ED.range); }
}
const TEXT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];
on('text-menu', (d, el) => {
  const L = layer({
    cls: 'layer-menu', label: 'Typeface, size and colour',
    html: `<div class="text-menu">
      <div class="tm-cap">Typeface</div>
      <div class="seg tm-seg" role="group" aria-label="Typeface"><button type="button" data-act="tm-font" data-v="sans">Sans-serif</button><button type="button" data-act="tm-font" data-v="serif" style="font-family:${FONTS.serif}">Serif</button><button type="button" data-act="tm-font" data-v="mono" style="font-family:${FONTS.mono}">Mono</button></div>
      <div class="tm-cap">Size</div>
      <div class="tm-sizes" role="group" aria-label="Text size">${TEXT_SIZES.map(s => `<button type="button" class="tm-size" data-act="tm-size" data-v="${s}" aria-label="${s} pixels">${s}</button>`).join('')}</div>
      <div class="tm-cap">Text colour</div>
      <div class="swatch-row" role="group" aria-label="Text colour">${SWATCH_TEXT.map(c => `<button type="button" class="swatch" data-act="swatch-pick" data-kind="text" data-c="${c}" aria-label="Colour ${c}"><span style="background:${c}"></span></button>`).join('')}</div>
      <div class="tm-cap">Highlight</div>
      <div class="swatch-row" role="group" aria-label="Highlight">${SWATCH_HL.map(c => `<button type="button" class="swatch" data-act="swatch-pick" data-kind="hl" data-c="${c}" aria-label="Highlight ${c}"><span style="background:${c}"></span></button>`).join('')}<button type="button" class="swatch" data-act="swatch-pick" data-kind="hl" data-c="" aria-label="No highlight">${ic('x', 'sm')}</button></div>
    </div>`,
    onMount(panel) {
      if (isPhone()) return;
      const r = el.getBoundingClientRect();
      panel.style.top = (r.bottom + 8) + 'px';
      panel.style.left = Math.max(12, Math.min(r.left - 40, window.innerWidth - 340)) + 'px';
    },
  });
  return L;
});
on('tm-font', (d) => { closeAll(); restoreRange(); applySpanStyle({ fontFamily: FONTS[d.v] }); });
on('tm-size', (d) => { closeAll(); restoreRange(); applySpanStyle({ fontSize: d.v + 'px' }); });
on('align-menu', (d, el) => {
  menu(el, [
    { label: 'Align start', icon: 'al', act: 'ed', data: { cmd: 'alignStart' } },
    { label: 'Align centre', icon: 'ac', act: 'ed', data: { cmd: 'alignCenter' } },
    { label: 'Align end', icon: 'ar', act: 'ed', data: { cmd: 'alignEnd' } },
  ], 'Alignment');
});
on('pick-date', () => {
  const i = $('#edDate'); if (!i) return;
  try { i.showPicker(); } catch (e) { i.focus(); i.click(); }
});
const ROOT = () => $('#edBody');
const inBody = n => { const b = ROOT(); return !!(b && n && b.contains(n.nodeType === 1 ? n : n.parentNode)); };
function selElement() { const s = getSelection(); if (!s.rangeCount) return null; const n = s.anchorNode; return n && (n.nodeType === 1 ? n : n.parentElement); }

/* ---------- Commands ---------- */
on('ed', (d) => runCmd(d.cmd));
function focusBodyKeepingSelection() {
  const s = getSelection();
  const had = s.rangeCount && inBody(s.anchorNode);
  ROOT().focus({ preventScroll: true });
  if (!had && ED.range) { s.removeAllRanges(); s.addRange(ED.range); }
}
function runCmd(cmd) {
  focusBodyKeepingSelection();
  const exec = (c, v) => document.execCommand(c, false, v);
  const map = {
    undo: () => exec('undo'), redo: () => exec('redo'),
    bold: () => exec('bold'), italic: () => exec('italic'), underline: () => exec('underline'), strike: () => exec('strikeThrough'),
    alignStart: () => exec('justifyLeft'), alignCenter: () => exec('justifyCenter'), alignEnd: () => exec('justifyRight'),
    ul: () => exec('insertUnorderedList'), ol: () => exec('insertOrderedList'),
    quote: () => exec('formatBlock', 'blockquote'), removeFormat: () => { exec('removeFormat'); exec('unlink'); },
  };
  map[cmd] && map[cmd]();
  onEdInput();
  updateToolbar();
}
on('swatch', (d, el) => swatchMenu(el, d.kind));
on('ed-table', (d, el) => {
  const ctx = tableCtx();
  if (!ctx) { insertTable(3, 3); return; }
  if (!isPhone()) { updateTableBar(); return; }
  const op = (label, icon, o, danger = false) => ({ label, icon, act: 'table-op', data: { op: o }, danger });
  menu(el, [
    op('Row above', 'arrow-up', 'row-above'), op('Row below', 'arrow-down', 'row-below'),
    op('Move row up', 'arrow-up', 'row-up'), op('Move row down', 'arrow-down', 'row-down'),
    '-',
    op('Column left', 'arrow-left', 'col-left'), op('Column right', 'arrow-right', 'col-right'),
    op('Move column left', 'chev-r', 'col-move-left'), op('Move column right', 'chev-r', 'col-move-right'),
    '-',
    op('Long text column', 'text', 'toggle-longtext'),
    op('Delete row', 'trash', 'del-row', true), op('Delete column', 'trash', 'del-col', true), op('Delete table', 'trash', 'del-table', true),
  ], 'Table');
});
function swatchMenu(anchor, kind) {
  const list = kind === 'text' ? SWATCH_TEXT : SWATCH_HL;
  const sel = getSelection();
  const saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  const L = layer({
    cls: 'layer-menu', label: kind === 'text' ? 'Text colour' : 'Highlight',
    html: `<div class="swatch-row" style="padding:6px;width:260px" role="group" aria-label="${kind === 'text' ? 'Text colour' : 'Highlight'}">${list.map(c => `<button type="button" class="swatch" role="button" data-act="swatch-pick" data-kind="${kind}" data-c="${c}" aria-label="${c}"><span style="background:${c}"></span></button>`).join('')}<button type="button" class="swatch" data-act="swatch-pick" data-kind="${kind}" data-c="" aria-label="Clear ${kind === 'text' ? 'colour' : 'highlight'}" style="font-size:12px;font-weight:700">✕</button></div>`,
    onMount(panel) {
      if (isPhone()) return;
      const r = anchor.getBoundingClientRect();
      panel.style.top = (r.bottom + 6) + 'px';
      panel.style.left = Math.max(12, Math.min(r.left - 60, window.innerWidth - 280)) + 'px';
    },
  });
  L.saved = saved;
}
on('swatch-pick', (d) => {
  closeAll();
  focusBodyKeepingSelection();
  if (d.kind === 'text') document.execCommand('foreColor', false, d.c || 'inherit');
  else document.execCommand('hiliteColor', false, d.c || 'transparent') || document.execCommand('backColor', false, d.c || 'transparent');
  closeAll();
  onEdInput();
});
onInputEd();
function onInputEd() {
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.change === 'ed-block') {
      ROOT().focus({ preventScroll: true }); document.execCommand('formatBlock', false, el.value); onEdInput();
    }
    if (el.dataset.change === 'ed-font') {
      applySpanStyle({ fontFamily: FONTS[el.value] });
    }
    if (el.dataset.change === 'ed-size') {
      applySpanStyle({ fontSize: el.value + 'px' });
    }
    if (el.dataset.change === 'ed-date') {
      const m = mom(ED.id); if (m && el.value) { m.date = el.value; setStatus('saving'); scheduleSave(); render(); }
    }
  });
}
/* Wrap the selection in a styled span (typeface and size). */
function applySpanStyle(style) {
  const s = getSelection();
  if (!s.rangeCount || s.isCollapsed) { toast('Select some text first', { icon: 'info' }); return; }
  const range = s.getRangeAt(0);
  const span = document.createElement('span');
  Object.assign(span.style, style);
  try { range.surroundContents(span); } catch (e) { span.appendChild(range.extractContents()); range.insertNode(span); }
  onEdInput();
}

/* Active state (W2): reflect the current selection in the toolbar. */
function updateToolbar() {
  const bar = $('#edToolbar');
  if (!bar || bar.hidden || !inBody(getSelection().anchorNode)) return;
  const q = c => { try { return document.queryCommandState(c); } catch (e) { return false; } };
  const set = (cmd, on) => { const b = bar.querySelector(`[data-cmd="${cmd}"]`); if (b) b.setAttribute('aria-pressed', String(!!on)); };
  set('bold', q('bold')); set('italic', q('italic')); set('underline', q('underline')); set('strike', q('strikeThrough'));
  set('alignCenter', q('justifyCenter')); set('alignEnd', q('justifyRight')); set('alignStart', !q('justifyCenter') && !q('justifyRight'));
  set('ul', q('insertUnorderedList')); set('ol', q('insertOrderedList'));
  const el = selElement();
  const block = el && el.closest('h1,h2,h3,p,blockquote,li,div');
  const tag = block ? block.tagName.toLowerCase() : 'p';
  const sel = bar.querySelector('[data-change="ed-block"]');
  if (sel) sel.value = ['h1', 'h2', 'h3'].includes(tag) ? tag : 'p';
  set('quote', !!(el && el.closest('blockquote')));
  const alignBtn = $('#tbAlign');
  if (alignBtn) {
    const icon = q('justifyCenter') ? 'ac' : q('justifyRight') ? 'ar' : 'al';
    alignBtn.innerHTML = `${ic(icon)}${ic('chev-d', 'sm')}`;
    alignBtn.setAttribute('aria-pressed', String(icon !== 'al'));
  }
  updateTableBar();
}

/* ---------- Autosave (C2, C3) ---------- */
/* Save status (C2). The same pill appears in the desktop top bar and the phone head. */
function setStatus(kind) {
  const map = {
    saving: ['saving', 'loader', 'Saving…'],
    saved: ['', 'cloud-check', 'Saved'],
    local: ['local', 'cloud-off', 'Saved on this device'],
    failed: ['failed', 'alert', 'Couldn’t save'],
  };
  const [cls, icon, text] = map[kind];
  $$('.js-status').forEach(el => {
    el.className = 'status-pill js-status ' + cls;
    el.innerHTML = `${ic(icon, 'sm')}${text}${kind === 'failed' ? ' <button class="link-btn" style="min-height:32px;padding:0 8px" data-act="retry-save">Retry</button>' : ''}`;
  });
}
function onEdInput() {
  setStatus('saving');
  scheduleSave();
  if (ED.slash) {
    const t = ED.slash.block && ED.slash.block.textContent || '';
    if (!t.startsWith('/')) closeSlash();
    else { ED.slash.q = t.slice(1).trim(); ED.slash.idx = 0; drawSlash(); }
  }
}
function scheduleSave() {
  clearTimeout(ED.timer);
  ED.timer = setTimeout(() => saveNow(false), 800);
}
function saveNow(withToast) {
  clearTimeout(ED.timer);
  const m = mom(ED.id);
  if (!m || readOnly(m)) return;
  if (S.state === 'failure') { setStatus('failed'); return; }
  const body = ROOT();
  if (body) {
    m.body = body.innerHTML;
    const t = $('#edTitle'); if (t) m.title = t.textContent.trim() || 'Untitled meeting';
    if (m.journal) syncJournal(m);
  }
  if (S.state === 'offline') { setStatus('local'); return; }
  setStatus('saved');
  if (withToast) toast('Saved', { icon: 'check', ms: 2000 });
}
on('retry-save', () => { S.state = 'normal'; applyScenarioKeepSelection(); saveNow(true); });
function applyScenarioKeepSelection() { renderProto(); render(); }
KEYS.save = () => {
  const r = route();
  if (r.name === 'mom') saveNow(true);
  else if (r.name === 'area') toast('Nothing to save here', { icon: 'info' });
};
on('done', () => {
  const m = mom(ED.id);
  saveNow(false);
  if (m) go(`#/areas/${m.area}`); else go('#/today');
});

/* Keys inside the body: "/" menu, tables, Enter/Backspace in lists. */
function onEdKey(e) {
  if (ED.slash) {
    const items = slashItems();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ED.slash.idx = (ED.slash.idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1); drawSlash(); return; }
    if (e.key === 'Enter' && items.length) { e.preventDefault(); const pick = items[ED.slash.idx]; const d = { i: SLASH.indexOf(pick) }; ACT['slash-pick'](d); return; }
  }
  if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
    const el = selElement();
    const block = el && el.closest('p,div,h1,h2,h3,li,blockquote');
    if (block && !block.textContent.trim()) { setTimeout(() => openSlash(block), 0); }
  }
  if (e.key === 'Tab' && tableCtx()) {
    e.preventDefault();
    const { cell } = tableCtx();
    const cells = $$('td,th', cell.closest('table'));
    const i = cells.indexOf(cell);
    const next = cells[e.shiftKey ? i - 1 : i + 1];
    if (next) { placeCaret(next, true); updateTableBar(); } else if (!e.shiftKey) { addRow(cell.closest('table'), 'below'); }
  }
  if (e.key === 'Escape') { closeSlash(); }
}
function onEdClick(e) {
  const a = e.target.closest('a.ref');
  if (a) {
    e.preventDefault();
    if (a.dataset.mom) { saveNow(false); go(`#/mom/${a.dataset.mom}`); }
    else if (a.dataset.file) openFile(a.dataset.file);
    return;
  }
  const a2 = e.target.closest('a[href]');
  if (a2 && !a2.classList.contains('ref')) { /* normal link inside the body opens in a new tab */ a2.target = '_blank'; a2.rel = 'noopener'; }
  const img = e.target.closest('.img');
  if (img) { selectImage(img); return; }
  if (!e.target.closest('.img')) clearImageSel();
  updateTableBar();
  updateBubble();
}
function onEdMouseDown(e) { if (!e.target.closest('.img')) clearImageSel(); }

/* ---------- Bubble for selected text (W1) ---------- */
function updateBubble() {
  const bub = $('#bubble');
  if (!bub) return;
  const s = getSelection();
  if (isPhone() || !s.rangeCount || s.isCollapsed || !inBody(s.anchorNode) || document.activeElement !== ROOT()) { bub.hidden = true; return; }
  const rect = s.getRangeAt(0).getBoundingClientRect();
  const canvas = $('#edCanvas').getBoundingClientRect();
  bub.innerHTML = `<button type="button" class="tb" data-act="ed" data-cmd="bold" aria-label="Bold">${ic('bold')}</button><button type="button" class="tb" data-act="ed" data-cmd="italic" aria-label="Italic">${ic('italic')}</button><button type="button" class="tb" data-act="ed" data-cmd="underline" aria-label="Underline">${ic('underline')}</button><button type="button" class="tb" data-act="ed" data-cmd="strike" aria-label="Strikethrough">${ic('strike')}</button><span class="tb-div"></span><button type="button" class="tb" data-act="ed-link" aria-label="Link">${ic('link')}</button><button type="button" class="tb" data-act="ed" data-cmd="removeFormat" aria-label="Clear formatting">${ic('clear')}</button>`;
  bub.hidden = false;
  bub.style.left = (rect.left + rect.width / 2) + 'px';
  bub.style.top = (rect.top - 8) + 'px';
}
on('ed-link', () => {
  const s = getSelection();
  const saved = s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
  const existing = selElement() && selElement().closest('a');
  layer({
    label: 'Link', html: `<form data-form="ed-link" novalidate><div class="dlg-head"><div class="tt2"><h2>Add a link</h2><p>Turn the selected text into a web link.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="field" id="fLink"><label class="lab" for="lkIn">Web address</label><input class="input" id="lkIn" name="url" type="url" inputmode="url" placeholder="https://" value="${existing ? esc(existing.getAttribute('href')) : ''}"><span class="ferr" role="alert">Enter a web address that starts with https://</span></div>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="ed-unlink">Remove link</button><span class="left"></span><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Add link</button></div></form>`,
    onMount(panel, L) { L.saved = saved; },
  });
});
on('ed-unlink', () => { closeAll(); ROOT().focus({ preventScroll: true }); document.execCommand('unlink'); onEdInput(); });
onForm('ed-link', (f) => {
  const url = f.elements.url.value.trim();
  const L = LAYERS[LAYERS.length - 1];
  if (!/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(url)) { $('#fLink').classList.add('err'); return; }
  if (L && L.saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(L.saved); }
  closeAll();
  ROOT().focus({ preventScroll: true });
  document.execCommand('createLink', false, /^https?:/.test(url) ? url : 'https://' + url);
  onEdInput();
  toast('Link added', { icon: 'link' });
});

/* ---------- Slash menu ---------- */
const SLASH = [
  { t: 'Heading 1', k: 'h1', d: 'Large section heading', i: 'h', run: () => document.execCommand('formatBlock', false, 'h1') },
  { t: 'Heading 2', k: 'h2', d: 'Section heading', i: 'h', run: () => document.execCommand('formatBlock', false, 'h2') },
  { t: 'Bulleted list', k: 'list bullet', d: 'Simple list', i: 'ul', run: () => document.execCommand('insertUnorderedList') },
  { t: 'Numbered list', k: 'list number', d: 'Ordered steps', i: 'ol', run: () => document.execCommand('insertOrderedList') },
  { t: 'Quote', k: 'quote', d: 'Call out a line', i: 'quote', run: () => document.execCommand('formatBlock', false, 'blockquote') },
  { t: 'Table', k: 'table', d: '3 × 3 with a heading row', i: 'table', run: () => insertTable(3, 3) },
  { t: 'Prospect journal table', k: 'journal prospect remarks', d: 'Company, contact, stage, next step and Detailed Remarks', i: 'table', run: () => insertJournal() },
  { t: 'Image', k: 'image picture photo', d: 'From a web address, your device, or paste', i: 'image', run: () => openImageDialog() },
  { t: 'Link files', k: 'file link attach', d: 'Name workspace files in this MoM', i: 'sparkle', run: () => pickLinks('files') },
  { t: 'Link MoMs', k: 'mom meeting previous series', d: 'Link earlier meetings', i: 'doc', run: () => pickLinks('moms') },
];
function openSlash(block) {
  ED.slash = { block, q: '', idx: 0 };
  drawSlash();
  const el = $('#slash'); const rect = block.getBoundingClientRect(); const canvas = $('#edCanvas').getBoundingClientRect();
  el.hidden = false;
  el.style.left = Math.max(12, rect.left) + 'px';
  el.style.top = (rect.bottom + 6) + 'px';
}
function slashItems() { const q = (ED.slash && ED.slash.q || '').toLowerCase(); return SLASH.filter(x => !q || x.t.toLowerCase().includes(q) || x.k.includes(q)); }
function drawSlash() {
  const el = $('#slash'); const items = slashItems();
  el.innerHTML = `<div class="cap">Insert</div>` + (items.length ? items.map((x, i) => `<button type="button" role="option" aria-selected="${i === ED.slash.idx}" data-act="slash-pick" data-i="${SLASH.indexOf(x)}"><span class="si">${ic(x.i, 'sm')}</span><span><b>${x.t}</b><small>${x.d}</small></span></button>`).join('') : `<div class="noresult" style="padding:16px"><b>No matches</b>Try “table” or “list”.</div>`);
}
function closeSlash() { if (ED.slash) { ED.slash.block && ED.slash.block.textContent === '/' && (ED.slash.block.innerHTML = '<br>'); } ED.slash = null; const el = $('#slash'); if (el) el.hidden = true; }
on('slash-pick', (d) => {
  const sl = ED.slash; if (!sl) return;
  const block = sl.block;
  if (block && block.parentNode && block.textContent.trim().startsWith('/')) { block.textContent = ''; block.appendChild(document.createElement('br')); }
  const item = SLASH[Number(d.i)];
  closeSlash();
  placeCaretIn(block);
  item.run();
  onEdInput();
});
function placeCaretIn(el) { if (!el) return; ROOT().focus({ preventScroll: true }); const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
on('ed-insert', () => {
  const el = selElement();
  const block = el && el.closest('p,div,h1,h2,h3,li,blockquote') || ROOT();
  openSlash(block);
});

/* ---------- Tables (W3) ---------- */
function tableHTML(rows, cols, header = true, template = null) {
  const cell = (tag, txt) => `<${tag}>${txt || '<br>'}</${tag}>`;
  let html = `<table${template ? ` class="${template}" data-template="${template}"` : ''}><tbody>`;
  for (let r = 0; r < rows; r++) {
    html += '<tr>' + Array.from({ length: cols }, (_, c) => cell(header && r === 0 ? 'th' : 'td', header && r === 0 ? `Column ${c + 1}` : '')).join('') + '</tr>';
  }
  return html + '</tbody></table><p><br></p>';
}
function insertTable(rows, cols) {
  ROOT().focus({ preventScroll: true });
  document.execCommand('insertHTML', false, tableHTML(rows, cols));
  onEdInput();
  decorateTables();
}
function insertJournal() {
  ROOT().focus({ preventScroll: true });
  const row = `<tr><td data-label="Company"><br></td><td data-label="Contact"><br></td><td data-label="Stage"><br></td><td data-label="Next step"><br></td><td class="longtext" data-label="Detailed Remarks"><button type="button" class="remark" data-act="remarks-open"><span class="remark-text"><span class="remark-empty">Add remarks</span></span><span class="remark-open" aria-hidden="true">${ic('expand', 'sm')}</span></button></td></tr>`;
  const html = `<table class="journal" data-template="journal"><tbody><tr><th>Company</th><th>Contact</th><th>Stage</th><th>Next step</th><th class="is-longtext">Detailed Remarks <span class="coltype">Long text</span></th></tr>${row}</tbody></table><p><br></p>`;
  document.execCommand('insertHTML', false, html);
  onEdInput();
  decorateTables();
}
/* Column grips for resizing, and the header marks for long-text columns. */
function decorateTables() {
  $$('table', ROOT()).forEach(t => {
    t.style.tableLayout = 'fixed';
    $$('tr:first-child th', t).forEach(th => {
      if (th.querySelector('.colgrip')) return;
      const g = document.createElement('span');
      g.className = 'colgrip'; g.contentEditable = 'false'; g.setAttribute('aria-hidden', 'true');
      th.appendChild(g);
      // drag the edge to resize the column (W3)
      g.addEventListener('pointerdown', e => {
        e.preventDefault(); g.setPointerCapture(e.pointerId); g.classList.add('on');
        const col = th.cellIndex, startX = e.clientX, startW = th.getBoundingClientRect().width;
        const mv = ev => { const w = Math.max(60, startW + ev.clientX - startX); Array.from(t.rows).forEach(r => { if (r.cells[col]) r.cells[col].style.width = w + 'px'; }); };
        const up = () => { g.classList.remove('on'); g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); onEdInput(); };
        g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up);
      });
    });
  });
}
/* Tab in the last cell adds a row, like a spreadsheet. */
function addRow(table) {
  const last = table.rows[table.rows.length - 1];
  const tr = document.createElement('tr');
  Array.from(last.cells).forEach(c => {
    const n = document.createElement('td');
    if (c.classList.contains('longtext')) { n.className = 'longtext'; n.innerHTML = `<button type="button" class="remark" data-act="remarks-open"><span class="remark-text"><span class="remark-empty">Add remarks</span></span><span class="remark-open" aria-hidden="true">${ic('expand', 'sm')}</span></button>`; }
    else n.innerHTML = '<br>';
    if (c.dataset.label) n.dataset.label = c.dataset.label;
    tr.appendChild(n);
  });
  last.after(tr);
  placeCaret(tr.cells[0], true);
  onEdInput();
}
function tableCtx() {
  const el = selElement();
  const cell = el && el.closest('td,th');
  if (!cell || !inBody(cell)) return null;
  const table = cell.closest('table');
  return { cell, table, row: cell.parentElement, col: cell.cellIndex };
}
function longtextCols(table) {
  const head = table.rows[0];
  return Array.from(head.cells).map((c, i) => (c.classList.contains('is-longtext') ? i : -1)).filter(i => i > -1);
}
function updateTableBar() {
  const bar = $('#ttools'); if (!bar) return;
  const ctx = tableCtx();
  if (!ctx || isPhone()) { bar.hidden = true; return; }
  bar.hidden = false;
  const locked = ctx.table.dataset.template === 'journal';
  const ltCols = longtextCols(ctx.table);
  const ltHere = ctx.table.rows[0].cells[ctx.col] && ctx.table.rows[0].cells[ctx.col].classList.contains('is-longtext');
  const isHeaderRow = ctx.row === ctx.table.rows[0];
  const b = (op, icon, label, extra = '') => `<button type="button" class="tt${icon ? ' icon' : ''} ${extra}" data-act="table-op" data-op="${op}" aria-label="${label}" title="${label}">${icon ? ic(icon, 'sm') : label}</button>`;
  bar.querySelector('.tt-inner').innerHTML = `
    ${b('row-above', 'arrow-up', 'Row above')}${b('row-below', 'arrow-down', 'Row below')}${b('row-up', 'arrow-up', 'Move row up')}${b('row-down', 'arrow-down', 'Move row down')}
    <span class="tt-sep"></span>
    ${b('col-left', 'arrow-left', 'Column left')}${b('col-right', 'arrow-right', 'Column right')}
    <span class="tt-sep"></span>
    ${locked && ltHere ? '' : b('col-move-left', 'chev-r', 'Move column left', '')}
    ${locked && ltHere ? '' : b('col-move-right', 'chev-r', 'Move column right', '')}
    <span class="tt-sep"></span>
    ${b('toggle-longtext', 'text', ltHere ? 'Make text' : 'Long text column', ltHere ? 'on' : '')}
    <span class="tt-sep"></span>
    ${locked && (ltHere) ? '' : b('del-col', 'trash', 'Delete column', 'danger')}
    ${isHeaderRow ? '' : b('del-row', 'trash', 'Delete row', 'danger')}
    ${b('del-table', 'trash', 'Delete table', 'danger')}`;
  // position above the table, inside the canvas
  const canvas = $('#edCanvas').getBoundingClientRect();
  const t = ctx.table.getBoundingClientRect();
  bar.style.top = (t.top - canvas.top - 56) + 'px';
}
on('table-op', (d) => {
  const ctx = tableCtx(); if (!ctx) return;
  const { cell, table, row, col } = ctx;
  const isJournal = table.dataset.template === 'journal';
  const lts = longtextCols(table);
  const isLT = lts.includes(col);
  const rowsArr = Array.from(table.rows);
  const newRow = (from) => { const tr = document.createElement('tr'); Array.from(from.cells).forEach(c => { const n = document.createElement(c.tagName.toLowerCase() === 'th' ? 'td' : c.tagName.toLowerCase()); n.innerHTML = '<br>'; if (c.classList.contains('longtext')) { n.className = 'longtext'; n.innerHTML = '<button type="button" class="remark" data-act="remarks-open"><span class="remark-text"><span class="remark-empty">Add remarks</span></span><span class="remark-open" aria-hidden="true">' + ic('expand', 'sm') + '</span></button>'; } tr.appendChild(n); }); return tr; };
  switch (d.op) {
    case 'row-above': row.before(newRow(row)); break;
    case 'row-below': row.after(newRow(row)); break;
    case 'row-up': if (row.previousElementSibling && row !== table.rows[0] && row.previousElementSibling !== table.rows[0]) row.previousElementSibling.before(row); break;
    case 'row-down': if (row.nextElementSibling) row.nextElementSibling.after(row); break;
    case 'col-left': case 'col-right': {
      const at = d.op === 'col-left' ? col : col + 1;
      rowsArr.forEach((r, ri) => { const ref = r.cells[at] || null; const tag = r === table.rows[0] ? 'th' : 'td'; const n = document.createElement(tag); n.innerHTML = tag === 'th' ? 'Column' : '<br>'; r.insertBefore(n, ref); });
      break;
    }
    case 'col-move-left': case 'col-move-right': {
      if (isJournal && isLT) { toast('The Detailed Remarks column stays where it is.', { icon: 'lock', tone: 'warn' }); break; }
      const to = d.op === 'col-move-left' ? col - 1 : col + 1;
      if (to < 0 || to >= rowsArr[0].cells.length) break;
      rowsArr.forEach(r => { const a = r.cells[col], b = r.cells[to]; if (d.op === 'col-move-left') r.cells[to].before(a); else r.cells[to].after(a); });
      break;
    }
    case 'toggle-longtext': {
      if (isJournal && isLT) { toast('Detailed Remarks is part of the Prospect journal and stays long text.', { icon: 'lock', tone: 'warn' }); break; }
      const head = table.rows[0].cells[col];
      const on = !isLT;
      head.classList.toggle('is-longtext', on);
      head.querySelector('.coltype') && head.querySelector('.coltype').remove();
      if (on) head.insertAdjacentHTML('beforeend', ' <span class="coltype">Long text</span>');
      rowsArr.slice(1).forEach(r => {
        const c = r.cells[col]; if (!c) return;
        if (on) { const txt = c.textContent.trim(); c.className = 'longtext'; c.innerHTML = `<button type="button" class="remark" data-act="remarks-open"><span class="remark-text">${txt ? esc(txt) : '<span class="remark-empty">Add remarks</span>'}</span><span class="remark-open" aria-hidden="true">${ic('expand', 'sm')}</span></button>`; }
        else { const txt = c.querySelector('.remark-text') ? c.querySelector('.remark-text').textContent : ''; c.className = ''; c.innerHTML = txt && txt !== 'Add remarks' ? esc(txt) : '<br>'; }
      });
      toast(on ? 'Column set to Long text. Tap a cell to write in it.' : 'Column is plain text again', { icon: 'text' });
      break;
    }
    case 'del-row': if (row !== table.rows[0]) row.remove(); break;
    case 'del-col': {
      if (isJournal && isLT) { toast('Detailed Remarks can’t be deleted from the Prospect journal.', { icon: 'lock', tone: 'warn' }); break; }
      if (rowsArr[0].cells.length <= 1) break;
      rowsArr.forEach(r => r.cells[col] && r.cells[col].remove());
      break;
    }
    case 'del-table': {
      const parent = table.parentNode, next = table.nextSibling, html = table.outerHTML;
      table.remove();
      $('#ttools').hidden = true;
      toast('Table deleted', { icon: 'trash', action: { label: 'Undo', act: 'undo-table', data: { html: '' } } });
      UNDO['tbl'] = () => { const tmp = document.createElement('div'); tmp.innerHTML = html; const t = tmp.firstElementChild; parent.insertBefore(t, next); decorateTables(); onEdInput(); };
      onEdInput();
      return;
    }
  }
  decorateTables();
  onEdInput();
  updateTableBar();
});
on('undo-table', () => { const f = UNDO.tbl; if (f) { f(); delete UNDO.tbl; } });
on('new-entry', () => {
  const t = $('#edBody table.journal'); if (!t) return;
  const tr = t.rows[t.rows.length - 1].cloneNode(true);
  tr.querySelectorAll('td').forEach((td, i) => { if (td.classList.contains('longtext')) return; td.innerHTML = '<br>'; });
  t.tBodies[0].appendChild(tr);
  tr.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
  placeCaret(tr.cells[0], true);
  DB.journal.push(['', '', '', '', '']);
  onEdInput();
  decorateTables();
});
function syncJournal(m) {
  const t = $('#edBody table.journal'); if (!t) return;
  const rows = Array.from(t.rows).slice(1).map(tr => {
    const c = Array.from(tr.cells);
    const rt = tr.querySelector('.remark-text');
    return [c[0].textContent.trim(), c[1].textContent.trim(), c[2].textContent.trim(), c[3].textContent.trim(), rt ? rt.textContent.trim().replace(/^Add remarks$/, '') : (c[4] ? c[4].textContent.trim() : '')];
  });
  DB.journal = rows;
}

/* ---------- Detailed Remarks and Long text (W8, P-1) ---------- */
on('remarks-open', (d, el) => {
  const cell = el.closest('td');
  ED.remarkCell = cell;
  const table = cell.closest('table');
  const tr = cell.parentElement;
  const isJournal = table.dataset.template === 'journal';
  const label = table.rows[0].cells[cell.cellIndex] ? table.rows[0].cells[cell.cellIndex].textContent.replace(/Long text/, '').trim() : 'Detailed Remarks';
  const text = (cell.querySelector('.remark-text') || cell).textContent.replace(/^Add remarks$/, '').trim();
  const cells = Array.from(tr.cells);
  const field = (i, lab) => `<div class="field" style="margin:0"><label class="lab" style="margin-bottom:6px" for="rf${i}">${lab}</label><input class="input" id="rf${i}" data-input="remark-field" data-i="${i}" value="${esc(cells[i] ? cells[i].textContent.trim() : '')}" autocomplete="off"></div>`;
  layer({
    cls: 'layer-drawer', label: 'Detailed Remarks',
    html: `<div class="rm-head"><div class="top"><button class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button><span class="spacer"></span><span class="status-pill" id="rmStatus">${ic('cloud-check', 'sm')}Saved</span></div>
      <h2>${isJournal ? esc(cells[0] ? cells[0].textContent.trim() || 'New company' : 'Prospect') : esc(label || 'Long text')}</h2>
      ${isJournal ? `<div class="sub">${cells[2] ? `<span class="pill-role">${esc(cells[2].textContent.trim())}</span>` : ''} ${cells[3] && cells[3].textContent.trim() ? `<span class="muted">Next: ${esc(cells[3].textContent.trim())}</span>` : ''}</div>` : ''}</div>
      <div class="rm-body"><label class="lab" for="rmText">Detailed remarks</label><textarea id="rmText" data-input="remark-text" autofocus placeholder="Write as much context as you need. It saves as you type.">${esc(text)}</textarea></div>
      ${isJournal ? `<div class="rm-fields" aria-label="Entry details"><p class="rm-cap">Entry details</p>${field(0, 'Company')}${field(1, 'Contact')}${field(2, 'Stage')}${field(3, 'Next step')}</div>` : ''}
      <div class="rm-foot"><span class="muted" style="font-size:13px">Saves as you type</span><span class="spacer"></span><button class="btn btn-primary" data-act="close">Done</button></div>`,
    onMount(panel) { ED.remarkTable = table; },
  });
});
function remarkSync() {
  const cell = ED.remarkCell; if (!cell) return;
  const text = $('#rmText') ? $('#rmText').value : '';
  const span = cell.querySelector('.remark-text');
  if (span) span.innerHTML = text ? esc(text) : '<span class="remark-empty">Add remarks</span>';
  const tr = cell.parentElement;
  const table = cell.closest('table');
  if (table && table.dataset.template === 'journal') {
    const i = Array.from(table.rows).indexOf(tr) - 1;
    if (DB.journal[i]) DB.journal[i][4] = text;
  }
}
on('remark-autosave', () => {});
onInput('remark-text', (el) => {
  const st = $('#rmStatus'); if (st) { st.className = 'status-pill saving'; st.innerHTML = `${ic('loader', 'sm')}Saving…`; }
  clearTimeout(ED.remarkTimer);
  ED.remarkTimer = setTimeout(() => {
    remarkSync();
    if (st) { st.className = 'status-pill'; st.innerHTML = `${ic('cloud-check', 'sm')}Saved`; }
    onEdInput();
  }, 500);
});
onInput('remark-field', (el) => {
  const cell = ED.remarkCell; if (!cell) return;
  const tr = cell.parentElement;
  const td = tr.cells[Number(el.dataset.i)];
  if (td) td.textContent = el.value;
  const table = cell.closest('table');
  if (table && table.dataset.template === 'journal') {
    const i = Array.from(table.rows).indexOf(tr) - 1;
    if (DB.journal[i]) DB.journal[i][Number(el.dataset.i)] = el.value;
  }
  onEdInput();
});

/* ---------- Images (W4) ---------- */
function openImageDialog() {
  layer({
    label: 'Add an image',
    html: `<div class="dlg-head"><div class="tt2"><h2>Add an image</h2><p>Place it in the MoM. You can resize it and float it anywhere over the note.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <form data-form="img-url" novalidate><div class="field" id="fImg"><label class="lab" for="imgUrl">From a web address</label><input class="input" id="imgUrl" name="url" type="url" placeholder="https://" inputmode="url"><span class="ferr" role="alert">Enter a web address for the image.</span></div>
        <div class="dlg-foot" style="margin-top:6px"><button type="button" class="btn btn-soft" data-act="img-device">${ic('upload', 'sm')}From your device</button><span class="left"></span><button class="btn btn-primary" type="submit">Add image</button></div></form>`,
  });
}
on('ed-image', () => openImageDialog());
on('img-device', () => { ED.imgMode = 'device'; $('#fileInput').click(); });
onForm('img-url', (f) => {
  const url = f.elements.url.value.trim();
  if (!url) { $('#fImg').classList.add('err'); return; }
  closeAll();
  insertImage(url);
});
function insertImage(src, { file = null } = {}) {
  ROOT().focus({ preventScroll: true });
  const id = nid('img');
  const ph = document.createElement('div');
  ph.className = 'img-loading'; ph.contentEditable = 'false'; ph.id = id;
  ph.innerHTML = `${ic('loader')}<span>Uploading image… <b class="pct">0%</b></span>`;
  const sel = getSelection();
  if (sel.rangeCount && inBody(sel.anchorNode)) { const r = sel.getRangeAt(0); r.insertNode(ph); r.setStartAfter(ph); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
  else ROOT().appendChild(ph);
  const failing = S.state === 'failure';
  let p = 0;
  const tick = setInterval(() => {
    p = Math.min(100, p + 20);
    const pct = ph.querySelector('.pct'); if (pct) pct.textContent = p + '%';
    if (p >= 100) {
      clearInterval(tick);
      if (failing) { ph.innerHTML = `${ic('alert')}<span>Couldn’t add this image. Check your connection, then try again.</span><button class="link-btn" data-act="img-retry" data-id="${id}" data-src="${esc(src)}">Retry</button>`; ph.classList.add('failed'); return; }
      const wrap = document.createElement('div');
      wrap.className = 'img inline'; wrap.contentEditable = 'false'; wrap.dataset.w = '46';
      wrap.style.setProperty('--w', '100%');
      wrap.innerHTML = `<img src="${esc(src)}" alt=""><span class="grip" aria-hidden="true"></span><span class="move-handle" aria-hidden="true">${ic('drag', 'sm')}Drag</span>`;
      ph.replaceWith(wrap);
      onEdInput();
    }
  }, reduceMotion() ? 10 : 260);
}
on('img-retry', (d, el) => { const ph = el.closest('.img-loading'); if (ph) ph.remove(); S.state = 'normal'; applyScenarioKeepSelection(); insertImage(d.src); });
function onEdPaste(e) {
  const f = Array.from(e.clipboardData && e.clipboardData.files || []).find(x => x.type.startsWith('image/'));
  if (!f) return;
  e.preventDefault();
  insertImage(URL.createObjectURL(f));
}
function selectImage(img) {
  clearImageSel();
  img.classList.add('is-sel');
  ED.img = img;
  if (!img.querySelector('.grip')) return;
  ensureImageControls(img);
  if (!isPhone()) {
    const bub = $('#bubble');
    const r = img.getBoundingClientRect();
    bub.innerHTML = `<button type="button" class="tt" data-act="img-mode" data-mode="inline" aria-pressed="${img.classList.contains('inline')}">${ic('inline', 'sm')}Inline</button><button type="button" class="tt" data-act="img-mode" data-mode="float" aria-pressed="${img.classList.contains('floating')}">${ic('layout', 'sm')}Float</button><span class="tb-div"></span><button type="button" class="tb" data-act="img-remove" aria-label="Remove image">${ic('trash')}</button>`;
    bub.hidden = false; bub.style.left = (r.left + r.width / 2) + 'px'; bub.style.top = (r.top - 8) + 'px';
  }
}
function ensureImageControls(img) {
  if (img.dataset.ready) return;
  img.dataset.ready = '1';
  const grip = img.querySelector('.grip');
  grip.addEventListener('pointerdown', e => {
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    const startX = e.clientX, startW = img.getBoundingClientRect().width, body = ROOT().getBoundingClientRect().width;
    const move = ev => { const w = Math.max(120, Math.min(body, startW + (ev.clientX - startX))); img.style.setProperty('--w', (img.classList.contains('floating') ? w : w / body * 100) + (img.classList.contains('floating') ? 'px' : '%')); };
    const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); onEdInput(); };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
  });
  const handle = img.querySelector('.move-handle');
  handle.addEventListener('pointerdown', e => {
    if (!img.classList.contains('floating')) return;
    e.preventDefault(); handle.setPointerCapture(e.pointerId);
    const body = ROOT().getBoundingClientRect();
    const r0 = img.getBoundingClientRect();
    const ox = e.clientX - r0.left, oy = e.clientY - r0.top;
    img.classList.add('is-dragging');
    const move = ev => { img.style.left = (ev.clientX - body.left - ox) + 'px'; img.style.top = (ev.clientY - body.top - oy) + 'px'; };
    const up = () => { img.classList.remove('is-dragging'); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); onEdInput(); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up);
  });
}
on('img-mode', (d) => {
  const img = ED.img; if (!img) return;
  if (d.mode === 'float') { img.classList.remove('inline'); img.classList.add('floating'); img.style.position = 'absolute'; img.style.left = '24px'; img.style.top = '24px'; img.style.setProperty('--w', '46%'); }
  else { img.classList.remove('floating'); img.classList.add('inline'); img.style.position = ''; img.style.left = ''; img.style.top = ''; img.style.setProperty('--w', '100%'); }
  selectImage(img);
  onEdInput();
});
on('img-remove', () => { const img = ED.img; if (img) img.remove(); ED.img = null; $('#bubble').hidden = true; onEdInput(); });
function clearImageSel() { $$('.img.is-sel', ROOT() || document).forEach(i => i.classList.remove('is-sel')); ED.img = null; const b = $('#bubble'); if (b && !b.querySelector('.tb')) b.hidden = true; }

/* ---------- Links to files and MoMs (W6, W7) ---------- */
function pickLinks(kind) {
  const isFiles = kind === 'files';
  const items = isFiles
    ? DB.files.filter(f => canSee(f.area) && !lockedFile(f)).map(f => ({ id: f.id, label: f.name, sub: `${area(f.area).name}${f.group ? ' · ' + group(f.group).name : ''}`, ico: KINDS[f.kind].icon, key: 'f' }))
    : DB.moms.filter(m => canSee(m.area) && !hiddenItem('m', m) && m.id !== ED.id).sort((a, b) => b.date.localeCompare(a.date)).map(m => ({ id: m.id, label: m.title, sub: `${area(m.area).name} · ${fmtDate(m.date)}`, ico: 'doc', key: 'm' }));
  const selected = new Set();
  const rowsHTML = (q) => {
    const t = q.trim().toLowerCase();
    const list = items.filter(x => !t || x.label.toLowerCase().includes(t) || x.sub.toLowerCase().includes(t));
    if (!items.length) return `<div class="empty small"><div class="art">${ic(isFiles ? 'upload' : 'doc')}</div><h3>Nothing yet</h3><p>${isFiles ? 'Upload a file or save a link first.' : 'Meetings you write will show here, newest first.'}</p></div>`;
    if (!list.length) return `<div class="noresult"><b>No matches for “${esc(q)}”</b>Try another name.</div>`;
    return list.map(x => `<button type="button" class="dest" role="option" aria-selected="${selected.has(x.id)}" data-act="link-pick" data-id="${x.id}"><span class="gi" style="width:26px;display:grid;place-items:center;color:var(--accent-strong)">${ic(x.ico, 'sm')}</span><span class="mid"><b>${esc(x.label)}</b><small>${esc(x.sub)}</small></span>${selected.has(x.id) ? ic('check', 'sm') : ''}</button>`).join('');
  };
  layer({
    label: isFiles ? 'Link files' : 'Link MoMs',
    html: `<div class="dlg-head"><div class="tt2"><h2>${isFiles ? 'Link workspace files' : 'Link earlier MoMs'}</h2><p>${isFiles ? 'Pick several at once. Each becomes a named link.' : 'Newest first, with area and date. Opening a link saves this MoM first.'}</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="dest-search">${ic('search', 'sm')}<input class="input" id="lkSearch" type="search" placeholder="Search by name" autocomplete="off" aria-label="Search"></div>
      <div class="dests" id="lkList" role="listbox" aria-multiselectable="true">${rowsHTML('')}</div>
      <div class="dlg-foot"><button class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" id="lkGo" disabled>Insert links</button></div>`,
    onMount(panel) {
      const list = panel.querySelector('#lkList'), go2 = panel.querySelector('#lkGo'), q = panel.querySelector('#lkSearch');
      const refresh = () => { list.innerHTML = rowsHTML(q.value); go2.disabled = selected.size === 0; go2.textContent = selected.size ? `Insert ${selected.size} link${selected.size === 1 ? '' : 's'}` : 'Insert links'; };
      list.addEventListener('click', e => { const b = e.target.closest('[data-act="link-pick"]'); if (!b) return; selected.has(b.dataset.id) ? selected.delete(b.dataset.id) : selected.add(b.dataset.id); refresh(); });
      q.addEventListener('input', refresh);
      go2.addEventListener('click', () => {
        const parts = [...selected].map(id => { const x = items.find(i => i.id === id); return isFiles ? `<a class="ref" data-file="${id}" href="#/areas/${file(id).area}" contenteditable="false">${ic(x.ico, 'sm')}${esc(x.label)}</a>` : `<a class="ref mom" data-mom="${id}" href="#/mom/${id}" contenteditable="false">${ic('doc', 'sm')}${esc(x.label)}</a>`; });
        closeAll();
        ROOT().focus({ preventScroll: true });
        document.execCommand('insertHTML', false, parts.join(' ') + '&nbsp;');
        onEdInput();
        toast(`Inserted ${parts.length} link${parts.length === 1 ? '' : 's'}`, { icon: 'link' });
      });
      refresh();
    },
  });
}
on('link-pick', () => {});

/* ---------- Tags, document link, editor menu (C4, C5, O5, O6, P7, W9) ---------- */
function bindTagInput(m) {
  const input = $('#edTag'); if (!input) return;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      m.tags.push(input.value.trim().toLowerCase().replace(/^#/, ''));
      toast(`Tag added: #${input.value.trim()}`, { icon: 'tag' });
      render();
    }
  });
}
on('tag-remove', (d) => { const m = mom(ED.id); if (!m) return; m.tags = m.tags.filter(t => t !== d.t); render(); });
on('doc-attach', () => {
  const m = mom(ED.id);
  layer({
    label: 'Attach a document', html: `<form data-form="doc" novalidate><div class="dlg-head"><div class="tt2"><h2>Attach a document</h2><p>Link the Google Doc or other document this meeting belongs to.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="field"><label class="lab" for="docLab">Name</label><input class="input" id="docLab" name="label" value="${esc(m.title)} notes" autocomplete="off"></div>
      <div class="field" id="fDoc"><label class="lab" for="docUrl">Address</label><input class="input" id="docUrl" name="url" placeholder="docs.google.com/…" inputmode="url"><span class="ferr" role="alert">Paste the document’s address.</span></div>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Attach</button></div></form>`,
  });
});
onForm('doc', (f) => {
  const url = f.elements.url.value.trim();
  if (!url) { $('#fDoc').classList.add('err'); return; }
  const m = mom(ED.id);
  m.doc = { label: f.elements.label.value.trim() || 'Document', url: url.replace(/^https?:\/\//, '') };
  closeAll(); toast('Document attached', { icon: 'link' }); render();
});
on('editor-menu', (d, el) => {
  const m = mom(d.id);
  const ro = readOnly(m);
  menu(el, [
    { label: 'Export as A4 PDF', icon: 'export', act: 'export-pdf', data: { id: m.id } },
    { label: m.doc ? 'Change document link' : 'Attach a document', icon: 'link', act: 'doc-attach', data: { id: m.id }, note: ro ? 'Final' : '' },
    '-',
    { label: m.flagged ? 'Unflag' : 'Flag as important', icon: m.flagged ? 'flag' : 'flag-fill', act: 'flag', data: { kind: 'm', id: m.id } },
    { label: 'Rename', icon: 'pencil', act: ro ? 'blocked-final' : 'rename', data: { kind: 'mom', id: m.id } },
    { label: 'Move to…', icon: 'move', act: ro ? 'blocked-final' : 'move-item', data: { kind: 'm', id: m.id } },
    { label: isFinal(m) ? 'Unmark final' : 'Mark as final', icon: 'lock', act: 'final', data: { kind: 'm', id: m.id }, admin: { k: 'final', label: 'mark MoMs as final' } },
    { label: 'Share a link', icon: 'share', act: 'share', data: { kind: 'm', id: m.id }, admin: { k: 'shareLinks', label: 'share links' } },
    '-',
    { label: 'Delete', icon: 'trash', act: 'delete-item', data: { kind: 'm', id: m.id }, danger: true, admin: { k: 'deleteItem', label: 'delete MoMs' } },
  ], 'MoM');
});
on('blocked-final', () => toast('This is marked final, so it can’t be changed.', { icon: 'lock', tone: 'warn' }));

/* A4 export (W9): named after the title, with date, tags and an export stamp. */
on('export-pdf', (d) => {
  const m = mom(d.id || ED.id);
  if (!m) return;
  saveNow(false);
  const a = area(m.area);
  const stamp = `Exported ${fmtDate(TODAY_ISO)}`;
  layer({
    label: 'Export as PDF', cls: 'layer-lightbox',
    html: `<div style="background:var(--surface);border-radius:var(--r-2xl);padding:22px;width:min(640px,100%)" class="print-area">
      <div class="dlg-head" style="margin-bottom:12px"><div class="tt2"><h2>Export as A4 PDF</h2><p>Named “${esc(m.title)}.pdf”. Preview below, then print or save as PDF.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="a4-wrap"><div class="print-root"><article class="a4" aria-label="Preview">
        <h1>${esc(m.title)}</h1>
        <div class="meta">${esc(a.name)} · ${fmtDate(m.date)}${m.tags.length ? ' · ' + m.tags.map(t => '#' + esc(t)).join(' ') : ''}</div>
        <div class="body">${m.body || '<p>No notes yet.</p>'}</div>
        <div class="a4-foot">${stamp}</div>
      </article></div></div>
      <div class="dlg-foot"><button class="btn btn-soft" data-act="close">Close</button><button class="btn btn-primary" data-act="print-now">${ic('export', 'sm')}Print or save as PDF</button></div></div>`,
  });
});
/* The browser names the PDF after the page title, so it briefly becomes the MoM's title. */
on('print-now', () => {
  const m = mom(ED.id);
  const before = document.title;
  if (m) document.title = m.title;
  window.print();
  document.title = before;
});

/* Remote edits (S2): someone else saved while this MoM is open. */
function showRemote(m) {
  const host = $('#remoteHost'); if (!host || S.remoteDone) return;
  host.innerHTML = `<div class="remote-bar" role="status">${ic('users', 'sm')}<span>Priya saved changes to this MoM</span><span class="spacer"></span><button data-act="apply-remote">Show changes</button></div>`;
}
on('apply-remote', () => {
  const m = mom(ED.id); if (!m) return;
  const body = ROOT();
  const li = document.createElement('li'); li.textContent = 'Confirm split order with Rotterdam: done (Ana)';
  const ul = body.querySelector('ul');
  if (ul) ul.appendChild(li); else body.insertAdjacentHTML('beforeend', '<ul><li>Confirm split order with Rotterdam: done (Ana)</li></ul>');
  S.remoteDone = true;
  $('#remoteHost').innerHTML = '';
  onEdInput();
  toast('Updated with Priya’s changes. Your place is kept.', { icon: 'cloud-check' });
});
function scheduleRemote() {
  S.remoteDone = false;
  setTimeout(() => {
    if (S.state !== 'remote' || DB.files.some(f => f.id === 'f-live')) return;
    DB.files.push({ id: 'f-live', name: 'Supplier quotes.pdf', kind: 'pdf', size: 1.1e6, date: TODAY_ISO, area: 'verdant', group: 'g-contracts', note: 'Three quotes compared' });
    DB.activity.unshift({ t: 'file', id: 'f-live', who: 'Ana Ruiz', ini: 'AR', cls: 'b', when: 'Just now' });
    toast('Ana added “Supplier quotes.pdf” to Verdant Foods', { icon: 'users' });
    const r = route();
    if (r.name === 'mom') renderShell(r); else render();
  }, 2500);
}
function scheduleCatchup() { /* the catching-up banner stays until the state changes */ }
