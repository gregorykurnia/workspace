/* Files and links: upload with progress and failure reasons (C6, C8),
   saving a link (C7), opening files (F9), download and copy address
   (F10, F14), and drop anywhere on an area (C6). */
'use strict';

const MAX_MB_PDF = 10;   // the storage plan fails above roughly 10 MB for PDFs (inventory hard constraint)
const BLOCKED_EXT = ['exe', 'bat', 'msi'];

/* Where a new file or link goes. Defaults to the current place. */
function placeFromData(d) {
  if (d && d.area) return { area: d.area, group: d.group || null };
  return createPlace(route()) || { area: null, group: null };
}

/* ---------- Upload (C6, C8) ---------- */
function uploadProblem(f) {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (S.state === 'failure') return { reason: 'Storage isn’t set up for this workspace yet.', fix: 'link', fixLabel: 'Save as link instead' };
  if (S.state === 'offline') return { reason: 'No connection. The file is kept here until you’re back online.', fix: 'retry', fixLabel: 'Try again' };
  if (BLOCKED_EXT.includes(ext)) return { reason: 'This file type isn’t allowed in Daybook.', fix: 'link', fixLabel: 'Save as link instead' };
  if (ext === 'pdf' && f.size > MAX_MB_PDF * 1e6) return { reason: `Too large for storage. PDFs over about ${MAX_MB_PDF} MB can’t be uploaded yet.`, fix: 'link', fixLabel: 'Save as link instead' };
  return null;
}
function kindOfName(n) {
  const e = (n.split('.').pop() || '').toLowerCase();
  if (e === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(e)) return 'image';
  if (['mp4', 'mov', 'webm', 'm4v'].includes(e)) return 'video';
  if (['xlsx', 'xls', 'csv', 'numbers'].includes(e)) return 'sheet';
  if (['pptx', 'ppt', 'key'].includes(e)) return 'slides';
  return 'other';
}
function openUpload(d = {}) {
  const p = placeFromData(d);
  if (!p.area) { toast('Create an area first, then add files to it.', { icon: 'alert', tone: 'warn' }); return; }
  const U = { p, file: null, pct: 0, timer: null };
  const L = layer({
    label: 'Upload a file',
    html: `<div class="dlg-head"><div class="tt2"><h2>Upload a file</h2><p>Images, PDFs, videos, anything else. Name it and add a note next.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div id="upBody">
        <div class="drop" id="upDrop" data-act="choose-file" role="button" tabindex="0" aria-label="Choose a file, or drop one here">
          <span class="art">${ic('upload', 'lg')}</span><b>Choose a file, or drop it here</b><p>Up to about 10 MB for PDFs. Larger files can be saved as a link.</p>
        </div>
        <div class="demo-link">Prototype: <button type="button" data-act="demo-big-pdf">try a 14 MB PDF</button></div>
      </div>
      <div class="field" style="margin-top:18px"><label class="lab" for="upName">Name <em>defaults to the file’s own name</em></label><input class="input" id="upName" autocomplete="off" disabled></div>
      <div class="field"><label class="lab" for="upNote">Note <em>optional</em></label><input class="input" id="upNote" autocomplete="off" placeholder="A short note for the file" disabled></div>
      <div class="current" style="margin-bottom:0"><span>Adds to</span><b id="upPlace">${esc(placeName(p))}</b><span class="spacer"></span><button type="button" class="link-btn" style="min-height:36px" data-act="pick-upload-dest">Change</button></div>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" id="upGo" disabled>Add file</button></div>`,
    onMount(panel) {
      panel.addEventListener('dragover', e => { if (e.target.closest('#upDrop')) { e.preventDefault(); $('#upDrop').classList.add('over'); } });
      panel.addEventListener('dragleave', e => { if (e.target.closest('#upDrop')) $('#upDrop').classList.remove('over'); });
      panel.addEventListener('drop', e => { if (e.target.closest('#upDrop')) { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) pickFile(f); } });
    },
  });
  UPLOAD.cur = U;
  U.L = L;
}
const UPLOAD = {};
function pickFile(f, opts = {}) {
  const U = UPLOAD.cur; if (!U) return;
  U.file = { name: f.name, size: f.size || 0, type: f.type || '', raw: f, demo: !!opts.demo };
  const body = $('#upBody');
  const problem = uploadProblem(U.file);
  body.innerHTML = `<div class="upfile" id="upRow"><span class="ktile ${KINDS[kindOfName(f.name)].tile}">${ic(KINDS[kindOfName(f.name)].icon)}</span><div class="mid"><div class="t">${esc(f.name)}</div><div class="p"><span>${fmtSize(U.file.size)}</span><span class="pct" id="upPct">0%</span></div><div class="bar"><i id="upBar"></i></div></div></div><div id="upMsg"></div>`;
  $('#upName').disabled = false; $('#upNote').disabled = false;
  $('#upName').placeholder = f.name;
  $('#upName').value = '';
  $('#upGo').disabled = false;
  if (problem) return failUpload(problem);
  startUpload();
}
function startUpload() {
  const U = UPLOAD.cur; if (!U) return;
  $('#upGo').disabled = true;
  let p = 0;
  U.timer = setInterval(() => {
    p = Math.min(100, p + 8);
    $('#upBar') && ($('#upBar').style.width = p + '%');
    $('#upPct') && ($('#upPct').textContent = p + '%');
    if (p >= 100) {
      clearInterval(U.timer);
      $('#upRow') && $('#upRow').classList.add('done');
      $('#upPct') && ($('#upPct').textContent = 'Ready');
      $('#upGo').disabled = false;
      $('#upGo').textContent = 'Add file';
    }
  }, reduceMotion() ? 20 : 120);
}
function failUpload(problem) {
  const U = UPLOAD.cur;
  clearInterval(U && U.timer);
  $('#upRow') && $('#upRow').classList.add('fail');
  $('#upBar') && ($('#upBar').style.width = '40%');
  $('#upPct') && ($('#upPct').textContent = 'Failed');
  $('#upGo').disabled = true;
  $('#upMsg').innerHTML = `<div class="failbox" role="alert"><span class="ic">${ic('alert')}</span><div><b>Couldn’t add this file</b><p>${esc(problem.reason)}</p>${problem.fix === 'link' ? `<button class="btn btn-soft btn-sm" style="margin-top:10px" data-act="upload-as-link">${ic('link', 'sm')}${esc(problem.fixLabel)}</button>` : `<button class="btn btn-soft btn-sm" style="margin-top:10px" data-act="upload-retry">${ic('refresh', 'sm')}${esc(problem.fixLabel)}</button>`}</div></div>`;
}
on('choose-file', () => { $('#fileInput').click(); });
on('demo-big-pdf', () => {
  const fake = new File([new Uint8Array(0)], 'Board pack.pdf', { type: 'application/pdf' });
  Object.defineProperty(fake, 'size', { value: 14e6 });
  pickFile(fake, { demo: true });
});
on('upload-retry', () => { const U = UPLOAD.cur; if (!U) return; S.state = 'normal'; $('#upMsg').innerHTML = ''; $('#upRow').classList.remove('fail'); $('#upPct').textContent = '0%'; $('#upBar').style.width = '0%'; startUpload(); renderProto(); });
on('upload-as-link', () => {
  const U = UPLOAD.cur; if (!U) return;
  const name = $('#upName').value.trim() || U.file.name;
  closeAll();
  openLink({ area: U.p.area, group: U.p.group, name, kind: kindOfName(U.file.name), address: '' });
});
on('pick-upload-dest', () => {
  const U = UPLOAD.cur; if (!U) return;
  destPicker({ title: 'Add to', current: U.p, type: 'place', itemKind: 'file', cta: 'Use this place', onPick: (p) => { U.p = p; $('#upPlace').textContent = placeName(p); } });
});
onForm('upload', () => {});
// Adding the file itself happens from the Add file button in the dialog footer.
document.addEventListener('click', e => {
  const b = e.target.closest('#upGo');
  if (!b || b.disabled) return;
  const U = UPLOAD.cur; if (!U || !U.file) return;
  const name = $('#upName').value.trim() || U.file.name;
  const note = $('#upNote').value.trim();
  const kind = kindOfName(U.file.name);
  const id = nid('f');
  const f = { id, name, kind, size: U.file.size, date: TODAY_ISO, area: U.p.area, group: U.p.group || null, note };
  if (kind === 'image' && U.file.raw) f.thumb = URL.createObjectURL(U.file.raw);
  DB.files.push(f);
  UPLOAD.cur = null;
  closeAll();
  toast(`Added “${name}” to ${area(U.p.area).name}`, { icon: 'upload' });
  render();
}, true);
on('upload', (d) => openUpload(d));
on('new-upload', (d) => openUpload(d));
/* Choose from the file input (keyboard and pointer). */
$('#fileInput') && $('#fileInput').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (ED.imgMode === 'device') {
    ED.imgMode = null; closeAll(); insertImage(URL.createObjectURL(f)); return;
  }
  if (!UPLOAD.cur) openUpload({});
  pickFile(f);
});

