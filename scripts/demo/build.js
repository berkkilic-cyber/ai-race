#!/usr/bin/env node
/**
 * The free browser demo: a static web build of the game in demo mode, ready to upload to
 * itch.io as an HTML5 game.
 *
 *   npm run demo            # build dist-demo/site and dist-demo/ai-race-demo.zip
 *   SKIP_EXPORT=1 npm run demo   # re-run the packaging on an existing dist-demo/site/game
 *
 * Steps:
 *  1. `npx expo export --platform web --clear` with EXPO_PUBLIC_DEMO=1 into dist-demo/site/game.
 *  2. Make it run from any folder and inside an iframe: every absolute "/_expo/…" and
 *     "/assets/…" URL in the HTML and the JS chunks becomes relative ("./_expo/…"), and a small
 *     script at the top of game/index.html adds a <base> for the folder it was loaded from and
 *     shows the router "/" (itch serves the game from a path we cannot know at build time).
 *     Route pages other than index.html are dropped (the demo always enters at the start screen).
 *  3. A letterbox page (scripts/demo/wrapper.html) becomes the zip root's index.html; it frames
 *     game/index.html at a phone-like landscape shape.
 *  4. Zip the site (index.html at the zip root) and print its size.
 *
 * The full game build is unaffected: without EXPO_PUBLIC_DEMO the demo module is inert.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'dist-demo');
const SITE = path.join(OUT, 'site');
const GAME = path.join(SITE, 'game');
const ZIP = path.join(OUT, 'ai-race-demo.zip');

function log(msg) {
  console.log(`[demo] ${msg}`);
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/**
 * "/_expo/…", "/assets/…" and "/favicon.ico" in quotes or url() become relative (the page's
 * <base> resolves them). In JS, the async chunk map ({"763":"/_expo/…js"}) becomes an
 * expression on the folder the bootstrap found, because Expo resolves chunk URLs against
 * location (which shows the router "/"), not against <base>.
 */
function relativise(text, isJs) {
  let out = text;
  if (isJs) out = out.replace(/:"\.?\/_expo\//g, ':(window.__DEMO_BASE__||"/")+"_expo/');
  return out.replace(/(["'(=])\/(_expo\/|assets\/|favicon\.ico)/g, '$1./$2');
}

function themeBackground() {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'src/ui/theme.ts'), 'utf8');
    const neon = src.slice(src.indexOf('const neon'));
    const m = neon.match(/\bbg:\s*'(#[0-9A-Fa-f]{6})'/);
    if (m) return m[1];
  } catch {
    // fall through
  }
  return '#1B1C1F';
}

function exportGame() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(SITE, { recursive: true });
  log('expo export (web, EXPO_PUBLIC_DEMO=1) …');
  const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--clear', '--output-dir', GAME], {
    cwd: ROOT,
    env: { ...process.env, EXPO_PUBLIC_DEMO: '1' },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (r.status !== 0 || !fs.existsSync(path.join(GAME, 'index.html'))) throw new Error('expo export failed');
}

