import { createHash, timingSafeEqual } from 'node:crypto';
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { ConnectorError, getWorkbench, readSettings } from './firebase.mjs';
import { INSTRUCTIONS } from './instructions.mjs';
import { listPlaces } from './places.mjs';

const inputs = z.object({ query: z.string().trim().optional().describe('Client, project or topic words; omit to see all places.') });
const digest = value => createHash('sha256').update(value).digest();

function rpcError(code, message, id = null, status = 400) {
  return Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function createHandler({ env = process.env, getContext = getWorkbench } = {}) {
  return async function handle(request) {
    const url = new URL(request.url);
    let secret;
    try { secret = decodeURIComponent(url.pathname.match(/^\/api\/mcp\/([^/]+)\/?$/)?.[1] || ''); } catch { secret = ''; }
    const expected = env.MCP_SECRET;
    if (!expected?.trim() || !timingSafeEqual(digest(expected), digest(secret))) {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    if (request.method !== 'POST') {
      const response = rpcError(-32000, 'Use POST to send an MCP request. This server does not keep sessions.', null, 405);
      response.headers.set('Allow', 'POST');
      return response;
    }
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return rpcError(-32000, 'Send the request as application/json.', null, 415);
    }
    let body;
    try { body = await request.clone().json(); } catch {
      return rpcError(-32700, 'The request is not valid JSON. Check its punctuation and try again.');
    }
    const parsed = JSONRPCMessageSchema.safeParse(body);
    if (!parsed.success) return rpcError(-32600, 'Send one JSON-RPC 2.0 message with a method and a valid request ID.');
    const rpc = parsed.data;
    const id = 'id' in rpc ? rpc.id : null;
    if ('method' in rpc && rpc.method === 'tools/call' && rpc.params?.name === 'list_places') {
      if (!inputs.safeParse(rpc.params.arguments === undefined ? {} : rpc.params.arguments).success) {
        return rpcError(-32602, 'Check list_places inputs: query must be text.', id);
      }
    }
    try {
      const settings = readSettings(env);
      // Strip the secret and query before the adapter sees any URL it might log.
      url.pathname = '/api/mcp';
      url.search = '';
      const handler = createMcpHandler(server => {
        server.registerTool('list_places', {
          description: 'Find visible Workbench areas with full paths, groupings, and up to three recent MoM titles (none for locked areas). Search client, project or topic words; omit query if nothing matches. Pick MoM, link or file, propose title and full path with a reason, and save only after the owner says yes in chat (a tool approval is not a yes); do not ask again if the owner already named place and form. Never invent a place. Return its link after saving; ask before retrying a save whose answer was lost.',
          inputSchema: inputs.shape,
          annotations: { readOnlyHint: true, openWorldHint: false },
        }, async args => {
          try {
            const value = await listPlaces(await getContext(settings), args);
            return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
          } catch (error) {
            return { isError: true, content: [{ type: 'text', text: error instanceof ConnectorError ? error.message : 'Could not read Workbench places. Try again shortly.' }] };
          }
        });
      }, {
        serverInfo: { name: 'Workbench', version: '1.0.0' }, instructions: INSTRUCTIONS,
      }, { basePath: '/api', disableSse: true, sessionIdGenerator: undefined, maxDuration: 60 });
      const forwarded = new Request(url, request);
      // The pinned adapter checks this value case sensitively, unlike HTTP media types.
      forwarded.headers.set('Content-Type', 'application/json');
      const response = await handler(forwarded);
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } catch (error) {
      return rpcError(-32603, error instanceof ConnectorError ? error.message : 'Could not handle the Workbench request. Try again shortly.', id, 500);
    }
  };
}
