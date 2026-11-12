import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { ConnectorError } from './firebase.mjs';
import { destination } from './destinations.mjs';

const id = z.string().trim().min(1).refine(value => !value.includes('/') && !['.', '..'].includes(value) && Buffer.byteLength(value) <= 1500);
const place = { areaId: id, groupId: id.optional() };
const LINK_TYPE = { link: 'link', slides: 'presentation', pdf: 'pdf', sheet: 'spreadsheet', image: 'image', other: 'other' };
export const MAX_CONTENT_BYTES = 500 * 1024;

export const momInputs = z.object({
  ...place, title: z.string().trim().min(1), date: z.iso.date().optional(),
  markdown: z.string(), tags: z.array(z.string()).optional(),
});
export const linkInputs = z.object({
  ...place, name: z.string().trim().min(1), url: z.string().trim(),
  kind: z.enum(Object.keys(LINK_TYPE)).optional(), note: z.string().trim().optional(),
});
export const inputMessages = {
  save_mom: 'Check save_mom inputs: choose an area, give a nonempty title and markdown text, and use yyyy-mm-dd for the optional date.',
  save_link: 'Check save_link inputs: choose an area, give a nonempty name and web address, and use a supported link kind.',
};

const markdown = new Marked({
  gfm: true,
  renderer: {
    checkbox({ checked }) { return checked ? '☑ ' : '☐ '; },
    heading({ depth, tokens }) {
      const level = Math.min(depth, 3);
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    },
  },
});

function checkSize(text) {
  if (Buffer.byteLength(text, 'utf8') > MAX_CONTENT_BYTES) {
    throw new ConnectorError('MoM content is over 500 KB. Shorten it or save it as a file instead.');
  }
}

export function markdownToHtml(text) {
  checkSize(text);
  const html = sanitizeHtml(markdown.parse(text), {
    allowedTags: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: { a: ['href', 'title'], ol: ['start'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedSchemes: ['http', 'https', 'mailto'], allowProtocolRelative: false,
    transformTags: {
      del: 's',
      a(tagName, attribs) {
        // sanitize-html also permits relative URLs by default; saved notes only
        // link out through the three schemes the spec allows.
        try {
          if (!['http:', 'https:', 'mailto:'].includes(new URL(attribs.href).protocol)) delete attribs.href;
        } catch { delete attribs.href; }
        return { tagName, attribs };
      },
    },
  });
  checkSize(html);
  return html;
}

function parse(schema, args, tool) {
  const parsed = schema.safeParse(args);
  if (!parsed.success) throw new ConnectorError(inputMessages[tool]);
  return parsed.data;
}

// Match the app's automatic kind when the caller hasn't picked a tile explicitly.
function guessKind(url) {
  const value = url.toLowerCase();
  if (value.includes('presentation') || value.includes('slides') || value.endsWith('.pptx')) return 'slides';
  if (value.includes('spreadsheets') || value.includes('sheets') || value.endsWith('.xlsx')) return 'sheet';
  if (value.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(value)) return 'image';
  return 'link';
}

async function writeItem({ db, owner, origin }, args, kind, fields) {
  const ref = db.collection(kind === 'mom' ? 'moms' : 'docs').doc();
  const url = new URL(kind === 'mom' ? `/#/mom/${ref.id}` : `/#/areas/${encodeURIComponent(args.areaId)}`, origin).href;
  return db.runTransaction(async transaction => {
    const place = await destination(transaction, db, owner.uid, args, kind);
    transaction.create(ref, {
      id: ref.id, folderId: args.areaId, ...fields, privateTo: place.privateTo,
      createdBy: { uid: owner.uid, name: owner.name }, source: 'claude-chat',
      ...(args.groupId && { [kind === 'mom' ? 'momFolderId' : 'docFolderId']: args.groupId }),
    });
    return { id: ref.id, path: place.path, url };
  });
}

export async function saveMom(context, input, now = Date.now()) {
  const args = parse(momInputs, input, 'save_mom');
  const content = markdownToHtml(args.markdown);
  const day = args.date || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  return writeItem(context, args, 'mom', {
    title: args.title, date: new Date(`${day}T00:00:00+07:00`).getTime(),
    content, tags: args.tags || [], starred: false, created: now, edited: now,
  });
}

export async function saveLink(context, input, now = Date.now()) {
  const args = parse(linkInputs, input, 'save_link');
  try {
    const url = new URL(args.url);
    if (!/^https?:\/\//i.test(args.url) || !['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new ConnectorError('Use a complete http:// or https:// web address for the link.');
  }
  return writeItem(context, args, 'file', {
    name: args.name, type: LINK_TYPE[args.kind || guessKind(args.url)],
    url: args.url, note: args.note || '', added: now,
  });
}
