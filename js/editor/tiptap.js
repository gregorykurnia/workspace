/* Tiptap for the new editor (plan 2.1, 2.9). The only ES module in the app. Every import is
   pinned to one version with shared dependencies, so there is exactly one copy of Tiptap and
   ProseMirror. Exposes window._TT and fires 'tt-ready' on document.

   Stored HTML stays compatible with the old editor (it is still in use until cutover):
   - images are inline <img> with style="width:…" and data-px / data-py when floating;
   - links to MoMs stay https://mom.local/{id}; links to files stay the file's own address;
   - the journal and Long text marks are extra attributes (data-template, data-coltype) that the
     old editor ignores. */
import { Editor, Extension, mergeAttributes } from 'https://esm.sh/@tiptap/core@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import StarterKit from 'https://esm.sh/@tiptap/starter-kit@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import { Table, TableView } from 'https://esm.sh/@tiptap/extension-table@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import TableRow from 'https://esm.sh/@tiptap/extension-table-row@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import TableHeader from 'https://esm.sh/@tiptap/extension-table-header@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import TableCell from 'https://esm.sh/@tiptap/extension-table-cell@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import Underline from 'https://esm.sh/@tiptap/extension-underline@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import Link from 'https://esm.sh/@tiptap/extension-link@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import TextStyle from 'https://esm.sh/@tiptap/extension-text-style@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import Color from 'https://esm.sh/@tiptap/extension-color@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import Highlight from 'https://esm.sh/@tiptap/extension-highlight@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import FontFamily from 'https://esm.sh/@tiptap/extension-font-family@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import TextAlign from 'https://esm.sh/@tiptap/extension-text-align@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import Image from 'https://esm.sh/@tiptap/extension-image@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import Placeholder from 'https://esm.sh/@tiptap/extension-placeholder@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import Suggestion from 'https://esm.sh/@tiptap/suggestion@2.27.3?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3';
import { Plugin, PluginKey } from 'https://esm.sh/@tiptap/pm@2.27.3/state';
import { Decoration, DecorationSet } from 'https://esm.sh/@tiptap/pm@2.27.3/view';

/* Text size: a textStyle attribute, stored as style="font-size:…" (same as the old editor). */
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{ types: this.options.types, attributes: { fontSize: {
      default: null,
      parseHTML: el => el.style.fontSize || null,
      renderHTML: a => (a.fontSize ? { style: 'font-size:' + a.fontSize } : {}),
    } } }];
  },
  addCommands() {
    return {
      setFontSize: s => ({ chain }) => chain().setMark('textStyle', { fontSize: s }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

/* Tables: the journal template on the table, the Long text column type on heading cells. */
const JOURNAL = 'prospect-journal';
const coltype = {
  default: null,
  parseHTML: el => el.getAttribute('data-coltype'),
  renderHTML: a => (a.coltype ? { 'data-coltype': a.coltype } : {}),
};
const Header = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), coltype }; } });
const Cell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), coltype }; } });
/* The editable table view (column resizing) builds its own <table>; mark it here so the
   journal styles (table.journal) apply while editing too. */
class JournalTableView extends TableView {
  constructor(node, cellMinWidth) { super(node, cellMinWidth); this.mark(node); }
  update(node) { const ok = super.update(node); if (ok) this.mark(node); return ok; }
  mark(node) {
    const t = node.attrs.template;
    this.table.classList.toggle('journal', t === JOURNAL);
    if (t) this.table.setAttribute('data-template', t); else this.table.removeAttribute('data-template');
  }
}
const JTable = Table.extend({
  addAttributes() {
    return { ...this.parent?.(), template: {
      default: null,
      parseHTML: el => el.getAttribute('data-template'),
      renderHTML: a => (a.template ? { 'data-template': a.template, class: a.template === JOURNAL ? 'journal' : null } : {}),
    } };
  },
}).configure({ resizable: true, View: JournalTableView });   // default cell width, as the old editor stores it

/* Long text columns and journal rows: classes, labels (phone cards), the "Long text" badge and
   the two-line preview with an expand button. All decorations: nothing here is stored. */
