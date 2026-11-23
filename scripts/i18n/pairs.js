/**
 * The English strings files and their Turkish siblings, found by name so new feature files
 * are picked up without editing this list:
 *   src/ui/strings/<x>.en.json  <->  src/ui/strings/<x>.tr.json   (en.json <-> tr.json)
 *   src/content/packs/<pack>/strings/en.json  <->  .../strings/tr.json
 *   src/content/packs/<pack>/**\/strings.en.json  <->  strings.tr.json
 * Shared by `npm run i18n:check` and the Jest test (src/ui/locale/__tests__).
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function trSibling(enFile) {
  const base = path.basename(enFile);
  const dir = path.dirname(enFile);
  if (base === 'en.json') return path.join(dir, 'tr.json');
  return path.join(dir, base.replace(/\.en\.json$/, '.tr.json'));
}

/** [{ en, tr, name }] with absolute paths; `tr` may not exist yet. */
function stringPairs(root = ROOT) {
  const files = [...walk(path.join(root, 'src', 'ui', 'strings')), ...walk(path.join(root, 'src', 'content', 'packs'))];
  return files
    .filter((f) => /(^|[\\/.])en\.json$/.test(path.basename(f)) && (path.basename(f) === 'en.json' || path.basename(f).endsWith('.en.json')))
    .filter((f) => f.includes(`${path.sep}strings${path.sep}`) || path.basename(f).startsWith('strings.'))
    .sort()
    .map((en) => ({ en, tr: trSibling(en), name: path.relative(root, en) }));
}

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});

/** Placeholder names of a string, sorted and de-duplicated: "{lab} in {region}" -> "lab,region". */
const placeholders = (text) => [...new Set([...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(',');

module.exports = { ROOT, stringPairs, readJson, placeholders };