/* ---------- Save a link (C7) ---------- */
function guessKind(addr) {
  const a = (addr || '').toLowerCase();
  if (a.includes('presentation') || a.includes('slides') || a.endsWith('.pptx')) return 'slides';
  if (a.includes('spreadsheets') || a.includes('sheets') || a.endsWith('.xlsx')) return 'sheet';
  if (a.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(a)) return 'image';
  return 'link';
}
function openLink(d = {}) {
  const p = placeFromData(d);
  if (!p.area) { toast('Create an area first, then save links to it.', { icon: 'alert', tone: 'warn' }); return; }
  let kind = d.kind || 'link';
  const kinds = [['link', 'Web link'], ['slides', 'Presentation'], ['pdf', 'PDF / document'], ['sheet', 'Spreadsheet'], ['image', 'Image'], ['other', 'Other']];
  const tile = k => `<button type="button" role="radio" class="kind" aria-checked="${k === kind}" data-act="pick-kind" data-k="${k}"><span class="ktile ${KINDS[k].tile}">${ic(KINDS[k].icon, 'sm')}</span>${kinds.find(x => x[0] === k)[1]}</button>`;
  layer({
    label: 'Save a link',
    html: `<form data-form="link" novalidate><div class="dlg-head"><div class="tt2"><h2>Save a link</h2><p>Keep online material next to your uploads.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div id="lkMsg"></div>
      <div class="field" id="fAddr"><label class="lab" for="lkAddr">Address <em>required</em></label><input class="input" id="lkAddr" name="address" inputmode="url" placeholder="https://…" autocomplete="off" value="${esc(d.address || '')}" data-input="link-addr"><span class="ferr" role="alert">Paste the address first.</span></div>
      <div class="field" id="fLkName"><label class="lab" for="lkName">Name <em>required</em></label><input class="input" id="lkName" name="name" autocomplete="off" value="${esc(d.name || '')}" placeholder="What is it?"><span class="ferr" role="alert">Give the link a name so you can find it later.</span></div>
      <div class="field"><span class="lab" id="kindLab">Kind</span><div class="kinds" role="radiogroup" aria-labelledby="kindLab">${kinds.map(k => tile(k[0])).join('')}</div><input type="hidden" name="kind" value="${kind}"></div>
      <div class="field"><label class="lab" for="lkNote">Note <em>optional</em></label><input class="input" id="lkNote" name="note" autocomplete="off"></div>
      <div class="current" style="margin-bottom:0"><span>Adds to</span><b id="lkPlace">${esc(placeName(p))}</b><span class="spacer"></span><button type="button" class="link-btn" style="min-height:36px" data-act="pick-link-dest">Change</button></div>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Save link</button></div></form>`,
    onMount(panel, L) { L.place = p; },
  });
}
on('save-link', (d) => openLink(d));
on('pick-kind', (d, el) => {
  const f = el.closest('form');
  f.querySelectorAll('[role=radio]').forEach(b => b.setAttribute('aria-checked', String(b === el)));
  f.kind.value = d.k;
});
on('pick-link-dest', () => {
  const L = LAYERS[LAYERS.length - 1]; if (!L) return;
  destPicker({ title: 'Save to', current: L.place, type: 'place', itemKind: 'file', cta: 'Use this place', onPick: (p) => { L.place = p; const el = $('#lkPlace'); if (el) el.textContent = placeName(p); } });
});
document.addEventListener('input', e => {
  if (e.target.id !== 'lkAddr') return;
  const k = guessKind(e.target.value);
  const f = e.target.closest('form');
  f.querySelectorAll('[role=radio]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.k === k)));
  f.kind.value = k;
});
onForm('link', (f) => {
  const addr = f.elements.address.value.trim();
  const name = f.elements.name.value.trim();
  $('#fAddr').classList.toggle('err', !addr);
  $('#fLkName').classList.toggle('err', !name);
  if (!addr || !name) { (addr ? f.elements.name : f.elements.address).focus(); return; }
  const L = LAYERS[LAYERS.length - 1];
  const p = (L && L.place) || placeFromData({});
  DB.files.push({ id: nid('f'), name, kind: f.kind.value, link: addr.replace(/^https?:\/\//, ''), date: TODAY_ISO, area: p.area, group: p.group || null, note: f.elements.note.value.trim() });
  closeAll();
  toast(`Saved link “${name}”`, { icon: 'link' });
  render();
});

/* ---------- Open, download, copy (F9, F10, F14) ---------- */
function openFile(id) {
  const f = file(id);
  if (!f) return go('#/missing');
  if (!canSee(f.area)) return toast('You don’t have access to that area', { icon: 'lock', tone: 'warn' });
  const lock = lockedArea(f.area);
  if (lock) return go(`#/areas/${f.area}`);
  if (f.restricted && !S.unlocked.has('f:' + f.id)) return fileGate(f);
  touchRecent('f', f.id);
  if (f.kind === 'image' && f.thumb) return lightbox(f);
  if (f.link) return toast(`Opened “${f.name}” in a new tab`, { icon: 'external' });
  toast(`Opened “${f.name}” in a new tab`, { icon: 'external' });
}
on('open-file', (d, el, e) => { if (el && el.tagName === 'A') e.preventDefault(); openFile(d.id); });
function lightbox(f) {
  layer({
    cls: 'layer-lightbox', label: f.name, html: `<figure class="lb"><img src="${f.thumb}" alt="${esc(f.name)}"><figcaption><span>${esc(f.name)}</span><span style="display:flex;gap:8px"><button class="btn btn-soft btn-sm" data-act="download" data-id="${f.id}">${ic('download', 'sm')}Download</button><button class="icon-btn" data-act="copy-address" data-id="${f.id}" aria-label="Copy address">${ic('copy', 'sm')}</button><button class="icon-btn" data-act="close" aria-label="Close">${ic('x', 'sm')}</button></span></figcaption></figure>`,
  });
}
function fileGate(f) {
  layer({
    label: `${f.name} is restricted`, html: `<form data-form="unlock" data-kind="f" data-id="${f.id}" novalidate><div class="dlg-head"><div class="tt2"><h2>${esc(f.name)}</h2><p>This file is restricted. Enter the password to open it, download it or see its note.</p></div><button type="button" class="icon-btn" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="field" id="fGate"><label class="lab" for="gateF">Password</label><input class="input" id="gateF" name="password" type="password" autofocus autocomplete="off"><span class="ferr" role="alert">That password isn’t right. Try again.</span></div>
      <div class="dlg-foot"><button type="button" class="btn btn-soft" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Unlock</button></div></form>`,
  });
}
on('download', (d) => {
  const f = file(d.id);
  if (!f) return;
  if (f.link) return toast(`Links can’t be downloaded, so “${f.name}” opened in a new tab`, { icon: 'external' });
  toast(`Downloading “${f.name}”`, { icon: 'download' });
});
on('copy-address', (d) => {
  const f = file(d.id);
  const text = f && f.link ? f.link : `https://daybook.example/files/${d.id}`;
  try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) { /* ignore: clipboard can be refused */ }
  toast('Address copied', { icon: 'copy' });
});

/* ---------- Drop anywhere on an area or MoM (C6) ---------- */
let dragDepth = 0;
const overlay = () => $('#dropOverlay');
window.addEventListener('dragenter', e => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
  const r = route();
  if (r.name !== 'area' && r.name !== 'mom') return;
  dragDepth++;
  const a = r.name === 'area' ? area(r.id) : area(mom(r.id) && mom(r.id).area);
  if (!a) return;
  $('#dropTitle').textContent = `Drop to add to ${a.name}`;
  overlay().classList.add('on');
});
window.addEventListener('dragover', e => { if (overlay().classList.contains('on')) e.preventDefault(); });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay().classList.remove('on'); });
window.addEventListener('drop', e => {
  if (!overlay().classList.contains('on')) return;
  e.preventDefault();
  dragDepth = 0; overlay().classList.remove('on');
  const f = e.dataTransfer.files[0];
  const r = route();
  const place = r.name === 'area' ? { area: r.id, group: null } : { area: mom(r.id).area, group: mom(r.id).group };
  openUpload({ area: place.area, group: place.group });
  if (f) pickFile(f);
});