const ico = n => `<svg class="i sm" aria-hidden="true"><use href="#i-${n}"/></svg>`;
function cellText(cell) { return cell.textBetween(0, cell.content.size, '\n', '\n'); }
function remarkWidget(label, text) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'remark'; b.contentEditable = 'false';
  b.dataset.act = 'remarks-open';
  b.setAttribute('aria-label', `Open ${label || 'Long text'}`);
  const t = document.createElement('span'); t.className = 'remark-text';
  if (text.trim()) t.textContent = text.replace(/\n+/g, ' ');
  else { const e = document.createElement('span'); e.className = 'remark-empty'; e.textContent = 'Add remarks'; t.appendChild(e); }
  const o = document.createElement('span'); o.className = 'remark-open'; o.setAttribute('aria-hidden', 'true'); o.innerHTML = ico('expand');
  b.append(t, o);
  return b;
}
function badgeWidget() {
  const s = document.createElement('span'); s.className = 'coltype'; s.contentEditable = 'false'; s.textContent = 'Long text';
  return s;
}
function longTextDecorations(doc) {
  const decos = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return true;
    const journal = node.attrs.template === JOURNAL;
    const rows = [];
    node.forEach((row, off) => rows.push({ row, pos: pos + 1 + off }));
    if (!rows.length) return true;
    const labels = [], long = new Set();
    let c = 0;
    rows[0].row.forEach((cell, off) => {
      labels[c] = cell.textContent.trim();
      if (cell.attrs.coltype === 'longtext') {
        long.add(c);
        const cp = rows[0].pos + 1 + off;
        decos.push(Decoration.node(cp, cp + cell.nodeSize, { class: 'is-longtext' }));
        decos.push(Decoration.widget(cp + cell.nodeSize - 1, badgeWidget, { side: 1, key: 'lt-badge', ignoreSelection: true }));
      }
      c++;
    });
    if (!journal && !long.size) return true;   // keep looking: a cell can hold a table of its own
    rows.slice(1).forEach(({ row, pos: rp }) => {
      let ci = 0;
      row.forEach((cell, off) => {
        const cp = rp + 1 + off, attrs = { 'data-label': labels[ci] || '' };
        if (long.has(ci)) {
          attrs.class = 'longtext';
          attrs.contenteditable = 'false';
          const text = cellText(cell), label = labels[ci];
          decos.push(Decoration.widget(cp + 1, () => remarkWidget(label, text), { side: -1, key: `rm:${ci}:${label}:${text}`, ignoreSelection: true, stopEvent: () => true }));
        }
        decos.push(Decoration.node(cp, cp + cell.nodeSize, attrs));
        ci++;
      });
    });
    return true;
  });
  return DecorationSet.create(doc, decos);
}
const LongText = Extension.create({
  name: 'longText',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('longText'),
      state: {
        init: (_, state) => longTextDecorations(state.doc),
        apply: (tr, old) => (tr.docChanged ? longTextDecorations(tr.doc) : old),
      },
      props: { decorations(state) { return this.getState(state); } },
    })];
  },
});

/* Images: stored as the old editor stores them; shown with the design's image component
   (inline or floating, a corner grip to resize, a Drag handle when floating). */
const ResizableImage = Image.extend({
  name: 'image',
  addAttributes() {
    const num = n => ({ default: null, parseHTML: el => (el.getAttribute(n) != null ? Number(el.getAttribute(n)) : null), renderHTML: () => ({}) });
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: el => el.style.width || el.getAttribute('width') || null, renderHTML: a => (a.width ? { style: 'width:' + a.width } : {}) },
      px: { ...num('data-px'), renderHTML: a => (a.px != null ? { 'data-px': a.px, 'data-py': a.py != null ? a.py : 0 } : {}) },
      py: num('data-py'),
    };
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let attrs = { ...node.attrs };
      const wrap = document.createElement('span');
      wrap.contentEditable = 'false';
      const img = document.createElement('img');
      img.alt = attrs.alt || '';
      img.draggable = false;
      const grip = document.createElement('span'); grip.className = 'grip'; grip.setAttribute('aria-hidden', 'true');
      const handle = document.createElement('span'); handle.className = 'move-handle'; handle.setAttribute('aria-hidden', 'true');
      handle.innerHTML = ico('drag') + 'Drag';
      wrap.append(img, grip, handle);
      const paint = () => {
        const floating = attrs.px != null;
        wrap.className = 'img ' + (floating ? 'floating' : 'inline') + (wrap.classList.contains('is-sel') ? ' is-sel' : '');
        if (img.getAttribute('src') !== attrs.src) img.src = attrs.src || '';
        const w = attrs.width || (floating ? '46%' : 'fit-content');
        wrap.style.width = w;
        wrap.style.position = floating ? 'absolute' : '';
        // The stored place is kept; on a narrower screen the image is kept inside the note.
        wrap.style.left = floating ? `min(${attrs.px}px, max(0px, calc(100% - ${w})))` : '';
        wrap.style.top = floating ? (attrs.py || 0) + 'px' : '';
        wrap.style.zIndex = floating ? '2' : '';
      };
      paint();
      const commit = extra => {
        if (typeof getPos !== 'function' || !editor.isEditable) return;
        const pos = getPos();
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, null, { ...attrs, ...extra }));
      };
      const drag = (el, onMove, onUp) => el.addEventListener('pointerdown', e => {
        if (!editor.isEditable) return;
        e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId);
        const start = { x: e.clientX, y: e.clientY, w: wrap.getBoundingClientRect().width, l: attrs.px || 0, t: attrs.py || 0 };
        const mv = ev => onMove(ev, start);
        const up = ev => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); onUp(ev, start); };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
      const maxW = () => (editor.view.dom.clientWidth || 600);
      drag(grip, (ev, s) => { wrap.style.width = Math.max(80, Math.min(maxW(), s.w + ev.clientX - s.x)) + 'px'; },
        () => commit({ width: Math.round(wrap.getBoundingClientRect().width) + 'px' }));
      drag(handle, (ev, s) => {
        if (attrs.px == null) return;
        const root = editor.view.dom.getBoundingClientRect(), box = wrap.getBoundingClientRect();
        if (s.ol == null) { s.ol = box.left - root.left; s.ot = box.top - root.top; }   // where it shows now
        s.nl = Math.max(0, Math.min(root.width - box.width, s.ol + ev.clientX - s.x));
        s.nt = Math.max(0, s.ot + ev.clientY - s.y);
        wrap.style.left = s.nl + 'px'; wrap.style.top = s.nt + 'px';
        wrap.classList.add('is-dragging');
      }, (ev, s) => {
        wrap.classList.remove('is-dragging');
        if (attrs.px != null && s.nl != null) commit({ px: Math.round(s.nl), py: Math.round(s.nt) });
        else paint();
      });
      return {
        dom: wrap,
        update(n) { if (n.type.name !== 'image') return false; attrs = { ...n.attrs }; paint(); return true; },
        selectNode() { wrap.classList.add('is-sel'); },
        deselectNode() { wrap.classList.remove('is-sel'); },
        stopEvent: e => !!(e.target && (grip.contains(e.target) || handle.contains(e.target))),
        ignoreMutation: () => true,
      };
    };
  },
}).configure({ inline: true, allowBase64: true });

