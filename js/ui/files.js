/* Files (F9, F10, F14, C6 in part): Save a link (W5 is the editor's). The Upload dialog comes with
   its own task. Opening, downloading and copying a file live in area.js. */
'use strict';

/* The kind a saved link is stored under (the old app's `type` names). */
const LINK_TYPE = { link: 'link', slides: 'presentation', pdf: 'pdf', sheet: 'spreadsheet', image: 'image', other: 'other' };
/* An address as typed, with https:// added when it has no scheme. */
const normalizeUrl = raw => (/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
const looksLikeUrl = raw => /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(raw);

/* Where a new file goes: the place chosen in this dialog (its grouping must hold files). */
function linkPlace(p) { return { area: p.area, group: groupFor(p, 'file') || null }; }

function openLink(d = {}) {
  const p = createPlace(route());
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
        + fieldHTML({ id: 'lkNote', label: 'Note', control: inputHTML({ id: 'lkNote', name: 'note' }) })
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
