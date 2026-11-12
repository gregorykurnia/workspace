import { ConnectorError, getWorkbench, readSettings } from './firebase.mjs';
import { MAX_UPLOAD_BYTES, UploadError, saveUploadedFile, verifyUploadToken } from './files.mjs';

// Leave room for one multipart header while keeping the whole request below
// Vercel's 4.5 MB body limit, even without a trustworthy Content-Length.
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
const tooLarge = () => new UploadError('Files must be at most 4 MB; save it as a link instead.', 413);

async function readFile(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'multipart/form-data') {
    throw new UploadError('Send one file as multipart/form-data using the curl line from save_file.', 415);
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new UploadError('Choose one file to upload.', 400);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel().catch(() => {}); throw tooLarge(); }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError('The upload was interrupted. Send the complete file using the curl line from save_file.', 400);
  } finally { reader.releaseLock(); }
  let form;
  try { form = await new Response(new Blob(chunks), { headers: { 'Content-Type': request.headers.get('content-type') } }).formData(); }
  catch { throw new UploadError('The upload is not valid multipart data. Use the curl line from save_file.', 400); }
  const entries = [...form.entries()];
  if (entries.length !== 1 || entries[0][0] !== 'file' || typeof entries[0][1] === 'string') {
    throw new UploadError('Send exactly one file in the file field using the curl line from save_file.', 400);
  }
  const file = entries[0][1];
  if (file.size > MAX_UPLOAD_BYTES) throw tooLarge();
  return file;
}

export function createUploadHandler({ env = process.env, getContext = getWorkbench, uploadFetch = globalThis.fetch } = {}) {
  return async function handle(request) {
    const headers = { 'Cache-Control': 'no-store' };
    if (request.method !== 'POST') return Response.json({ error: 'Use POST with one file and the upload address from save_file.' }, { status: 405, headers: { ...headers, Allow: 'POST' } });
    try {
      const url = new URL(request.url);
      const token = url.pathname.match(/^\/api\/upload\/([^/]+)\/?$/)?.[1] || '';
      const args = verifyUploadToken(token, env.MCP_SECRET);
      const file = await readFile(request);
      verifyUploadToken(token, env.MCP_SECRET);
      const context = { ...await getContext(readSettings(env)), origin: url.origin, uploadFetch };
      return Response.json(await saveUploadedFile(context, args, file), { headers });
    } catch (error) {
      return Response.json({ error: error instanceof ConnectorError ? error.message : 'Could not confirm the file was saved. Check Workbench before retrying; it may have saved.' }, {
        status: error instanceof UploadError ? error.status : error instanceof ConnectorError ? 403 : 500, headers,
      });
    }
  };
}
