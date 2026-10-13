/* Files (F9, F10, F14, C6 in part): Save a link (W5 is the editor's). The Upload dialog comes with
   its own task. Opening, downloading and copying a file live in area.js. */
'use strict';

/* The kind a saved link is stored under (the old app's `type` names). */
const LINK_TYPE = { link: 'link', slides: 'presentation', pdf: 'pdf', sheet: 'spreadsheet', image: 'image', other: 'other' };
/* An address as typed, with https:// added when it has no scheme. */
const normalizeUrl = raw => (/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
const looksLikeUrl = raw => /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(raw);

/* Where a new file goes: the place chosen in this dialog (its grouping must hold files). */
function linkPlace(p) { return { area: p.area, group: groupFor(p, 'file') || null, gkind: 'file' }; }

function openLink(d = {}) {
  const p = d.area ? { area: d.area, group: d.group || null, gkind: 'file' } : createPlace(route());
  if (!p || !p.area) { toast('Create an area first, then save links to it.', { icon: 'alert', tone: 'warn' }); return; }
  const kind = d.kind || guessKind(d.address || '');
  const L = UI.linkDialog = layer({
    label: 'Save a link',
    html: `<form data-form="link" novalidate>${dialogHTML({
      title: 'Save a link', text: 'Keep online material next to your uploads.',
      body: fieldHTML({ id: 'lkAddr', label: 'Address', required: true, control: inputHTML({ id: 'lkAddr', name: 'address', inputmode: 'url', placeholder: 'https://…', value: d.address || '' }).replace('<input class="input"', '<input class="input" data-input="link-addr"') })
        + fieldHTML({ id: 'lkName', label: 'Name', required: true, control: inputHTML({ id: 'lkName', name: 'name', placeholder: 'What is it?', value: d.name || '' }) })
        + kindTilesHTML({ selected: kind }).replace('<div class="field">', '<div class="field" id="kind-field">')
        + `<input type="hidden" name="kind" value="${esc(kind)}">`
        + fieldHTML({ id: 'lkNote', label: 'Note', note: 'optional', control: inputHTML({ id: 'lkNote', name: 'note' }) })
        + `<div class="current"><span>Adds to</span><b id="lkPlace">${esc(placeName(p))}</b><span class="spacer"></span>${btnHTML({ kind: 'link', label: 'Change', act: 'pick-link-dest' })}</div>`,
      foot: btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + btnHTML({ kind: 'primary', label: 'Save link', type: 'submit' }),
    })}</form>`,
    onMount(panel, dialog) { dialog.place = linkPlace(p); },
    onClose() { if (UI.linkDialog === L) UI.linkDialog = null; },
  });
}
on('save-link', d => openLink(d));
on('pick-kind', (d, el) => {
  const f = el.closest('form'); if (!f) return;
  f.querySelectorAll('[role=radio]').forEach(b => b.setAttribute('aria-checked', String(b === el)));
  f.elements.kind.value = d.k;
  f.dataset.kindPicked = '1';   // a chosen kind is kept; the address no longer changes it
});
/* While the address is typed, the kind follows it (until someone picks a kind). */
onInput('link-addr', el => {
  const f = el.closest('form'); if (!f || f.dataset.kindPicked) return;
  const k = guessKind(el.value);
  f.querySelectorAll('[role=radio]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.k === k)));
  f.elements.kind.value = k;
});
on('pick-link-dest', () => {
  const L = UI.linkDialog; if (!L) return;
  destPicker({
    title: 'Save to', current: L.place, type: 'place', itemKind: 'file', cta: 'Use this place',
    onPick: p => { L.place = linkPlace(p); const el = $('#lkPlace'); if (el) el.textContent = placeName(p); },
  });
});
onForm('link', f => {
  const raw = f.elements.address.value.trim(), name = f.elements.name.value.trim();
  if (!raw) { fieldError(f, 'lkAddr', 'Paste the address first.'); return; }
  if (!looksLikeUrl(raw)) { fieldError(f, 'lkAddr', 'Enter a web address, such as https://example.com.'); return; }
  if (!name) { fieldError(f, 'lkName', 'Give the link a name so you can find it later.'); return; }
  const L = UI.linkDialog || {};
  const place = L.place || linkPlace(createPlace(route()) || {});
  if (!place.area) { fieldError(f, 'lkAddr', 'Choose where it goes first.'); return; }
  const kind = f.elements.kind.value in LINK_TYPE ? f.elements.kind.value : 'link';
  const doc = { id: newId(), folderId: place.area, name, type: LINK_TYPE[kind], url: normalizeUrl(raw), note: f.elements.note.value.trim(), added: Date.now() };
  if (place.group) doc.docFolderId = place.group;
  const who = signedInUser();
  if (who) doc.createdBy = { uid: who.uid, name: currentUser().name };
  sD(doc).then(() => {}, () => toast('Couldn’t save the link. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
  closeAll();
  toast(`Saved link “${name}”`, { icon: 'link' });
});

/* ---------- Upload (C6, C8) ---------- */
const MAX_MB_PDF = 10;   // the storage plan fails above roughly 10 MB for PDFs (CLAUDE.md known issue)
const BLOCKED_EXT = ['exe', 'bat', 'msi'];
const UPLOAD = { cur: null };
const extOf = name => (String(name).split('.').pop() || '').toLowerCase();
/* The design's kind for a file name, to pick its tile while it uploads. */
function kindOfName(name) {
  const e = extOf(name);
  if (e === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'bmp', 'tiff', 'ico'].includes(e)) return 'image';
  if (['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'].includes(e)) return 'video';
  if (['xlsx', 'xls', 'csv', 'numbers'].includes(e)) return 'sheet';
  if (['pptx', 'ppt', 'key'].includes(e)) return 'slides';
  return 'other';
}
/* The four reasons an upload can't go through, each with a way forward. fix: 'link' = Save as link
   instead, 'retry' = Try again. `other` is the safety net for anything the storage service says that
   isn't one of the four. */
const UPLOAD_REASONS = {
  storage: { reason: 'Storage isn’t set up for this workspace yet.', fix: 'link', fixLabel: 'Save as link instead' },
  offline: { reason: 'No connection. The file is kept here until you’re back online.', fix: 'retry', fixLabel: 'Try again' },
  type: { reason: `This file type isn’t allowed in ${APP_NAME}.`, fix: 'link', fixLabel: 'Save as link instead' },
  size: { reason: `Too large for storage. PDFs over about ${MAX_MB_PDF} MB can’t be uploaded yet.`, fix: 'link', fixLabel: 'Save as link instead' },
  other: { reason: 'The upload didn’t go through.', fix: 'retry', fixLabel: 'Try again' },
};
/* Problems we know about before sending anything: no connection, a blocked type, a PDF over the limit. */
function uploadProblem(f) {
  if (navigator.onLine === false) return 'offline';
  if (BLOCKED_EXT.includes(extOf(f.name))) return 'type';
  if (extOf(f.name) === 'pdf' && f.size > MAX_MB_PDF * 1e6) return 'size';
  return null;
}

function openUpload(d = {}) {
  const p = d.area ? { area: d.area, group: d.group || null, gkind: 'file' } : createPlace(route());
  if (!p || !p.area) { toast('Create an area first, then add files to it.', { icon: 'alert', tone: 'warn' }); return null; }
  if (lockedArea(p.area)) { toast(`Open ${lockedArea(p.area).name} first, then add files to it.`, { icon: 'lock', tone: 'warn' }); return null; }
  const U = UPLOAD.cur = { place: { area: p.area, group: groupFor(p, 'file') || null, gkind: 'file' }, file: null, res: null, run: 0 };
  U.L = layer({
    label: 'Upload a file',
    html: `<form data-form="upload" novalidate>${dialogHTML({
      title: 'Upload a file', text: 'Images, PDFs, videos, anything else. Name it and add a note next.',
      body: `<div id="upBody"><div class="drop" id="upDrop" data-act="choose-file" role="button" tabindex="0" aria-label="Choose a file, or drop one here">
          <span class="art">${ic('upload', 'lg')}</span><b>Choose a file, or drop it here</b><p>Up to about ${MAX_MB_PDF} MB for PDFs. Larger files can be saved as a link.</p></div></div>`
        + fieldHTML({ id: 'upName', label: 'Name', note: 'defaults to the file’s own name', control: inputHTML({ id: 'upName', name: 'name', disabled: true }) }).replace('class="field"', 'class="field up-gap"')
        + fieldHTML({ id: 'upNote', label: 'Note', note: 'optional', control: inputHTML({ id: 'upNote', name: 'note', placeholder: 'A short note for the file', disabled: true }) })
        + `<div class="current"><span>Adds to</span><b id="upPlace">${esc(placeName(U.place))}</b><span class="spacer"></span>${btnHTML({ kind: 'link', label: 'Change', act: 'pick-upload-dest' })}</div>`,
      foot: btnHTML({ kind: 'soft', label: 'Cancel', act: 'close' }) + `<button type="submit" class="btn btn-primary" id="upGo" disabled>Add file</button>`,
    })}</form>`,
    onMount(panel) {
      const over = (e, on) => { const z = e.target.closest && e.target.closest('#upDrop'); if (z) { e.preventDefault(); z.classList.toggle('over', on); } };
      panel.addEventListener('dragover', e => over(e, true));
      panel.addEventListener('dragleave', e => over(e, false));
      panel.addEventListener('drop', e => { over(e, false); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f && e.target.closest('#upDrop')) pickUpload(f); });
    },
    onClose() { if (UPLOAD.cur === U) { U.run++; UPLOAD.cur = null; } },
  });
  return U;
}
/* A file is chosen or dropped: show it, and start sending it unless we already know it will fail. */
function pickUpload(f) {
  const U = UPLOAD.cur; if (!U) return;
  U.file = f; U.res = null;
  const kind = KINDS[kindOfName(f.name)];
  $('#upBody').innerHTML = `<div class="upfile" id="upRow"><span class="ktile ${kind.tile}">${ic(kind.icon)}</span><div class="mid"><div class="t">${esc(f.name)}</div><div class="p"><span>${fmtSize(f.size)}</span><span class="pct" id="upPct">0%</span></div><div class="bar"><i id="upBar"></i></div></div></div><div id="upMsg"></div>`;
  const name = $('#upName'); name.disabled = false; name.placeholder = f.name; name.value = '';
  $('#upNote').disabled = false;
  const known = uploadProblem(f);
  if (known) failUpload(known); else sendUpload();
}
function sendUpload() {
  const U = UPLOAD.cur; if (!U || !U.file) return;
  const run = ++U.run;
  $('#upGo').disabled = true;
  const row = $('#upRow'), msg = $('#upMsg'); if (row) row.classList.remove('fail', 'done'); if (msg) msg.innerHTML = '';
  setProgress(0);
  uploadCL(U.file, pct => { if (U.run === run) setProgress(pct); }).then(res => {
    if (U.run !== run || UPLOAD.cur !== U) return;
    U.res = res; setProgress(100);
    $('#upRow').classList.add('done'); $('#upPct').textContent = 'Ready';
    $('#upGo').disabled = false;
  }, err => { if (U.run === run && UPLOAD.cur === U) failUpload(err && err.code ? err.code : 'other'); });
}
function setProgress(pct) { const b = $('#upBar'), t = $('#upPct'); if (b) b.style.width = pct + '%'; if (t) t.textContent = pct + '%'; }
function failUpload(code) {
  const r = UPLOAD_REASONS[code] || UPLOAD_REASONS.other;
  $('#upRow').classList.add('fail'); $('#upBar').style.width = '40%'; $('#upPct').textContent = 'Failed';
  $('#upGo').disabled = true;
  $('#upMsg').innerHTML = `<div class="failbox" role="alert"><span class="ic">${ic('alert')}</span><div><b>Couldn’t add this file</b><p>${esc(r.reason)}</p>${btnHTML({ kind: 'soft', sm: true, label: r.fixLabel, icon: r.fix === 'link' ? 'link' : 'refresh', act: r.fix === 'link' ? 'upload-as-link' : 'upload-retry' })}</div></div>`;
}
on('upload', d => openUpload(d));
on('choose-file', () => pickFiles(files => { if (UPLOAD.cur) pickUpload(files[0]); }));
on('upload-retry', () => {
  const f = UPLOAD.cur && UPLOAD.cur.file; if (!f) return;
  const known = uploadProblem(f);
  if (known) { failUpload(known); return; }
  sendUpload();
});
on('upload-as-link', () => {
  const U = UPLOAD.cur; if (!U || !U.file) return;
  const name = ($('#upName').value || '').trim() || U.file.name, place = U.place, kind = kindOfName(U.file.name);
  closeAll();
  openLink({ area: place.area, group: place.group, name, kind: kind in LINK_TYPE ? kind : 'other', address: '' });
});
on('pick-upload-dest', () => {
  const U = UPLOAD.cur; if (!U) return;
  destPicker({ title: 'Add to', current: U.place, type: 'place', itemKind: 'file', cta: 'Use this place', onPick: p => { U.place = linkPlace(p); const el = $('#upPlace'); if (el) el.textContent = placeName(U.place); } });
});
onForm('upload', f => {
  const U = UPLOAD.cur; if (!U || !U.file || !U.res) return;
  const name = f.elements.name.value.trim() || U.file.name, note = f.elements.note.value.trim(), r = U.res, place = U.place;
  const doc = { id: newId(), folderId: place.area, name, cloudType: r.cloudType, format: r.format, url: r.url, note, added: Date.now(), uploaded: true, type: r.cloudType || 'other', starred: false };
  if (place.group) doc.docFolderId = place.group;
  const who = signedInUser(); if (who) doc.createdBy = { uid: who.uid, name: currentUser().name };
  sD(doc).then(() => {}, () => toast('Couldn’t save the file. Check your connection, then try again.', { icon: 'alert', tone: 'warn' }));
  closeAll();
  toast(`Added “${name}” to ${area(place.area).name}`, { icon: 'upload' });
});

/* ---------- Drop a file anywhere on an area or a MoM (C6). Not on phones. ---------- */
let dragDepth = 0;
const dropTarget = () => {
  if (LAYERS.length || window.matchMedia('(max-width: 767px)').matches) return null;
  const r = route(); let areaId = null;
  if (r.name === 'area') areaId = r.id; else if (r.name === 'mom') areaId = (mom(r.id) || {}).folderId;
  const a = areaId && area(areaId);
  return a && canSee(a.id) && !lockedArea(a.id) ? a : null;
};
const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
document.addEventListener('dragenter', e => {
  if (!hasFiles(e)) return;
  dragDepth++;
  const a = dropTarget(); if (!a) return;
  $('#dropTitle').textContent = `Drop to add to ${a.name}`;
  $('#dropOverlay').classList.add('on');
});
document.addEventListener('dragover', e => { if ($('#dropOverlay').classList.contains('on')) e.preventDefault(); });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dropOverlay').classList.remove('on'); });
document.addEventListener('drop', e => {
  if (!$('#dropOverlay').classList.contains('on')) { dragDepth = 0; return; }
  e.preventDefault(); dragDepth = 0; $('#dropOverlay').classList.remove('on');
  const a = dropTarget(), files = Array.from(e.dataTransfer.files || []); if (!a || !files.length) return;
  if (openUpload({ area: a.id })) { pickUpload(files[0]); if (files.length > 1) toast('One file at a time. Add the others after this one.', { icon: 'info' }); }
});