/* Upload placeholders (W4): decorations, never part of the stored note. Commands go through
   transaction meta: { add: {id, pos} } { set: {id, pct | failed, src} } { remove: id }. */
const uploadKey = new PluginKey('uploads');
function slotWidget(spec) {
  const d = document.createElement('div');
  d.contentEditable = 'false';
  d.innerHTML = spec.failed ? imageFailedHTML({ src: spec.retry || '' }) : imageUploadingHTML({ pct: spec.pct || 0 });
  const el = d.firstElementChild;
  if (spec.failed) el.querySelector('[data-act]').dataset.id = spec.id;
  return el;
}
const UploadSlots = Extension.create({
  name: 'uploadSlots',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: uploadKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, set) {
          set = set.map(tr.mapping, tr.doc);
          const m = tr.getMeta(uploadKey);
          if (!m) return set;
          const find = id => set.find(null, null, s => s.id === id)[0];
          if (m.add) set = set.add(tr.doc, [Decoration.widget(m.add.pos, () => slotWidget({ id: m.add.id, pct: 0 }), { id: m.add.id, key: 'up:' + m.add.id + ':0', side: -1 })]);
          if (m.set) {
            const old = find(m.set.id);
            if (old) {
              const spec = { ...old.spec, ...m.set };
              set = set.remove([old]).add(tr.doc, [Decoration.widget(old.from, () => slotWidget(spec), { ...spec, key: `up:${spec.id}:${spec.failed ? 'f' : spec.pct}` })]);
            }
          }
          if (m.remove) { const old = find(m.remove); if (old) set = set.remove([old]); }
          return set;
        },
      },
      props: { decorations(state) { return this.getState(state); } },
    })];
  },
});
/* Where a placeholder sits now (its position moves as the note is edited), or null. */
function uploadSlotPos(state, id) { const d = uploadKey.getState(state).find(null, null, s => s.id === id)[0]; return d ? d.from : null; }

/* "/" menu (plan 2.9): the Suggestion utility on "/" at the start of an empty line. The list and
   the commands live in ui/mom.js, which configures render() and command(). */
const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() { return { suggestion: { char: '/', startOfLine: false } }; },
  addProseMirrorPlugins() {
    return [Suggestion({
      editor: this.editor,
      ...this.options.suggestion,
      allow: ({ state, range }) => {
        const $from = state.doc.resolve(range.from);
        const before = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n');
        return before === '' && $from.parent.type.name === 'paragraph';
      },
    })];
  },
});

window._TT = {
  Editor, StarterKit, Table: JTable, TableRow, TableHeader: Header, TableCell: Cell, Underline, Link, TextStyle,
  Color, Highlight, FontFamily, TextAlign, FontSize, ResizableImage, Placeholder, LongText, UploadSlots,
  SlashCommand, uploadKey, uploadSlotPos, mergeAttributes, JOURNAL,
};
document.dispatchEvent(new Event('tt-ready'));
