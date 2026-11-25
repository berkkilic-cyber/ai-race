/**
 * Shared helpers for the marketing scripts (shots.js, clips.js): a static server for the full
 * web build in dist/, headless Chrome, and the `?debug=1` handles (window.__game, window.__garage).
 * Marketing media show the full game, not the demo: build with `npx expo export --platform web`.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const FFMPEG = process.env.FFMPEG || '/usr/local/bin/ffmpeg';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.wav': 'audio/wav' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Builds dist/ (full game, no demo flag) unless it exists or SKIP_BUILD is set. */
function ensureBuild() {
  if (fs.existsSync(path.join(DIST, 'index.html')) && !process.env.REBUILD) return;
  console.log('building dist/ (npx expo export --platform web) …');
  const env = { ...process.env };
  delete env.EXPO_PUBLIC_DEMO;
  const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--clear'], { cwd: ROOT, env, stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) throw new Error('expo export failed');
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    for (const c of [url, `${url}.html`, path.join(url, 'index.html')]) {
      const file = path.join(DIST, c);
      if (file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    fs.createReadStream(path.join(DIST, 'index.html')).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function launch() {
  return puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--lang=en-US', '--hide-scrollbars'] });
}

/**
 * CSS that hides what a marketing image should not show: the build stamp, achievement toasts,
 * rewarded-ad offers and banner slots, the debug overlays, and launch banners (a fast-forward
 * queues dozens of them; they would cover the map). Nothing else is changed.
 */
const CLEAN_CSS = [
  '[data-testid="build-stamp"]',
  '[data-testid="achievement-toast"]',
  '[data-testid="garage-offer-slot"]',
  '[data-testid="map-debug"]',
  '[data-testid="perf-hud"]',
  '[data-testid="ad-banner-slot"]',
  '[data-testid^="launch-banner"]',
].join(',') + '{display:none !important}';

/** Opens a new page with error collection. */
async function newPage(browser, { width, height, scale }) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  page.errors = errors;
  return page;
}

async function clean(page) {
  await page.addStyleTag({ content: CLEAN_CSS });
}

/** Starts a race run (autostart) and stops its clock. */
async function startRun(page, base, { seed, lang, runLength = 'full', difficulty = null }) {
  await page.goto(`${base}/?autostart=1&debug=1&seed=${seed}&lang=${lang}&runLength=${runLength}${difficulty ? `&difficulty=${difficulty}` : ''}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 20000 });
  await page.evaluate(() => window.__game.store.getState().setSpeed(0));
  await clean(page);
}

/** Opens the Garage with its debug handle. */
async function openGarage(page, base, lang) {
  await page.goto(`${base}/garage?debug=1&lang=${lang}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => !!window.__garage && !!window.__garage.state(), { timeout: 20000 });
  await clean(page);
}

/** Converts a PNG to opaque RGB (the App Store refuses alpha channels). */
function toRgbPng(src, dest) {
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', src, '-pix_fmt', 'rgb24', dest], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${src}`);
}

module.exports = { ROOT, DIST, FFMPEG, sleep, ensureBuild, serve, launch, newPage, clean, startRun, openGarage, toRgbPng, CLEAN_CSS };
