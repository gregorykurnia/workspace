// npm run test:emu -- <playwright args>: starts the Auth and Firestore emulators around scripts/emu/run.mjs.
import { spawn } from 'node:child_process';
import { PROJECT } from './accounts.mjs';

const quote = a => `'${String(a).replace(/'/g, `'\\''`)}'`;
const inner = ['node', 'scripts/emu/run.mjs', ...process.argv.slice(2)].map((a, i) => (i < 2 ? a : quote(a))).join(' ');
const child = spawn('npx', ['firebase', 'emulators:exec', '--only', 'auth,firestore', '--project', PROJECT, inner], { stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 1));
