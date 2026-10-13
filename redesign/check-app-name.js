#!/usr/bin/env node
/* The product name lives in one constant, APP_NAME in js/ui/core.js (plan Q2). The two places that
   can't read it at run time (the page's <title> before the script runs, and the manifest) must say
   the same thing. Fails if they drift. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const name = (/const APP_NAME = '([^']+)'/.exec(read('js/ui/core.js')) || [])[1];
const page = fs.existsSync(path.join(root, 'index.html')) ? 'index.html' : 'next.html';
const title = (/<title>([^<]*)<\/title>/.exec(read(page)) || [])[1];
const manifest = JSON.parse(read('manifest.webmanifest'));
const bad = [];
if (!name) bad.push('APP_NAME not found in js/ui/core.js');
if (title !== name) bad.push(`${page} <title> is "${title}", APP_NAME is "${name}"`);
if (manifest.name !== name) bad.push(`manifest name is "${manifest.name}"`);
if (manifest.short_name !== name) bad.push(`manifest short_name is "${manifest.short_name}"`);
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`Product name check passed: "${name}" in APP_NAME, ${page} and the manifest.`);
