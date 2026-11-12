import { parseDocument } from 'htmlparser2';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { z } from 'zod';
import { isVisible, label } from './destinations.mjs';
import { ConnectorError } from './firebase.mjs';

const validId = value => typeof value === 'string' && value.length > 0 && !value.includes('/')
  && !['.', '..'].includes(value) && Buffer.byteLength(value) <= 1500;
const id = z.string().trim().refine(validId);
export const findInputs = z.object({
  query: z.string().trim().optional(), areaId: id.optional(),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
  kind: z.enum(['mom', 'file', 'link']).optional(),
}).refine(args => !args.from || !args.to || args.from <= args.to);
export const readInputs = z.object({ id });
export const readInputMessages = {
  find_items: 'Check find_items inputs: query must be text, areaId an area id, kind mom, file or link, and dates yyyy-mm-dd with from no later than to.',
  read_mom: 'Check read_mom inputs: give one nonempty MoM id.',
};

const markdown = new NodeHtmlMarkdown({ bulletMarker: '-' }, {
  // Markdown has no underline syntax; save_mom accepts this inline HTML.
  u: { prefix: '<u>', postfix: '</u>' },
});
const listItem = markdown.translators.get('li');
markdown.translators.set('li', context => {
  const config = { ...listItem.base, ...listItem(context) };
  const start = Number(context.parent?.getAttribute('start') ?? 1);
  if (context.listKind === 'OL' && Number.isInteger(start) && start >= 0) {
    config.prefix = context.options.indent.repeat(context.indentLevel || 0) + `${start + context.listItemNumber - 1}. `;
  }
  return config;
});
const plainTags = new Set('p h1 h2 h3 strong em u s a ul ol li blockquote code pre hr br table thead tbody tr th td'.split(' '));
const textDrop = new Set(['script', 'style', 'template', 'noscript']);
const spaceAfter = new Set('br p div li tr td th h1 h2 h3 h4 blockquote'.split(' '));
const days = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });

function parse(schema, input, tool) {
  const result = schema.safeParse(input);
  if (!result.success) throw new ConnectorError(readInputMessages[tool]);
  return result.data;
}

function delta(content) {
  if (typeof content !== 'string' || content.charAt(0) !== '{') return null;
  try {
    const value = JSON.parse(content);
    return Array.isArray(value?.ops) ? value.ops : null;
  } catch { return null; }
}

const deltaText = ops => ops.map(op => typeof op?.insert === 'string' ? op.insert : ' ').join('');

// The browser's plainText rules, without a browser or any resource loading.
function textOf(nodes) {
  const parts = [], stack = [...nodes].reverse();
  while (stack.length) {
    const node = stack.pop();
    if (node === ' ') { parts.push(' '); continue; }
    if (node.type === 'text') { parts.push(node.data); continue; }
    if (textDrop.has(node.name)) continue;
    if (spaceAfter.has(node.name)) stack.push(' ');
    for (let i = (node.children?.length || 0) - 1; i >= 0; i--) stack.push(node.children[i]);
  }
  return parts.join('');
}

export function plainText(content) {
  if (typeof content !== 'string' || !content) return '';
  const ops = delta(content);
  return (ops ? deltaText(ops) : textOf(parseDocument(content).children)).replace(/\s+/g, ' ').trim();
}

function isPlain(nodes) {
  const stack = [...nodes];
  while (stack.length) {
    const node = stack.pop();
    if (node.name && (!plainTags.has(node.name) || Object.keys(node.attribs).some(attr =>
      ['style', 'class', 'colwidth'].includes(attr) || attr.startsWith('data-')))) return false;
    for (const child of node.children || []) stack.push(child);
  }
  return true;
}

// Slice the original blocks, keeping section boundaries usable without rewriting HTML.
export function splitSections(html) {
  const blocks = parseDocument(html, { withStartIndices: true }).children;
  const starts = [{ start: 0, heading: null }];
  for (const block of blocks) {
    if (/^h[1-3]$/.test(block.name)) starts.push({ start: block.startIndex, heading: textOf(block.children).replace(/\s+/g, ' ').trim() });
  }
  return starts.map((section, n) => {
    const content = html.slice(section.start, starts[n + 1]?.start ?? html.length);
    return { n, heading: section.heading, html: content, markdown: markdown.translate(content), plain: isPlain(parseDocument(content).children) };
  });
}

function time(value) {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : typeof value === 'string'
    ? (/^\d{4}-\d\d-\d\d(?:T|$)/.test(value) ? Date.parse(value) : Number(value)) : NaN;
  return Number.isFinite(number) && Math.abs(number) <= 8.64e15 ? number : null;
}
const day = value => time(value) === null ? null : days.format(time(value));
const tagsOf = item => Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string') : [];
const itemTitle = (item, kind) => label(kind === 'mom' ? item.title : item.name, kind === 'mom' ? 'Untitled meeting' : 'Untitled file');
const appUrl = (origin, item, kind) => new URL(kind === 'mom' ? `/#/mom/${encodeURIComponent(item.id)}` : `/#/areas/${encodeURIComponent(item.folderId)}`, origin).href;

