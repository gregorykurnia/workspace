import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { ConnectorError } from './firebase.mjs';
import { destination } from './destinations.mjs';
import { inputMessages, linkInputs, writeItem } from './saves.mjs';

export const MAX_INLINE_BYTES = 1024 * 1024;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const UPLOAD_LIFETIME = 15 * 60 * 1000;
const extension = name => name.split('.').pop().toLowerCase();
const metadata = linkInputs.pick({ areaId: true, groupId: true, name: true, note: true }).extend({
  name: z.string().trim().min(1).refine(name => /^.+\.[a-z0-9]+$/i.test(name) && !/[\x00-\x1f\x7f/\\]/.test(name)),
});
export const fileInputs = metadata.extend({ text: z.string().optional(), base64: z.string().optional() })
  .refine(args => args.text === undefined || args.base64 === undefined);
const tokenInputs = metadata.extend({ exp: z.number().int().positive() }).strict();
const signature = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');
const mimeTypes = {
  md: 'text/markdown', html: 'text/html', csv: 'text/csv', txt: 'text/plain', json: 'application/json',
  svg: 'image/svg+xml', pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', tiff: 'image/tiff', ico: 'image/x-icon',
  mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm',
};

export class UploadError extends ConnectorError {
  constructor(message, status) { super(message); this.status = status; }
}

export function verifyUploadToken(token, secret, now = Date.now()) {
  const forbidden = () => new UploadError('This upload address is invalid or expired. Ask for a new one with save_file.', 403);
  if (typeof secret !== 'string' || !secret.trim()) throw forbidden();
  const parts = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!parts || !timingSafeEqual(Buffer.from(signature(parts[1], secret)), Buffer.from(parts[2]))) throw forbidden();
  try {
    const decoded = Buffer.from(parts[1], 'base64url');
    if (decoded.toString('base64url') !== parts[1]) throw forbidden();
    const parsed = tokenInputs.safeParse(JSON.parse(decoded.toString('utf8')));
    if (!parsed.success || parsed.data.exp <= now) throw forbidden();
    return parsed.data;
  } catch { throw forbidden(); }
}

async function checkDestination({ db, owner }, args) {
  return db.runTransaction(transaction => destination(transaction, db, owner.uid, args, 'file'));
}

function inlineFile(args) {
  let bytes;
  if (args.text !== undefined) {
    if (!['md', 'html', 'csv', 'txt', 'json', 'svg'].includes(extension(args.name))) {
      throw new ConnectorError('Use text only for md, html, csv, txt, json or svg files. Use base64 or an upload address for other files.');
    }
    bytes = Buffer.from(args.text, 'utf8');
  } else {
    const encoded = args.base64.replace(/[\t\n\r ]/g, '');
    if (encoded.length > Math.ceil(MAX_INLINE_BYTES / 3) * 4) {
      throw new UploadError('Inline files must be at most 1 MB. Request an upload address by omitting text and base64.', 413);
    }
    bytes = Buffer.from(encoded, 'base64');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || (encoded.includes('=') && encoded.length % 4 !== 0)
      || bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
      throw new ConnectorError('The file is not valid base64. Encode the file contents as base64 or request an upload address.');
    }
  }
  if (bytes.length > MAX_INLINE_BYTES) {
    throw new UploadError('Inline files must be at most 1 MB. Request an upload address by omitting text and base64.', 413);
  }
  return new Blob([bytes], { type: mimeTypes[extension(args.name)] || 'application/octet-stream' });
}

// Keep the image/video/raw routing used by js/data/uploads.js, including raw PDFs.
function cloudType(file, name) {
  if (/^image\//i.test(file.type) || /\.(png|jpg|jpeg|gif|webp|bmp|svg|tiff|ico)$/i.test(name)) return 'image';
  if (/^video\//i.test(file.type) || /\.(mp4|mov|avi|mkv|webm)$/i.test(name)) return 'video';
  return 'raw';
}

async function uploadCloudinary({ uploadFetch = globalThis.fetch }, args, file) {
  const type = cloudType(file, args.name);
  const form = new FormData();
  form.append('file', file, args.name);
  form.append('upload_preset', 'workspace_uploads');
  let response, data;
  try {
    response = await uploadFetch(`https://api.cloudinary.com/v1_1/dgznvawnm/${type}/upload`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new UploadError('Could not upload the file to storage. Check your connection or save it as a link instead.', 502);
  }
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const message = typeof data?.error?.message === 'string' ? data.error.message.toLowerCase() : '';
    if (response.status === 413 || /too large|file size|exceeds.*(size|limit)/.test(message)) {
      throw new UploadError('This file is too large for storage; save it as a link instead.', 413);
    }
    if (response.status === 400 && /format|not allowed|file type/.test(message)) {
      throw new UploadError('This file type is not accepted by storage. Save it as a link instead.', 502);
    }
    throw new UploadError('File storage is unavailable. Save it as a link instead.', 502);
  }
  try {
    if (new URL(data.secure_url).protocol !== 'https:' || data.resource_type !== type) throw new Error();
  } catch {
    throw new UploadError('Storage did not return a usable file address. Save it as a link instead.', 502);
  }
  return { url: data.secure_url, cloudType: type, format: typeof data.format === 'string' && data.format ? data.format : extension(args.name) };
}

export async function saveUploadedFile(context, args, file, now = Date.now()) {
  // Refuse stale destinations before sending bytes outside Workbench. writeItem
  // checks again in its transaction, including changes made during the upload.
  await checkDestination(context, args);
  const stored = await uploadCloudinary(context, args, file);
  return writeItem(context, args, 'file', {
    ...stored, name: args.name, note: args.note || '', added: now,
    uploaded: true, type: stored.cloudType, starred: false,
  });
}

export async function saveFile(context, input, now = Date.now()) {
  const parsed = fileInputs.safeParse(input);
  if (!parsed.success) throw new ConnectorError(inputMessages.save_file);
  const args = parsed.data;
  if (args.text !== undefined || args.base64 !== undefined) return saveUploadedFile(context, args, inlineFile(args), now);
  await checkDestination(context, args);
  if (typeof context.uploadSecret !== 'string' || !context.uploadSecret.trim()) throw new ConnectorError('Missing setting: MCP_SECRET.');
  const exp = now + UPLOAD_LIFETIME;
  const payload = Buffer.from(JSON.stringify({ areaId: args.areaId, groupId: args.groupId, name: args.name, note: args.note || '', exp })).toString('base64url');
  const uploadUrl = `${context.origin}/api/upload/${payload}.${signature(payload, context.uploadSecret)}`;
  return { uploadUrl, expiresAt: new Date(exp).toISOString(), curl: `curl -sS -F file=@<path> '${uploadUrl}'` };
}