function patchGame() {
  // Only the start page: the demo enters there, and the router handles the rest in the page.
  for (const f of walk(GAME)) {
    const rel = path.relative(GAME, f);
    if (f.endsWith('.html') && rel !== 'index.html') fs.rmSync(f);
  }
  for (const d of fs.readdirSync(GAME, { withFileTypes: true })) {
    const p = path.join(GAME, d.name);
    if (d.isDirectory() && walk(p).length === 0) fs.rmSync(p, { recursive: true });
  }
  let changed = 0;
  for (const f of walk(GAME)) {
    if (!/\.(html|js|css)$/.test(f)) continue;
    const before = fs.readFileSync(f, 'utf8');
    const after = relativise(before, f.endsWith('.js'));
    if (after !== before) {
      fs.writeFileSync(f, after);
      changed++;
    }
  }
  const indexFile = path.join(GAME, 'index.html');
  let html = fs.readFileSync(indexFile, 'utf8');
  const boot = fs.readFileSync(path.join(__dirname, 'bootstrap.html'), 'utf8').trim();
  if (!html.includes('window.__DEMO_BASE__')) {
    html = html.replace(/(<meta charSet="utf-8"\/>|<meta charset="utf-8">)/i, `$1${boot}`);
    if (!html.includes('window.__DEMO_BASE__')) throw new Error('could not place the base-path script in index.html');
  }
  fs.writeFileSync(indexFile, html);
  const left = walk(GAME)
    .filter((f) => /\.(html|js|css)$/.test(f))
    .filter((f) => /["'(=]\/(_expo|assets)\//.test(fs.readFileSync(f, 'utf8')));
  if (left.length) throw new Error(`absolute asset paths left in: ${left.map((f) => path.relative(SITE, f)).join(', ')}`);
  log(`relative paths in ${changed} files; base-path script in game/index.html`);
}

function writeWrapper() {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
  const html = fs
    .readFileSync(path.join(__dirname, 'wrapper.html'), 'utf8')
    .replace(/__TITLE__/g, app.name)
    .replace(/__BG__/g, themeBackground());
  fs.writeFileSync(path.join(SITE, 'index.html'), html);
}

function zipSite() {
  fs.rmSync(ZIP, { force: true });
  let r = spawnSync('zip', ['-r', '-q', '-X', ZIP, '.'], { cwd: SITE, stdio: 'inherit' });
  if (r.error || r.status !== 0) {
    log('zip not found: using python3');
    r = spawnSync('python3', ['-c', 'import shutil,sys; shutil.make_archive(sys.argv[1][:-4], "zip", sys.argv[2])', ZIP, SITE], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('could not write the zip');
  }
}

function kb(n) {
  return `${(n / 1024).toFixed(0)} KB`;
}

function report() {
  const files = walk(SITE);
  let raw = 0;
  let gz = 0;
  const byKind = {};
  for (const f of files) {
    const buf = fs.readFileSync(f);
    raw += buf.length;
    const z = /\.(html|js|css|json|ttf|wav)$/.test(f) ? zlib.gzipSync(buf, { level: 9 }).length : buf.length;
    gz += z;
    const kind = path.extname(f).slice(1) || 'other';
    byKind[kind] = (byKind[kind] || 0) + buf.length;
  }
  log(`site: ${files.length} files, ${kb(raw)} raw, about ${kb(gz)} gzipped`);
  log(`by type: ${Object.entries(byKind)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${kb(v)}`)
    .join(', ')}`);
  log(`zip: ${path.relative(ROOT, ZIP)} (${kb(fs.statSync(ZIP).size)})`);
  // itch.io's HTML5 limits (itch.io/docs/creators/html5): 1,000 files, 500 MB, 200 MB a file,
  // paths up to 240 characters.
  const longest = files.map((f) => path.relative(SITE, f)).sort((a, b) => b.length - a.length)[0] || '';
  log(`itch limits: ${files.length}/1000 files, longest path ${longest.length}/240 characters`);
  if (files.length > 1000 || longest.length > 240 || raw > 500 * 1024 * 1024) throw new Error('over itch.io HTML5 limits');
  const links = fs.readFileSync(path.join(ROOT, 'src/ui/demo/links.ts'), 'utf8');
  if (/example\.com/.test(links)) log('WARNING: src/ui/demo/links.ts still has placeholder links (example.com). Fill them in before uploading.');
}

function main() {
  if (!process.env.SKIP_EXPORT) exportGame();
  else if (!fs.existsSync(path.join(GAME, 'index.html'))) throw new Error('SKIP_EXPORT set but dist-demo/site/game is missing');
  patchGame();
  writeWrapper();
  zipSite();
  report();
}

try {
  main();
} catch (e) {
  console.error(`[demo] ${e.message}`);
  process.exit(1);
}
