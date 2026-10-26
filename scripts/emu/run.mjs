// Runs inside `firebase emulators:exec`: seeds the emulators, serves the app, runs Playwright against it
// (extra arguments go to Playwright), then stops its own server. The emulators stop when this ends.
import { spawn } from 'node:child_process';
import { seed } from './seed.mjs';
import { serve } from './serve.mjs';
import { ADMIN, MEMBER, STRANGER, PASSWORD } from './accounts.mjs';

await seed();
const { server, url } = await serve();
const env = {
  ...process.env, EMU: '1', BASE_URL: url,
  TEST_EMAIL: ADMIN.email, TEST_PASSWORD: PASSWORD,
  TEST_MEMBER_EMAIL: MEMBER.email, TEST_MEMBER_PASSWORD: PASSWORD,
  TEST_STRANGER_EMAIL: STRANGER.email,
};
const child = spawn('npx', ['playwright', 'test', '--project=chromium', ...process.argv.slice(2)], { env, stdio: 'inherit' });
child.on('exit', code => { server.close(); process.exit(code ?? 1); });