// Used by both reads: fail closed on missing/moved groupings, broken chains and locks.
async function visiblePlace(get, uid, item, kind) {
  if (!item || !isVisible(item, uid) || (kind !== 'mom' && item.pw) || !validId(item.folderId)) return null;
  const chain = [], seen = new Set();
  let areaId = item.folderId;
  while (areaId) {
    if (!validId(areaId) || seen.has(areaId)) return null;
    seen.add(areaId);
    const area = await get('folders', areaId);
    if (!area || !isVisible(area, uid) || area.pw) return null;
    chain.push(area);
    if (area.parent != null && area.parent !== '' && !validId(area.parent)) return null;
    areaId = area.parent || null;
  }
  let path = chain.reverse().map(area => label(area.name, 'Untitled area')).join(' › ');
  const groupId = item[kind === 'mom' ? 'momFolderId' : 'docFolderId'];
  if (groupId != null && groupId !== '') {
    if (!validId(groupId)) return null;
    const collections = kind === 'mom' ? ['momfolders'] : ['docfolders', 'momfolders'];
    const groups = await Promise.all(collections.map(async collection => ({ collection, group: await get(collection, groupId) })));
    const match = groups.find(({ collection, group }) => group && group.folderId === item.folderId && isVisible(group, uid)
      && (kind === 'mom' || collection === 'docfolders' || group.holds === 'both'));
    if (!match) return null;
    path += ' › ' + label(match.group.name, 'Grouping');
  }
  return { path, areaIds: seen };
}

const fields = {
  folders: ['name', 'parent', 'privateTo', 'deleted', 'pw'],
  momfolders: ['name', 'folderId', 'holds', 'privateTo', 'deleted'],
  docfolders: ['name', 'folderId', 'privateTo', 'deleted'],
  moms: ['title', 'date', 'created', 'folderId', 'momFolderId', 'privateTo', 'deleted', 'tags', 'note', 'content'],
  docs: ['name', 'added', 'folderId', 'docFolderId', 'privateTo', 'deleted', 'pw', 'uploaded', 'url', 'note', 'tags'],
};

function snippet(body, words) {
  const lower = body.toLowerCase();
  const first = words.reduce((at, word) => Math.min(at, lower.indexOf(word)), body.length);
  const start = Math.max(0, first - 40), end = Math.min(body.length, start + 120);
  return (start ? '…' : '') + body.slice(start, end).trim() + (end < body.length ? '…' : '');
}

export async function findItems({ db, owner, origin }, input = {}) {
  const args = parse(findInputs, input, 'find_items');
  const words = (args.query || '').toLowerCase().split(/\s+/).filter(Boolean);
  return db.runTransaction(async transaction => {
    const records = Object.fromEntries(await Promise.all(Object.entries(fields).map(async ([collection, select]) => {
      const snapshot = await transaction.get(db.collection(collection).select(...select));
      return [collection, new Map(snapshot.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id }]))];
    })));
    const get = async (collection, id) => records[collection].get(id);
    const matches = [];
    for (const [collection, items] of [['moms', records.moms], ['docs', records.docs]]) {
      for (const item of items.values()) {
        const kind = collection === 'moms' ? 'mom' : item.uploaded === true ? 'file' : 'link';
        if (args.kind && args.kind !== kind) continue;
        const place = await visiblePlace(get, owner.uid, item, kind);
        if (!place || (args.areaId && !place.areaIds.has(args.areaId))) continue;
        const dateValue = kind === 'mom' ? item.date : item.added, date = day(dateValue);
        if ((args.from || args.to) && (!date || (args.from && date < args.from) || (args.to && date > args.to))) continue;
        const title = itemTitle(item, kind), tags = tagsOf(item), note = typeof item.note === 'string' ? item.note : '';
        const titleText = [title, ...tags, note].join(' ').toLowerCase();
        const metadata = [titleText, place.path].join(' ').toLowerCase();
        const bodyWords = words.filter(word => !metadata.includes(word));
        let body;
        if (bodyWords.length) {
          if (kind !== 'mom') continue;
          body = plainText(item.content);
          const lower = body.toLowerCase();
          if (!bodyWords.every(word => lower.includes(word))) continue;
        }
        matches.push({
          kind, id: item.id, title, date, path: place.path, tags,
          matchedIn: bodyWords.length ? 'body' : words.length && !words.some(word => titleText.includes(word)) ? 'place' : 'title',
          ...(bodyWords.length && { snippet: snippet(body, bodyWords) }), url: appUrl(origin, item, kind),
          ...(kind !== 'mom' && { address: typeof item.url === 'string' ? item.url : '', note }),
          time: time(dateValue) ?? -Infinity, created: time(item.created) ?? -Infinity,
        });
      }
    }
    matches.sort((a, b) => b.time - a.time || b.created - a.created || a.id.localeCompare(b.id) || a.kind.localeCompare(b.kind));
    return { items: matches.slice(0, 20).map(({ time, created, ...item }) => item), total: matches.length, hasMore: matches.length > 20 };
  }, { readOnly: true });
}

export async function readMom({ db, owner, origin }, input) {
  const args = parse(readInputs, input, 'read_mom');
  return db.runTransaction(async transaction => {
    const get = async (collection, id) => {
      const snapshot = await transaction.get(db.collection(collection).doc(id));
      return snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
    };
    const item = await get('moms', args.id);
    const place = await visiblePlace(get, owner.uid, item, 'mom');
    if (!place) throw new ConnectorError('No MoM with that id.');
    const content = typeof item.content === 'string' ? item.content : '', ops = delta(content);
    return {
      id: item.id, title: itemTitle(item, 'mom'), date: day(item.date), path: place.path, tags: tagsOf(item),
      url: appUrl(origin, item, 'mom'), edited: item.edited ?? null,
      format: ops ? 'old' : 'html', markdown: ops ? deltaText(ops).trim() : markdown.translate(content),
      ...(!ops && { sections: splitSections(content).map(({ html, ...section }) => section) }),
    };
  }, { readOnly: true });
}
