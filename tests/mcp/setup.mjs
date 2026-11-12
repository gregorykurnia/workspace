import { assertEmulatorEnv } from './emulator-guard.mjs';
import { after, mock } from 'node:test';

// Every test entry imports this before creating any Firebase client.
assertEmulatorEnv();

// mcp-handler 1.1.0 retains a 30-second housekeeping interval even in stateless
// mode, with no disposal API. Track just that interval and clear it at teardown.
const housekeeping = new Set();
const setInterval = globalThis.setInterval;
const intervals = mock.method(globalThis, 'setInterval', (...args) => {
  const timer = setInterval(...args);
  if (args[1] === 30_000) housekeeping.add(timer);
  return timer;
});
after(() => {
  for (const timer of housekeeping) clearInterval(timer);
  intervals.mock.restore();
});

export const SECRET = 'c1-test-address';
export const OWNER_EMAIL = 'c1-owner@example.test';
export const OWNER_UID = 'c1-owner';

export function request(body, { method = 'POST', secret = SECRET, headers = {}, raw = false } = {}) {
  return new Request(`http://localhost/api/mcp/${secret}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    ...(!['GET', 'HEAD'].includes(method) && { body: raw ? body : JSON.stringify(body) }),
    signal: AbortSignal.timeout(8000),
  });
}

export const rpc = (method, params = {}, id = 1) => ({ jsonrpc: '2.0', id, method, params });

export async function rpcResponse(handler, body) {
  const response = await handler(request(body));
  const text = await response.text();
  const data = response.headers.get('content-type')?.includes('text/event-stream')
    ? JSON.parse(text.split('\n').find(line => line.startsWith('data: ')).slice(6))
    : text ? JSON.parse(text) : null;
  return { response, data };
}
