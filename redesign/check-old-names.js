#!/usr/bin/env node
/* Old-names check (plan §10). Fails if any class or id that only the OLD UI used appears as a class
   or id in index.html, css/ or js/. The list is redesign/old-names.txt, generated once from the old
   files before they were deleted. Plain words in copy don't count: only class="…" attributes,
   classList calls, selector strings handed to $ / $$ / querySelector / closest / matches,
   getElementById, id="…", and the selectors in the stylesheets.
   Usage: node redesign/check-old-names.js [file or folder …]   (default: index.html, next.html, css, js, dev) */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const list = fs.readFileSync(path.join(__dirname, 'old-names.txt'), 'utf8').split('\n');
const OLD = { classes: new Set(), ids: new Set() };
let section = '';
list.forEach(l => { l = l.trim(); if (!l || l[0] === '#') return; if (l === '[classes]') section = 'classes'; else if (l === '[ids]') section = 'ids'; else if (section) OLD[section].add(l); });

const cssNames = css => {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{/g; let m;
  while ((m = re.exec(css))) {
    const pre = m[1].trim(); if (pre.startsWith('@')) continue;
    pre.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '')
      .replace(/\.(-?[_a-zA-Z][\w-]*)/g, (_, n) => { out.push(['class', n, pre.slice(0, 60)]); return ''; })
      .replace(/#(-?[_a-zA-Z][\w-]*)/g, (_, n) => out.push(['id', n, pre.slice(0, 60)]));
  }
  return out;
};
const markupNames = src => {
  const out = []; let m;
  const addCls = (v, ctx) => String(v).replace(/\$\{[^}]*\}/g, ' ').split(/[\s'"+]+/).forEach(c => { if (/^-?[_a-zA-Z][\w-]*$/.test(c)) out.push(['class', c, ctx]); });
  const rc = /\bclass(?:Name)?\s*=\s*(["'])((?:(?!\1)[\s\S])*?)\1/g; while ((m = rc.exec(src))) addCls(m[2], m[0].slice(0, 60));
  const rl = /classList\.(?:add|remove|toggle|contains|replace)\(([^)]*)\)/g; while ((m = rl.exec(src))) (m[1].match(/'([^']*)'|"([^"]*)"/g) || []).forEach(s => addCls(s.slice(1, -1), m[0].slice(0, 60)));
  const ri = /\bid\s*=\s*\\?["']([^"'\\]+)\\?["']/g; while ((m = ri.exec(src))) if (!/\$\{|\+/.test(m[1])) out.push(['id', m[1], m[0].slice(0, 60)]);
  const rg = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g; while ((m = rg.exec(src))) out.push(['id', m[1], m[0]]);
  const rq = /(?:querySelector(?:All)?|closest|matches|\$\$?)\(\s*(['"`])([^'"`]*)\1/g;
  while ((m = rq.exec(src))) m[2].replace(/\[[^\]]*\]/g, '').replace(/\.(-?[_a-zA-Z][\w-]*)/g, (_, n) => { out.push(['class', n, m[0].slice(0, 60)]); return ''; }).replace(/#(-?[_a-zA-Z][\w-]*)/g, (_, n) => out.push(['id', n, m[0].slice(0, 60)]));
  return out;
};
const walk = p => {
  if (!fs.existsSync(p)) return [];
  if (fs.statSync(p).isFile()) return [p];
  return fs.readdirSync(p, { withFileTypes: true }).flatMap(e => e.name === 'node_modules' ? [] : walk(path.join(p, e.name)));
};
const targets = (process.argv.length > 2 ? process.argv.slice(2) : ['index.html', 'next.html', 'css', 'js', 'dev']).map(t => path.resolve(ROOT, t));
const files = targets.flatMap(walk).filter(f => /\.(html|css|js)$/.test(f));
const hits = [];
files.forEach(f => {
  const src = fs.readFileSync(f, 'utf8');
  const names = /\.css$/.test(f) ? cssNames(src) : markupNames(src);
  names.forEach(([kind, n, ctx]) => { if ((kind === 'class' ? OLD.classes : OLD.ids).has(n)) hits.push(`${path.relative(ROOT, f)}: old ${kind} "${n}" in ${ctx.replace(/\s+/g, ' ')}`); });
});
const uniq = [...new Set(hits)];
if (uniq.length) { console.error(uniq.join('\n') + `\n\n${uniq.length} old name${uniq.length === 1 ? '' : 's'} found.`); process.exit(1); }
console.log(`Old-names check passed: ${files.length} files, ${OLD.classes.size} old classes and ${OLD.ids.size} old ids not used.`);
