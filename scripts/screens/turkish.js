#!/usr/bin/env node
/**
 * The main screens in Turkish (`?lang=tr`), at two landscape phone sizes, with a text scan
 * for raw keys, unreplaced placeholders and English leftovers.
 *
 *   npx expo export --platform web && node scripts/screens/turkish.js [outDir]
 *
 * Shots (per size, into docs/screenshots/tr/<w>x<h>/): the start flow (every step and How to
 * play), the map mid-game, a region panel, the trees tab with a node sheet, an event card and
 * its result, the news and race tabs, the end screen, the first tutorial steps, the Garage main
 * screen and the Garage settings with the language row. Then it switches the language back to
 * English with the row and checks the text changes without a reload.
 *
 * English leftovers: a visible line that is exactly an English string whose Turkish text
 * differs, or a line with several common English words. Exits non-zero when anything is found.
 * Env: CHROME (default /usr/bin/google-chrome), SIZES (default "926x428,844x390"),
 *      INSETS (default 0,47,21,47), SEED (default 7).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { scanText, textScanSummary } = require('./textScan');
const { stringPairs, readJson } = require('../i18n/pairs');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots', process.env.LOCALE === 'en' ? 'tr-compare-en' : 'tr'));
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SIZES = (process.env.SIZES || '926x428,844x390').split(',').map((s) => s.split('x').map(Number));
const INSETS = process.env.INSETS ?? '0,47,21,47';
const SEED = Number(process.env.SEED || 7);
/** LOCALE=en takes the same shots in English, for comparison (no English scan then). */
const LOCALE = process.env.LOCALE || 'tr';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ── English leftovers ──
const englishOnly = new Set();
for (const pair of stringPairs()) {
  const en = readJson(pair.en);
  const tr = readJson(pair.tr);
  for (const [k, v] of Object.entries(en)) {
    if (/\{\w+\}/.test(v) || v.length < 4 || !/[a-z]/i.test(v)) continue;
    if (tr[k] !== undefined && tr[k] !== v) englishOnly.add(v.trim().toLowerCase());
  }
}
// Shared with Turkish, or proper names: never leftovers on their own.
for (const v of ['hype', 'model', 'agi', 'garage zekâ labs']) englishOnly.delete(v);
const ENGLISH_WORDS = new Set(['the', 'and', 'your', 'you', 'with', 'for', 'from', 'not', 'yet', 'this', 'that', 'here', 'tap', 'buy', 'build', 'next', 'back', 'close', 'day', 'more', 'less', 'region', 'regions', 'users', 'cash', 'compute', 'tier', 'upgrade', 'upgrades', 'needs', 'have', 'into', 'of', 'to', 'in', 'is', 'are', 'its', 'now', 'all']);
const leftovers = new Map();

async function scanEnglish(page, name) {
  const texts = await page.evaluate(() => {
    const out = [document.body ? document.body.innerText : ''];
    for (const el of document.querySelectorAll('[aria-label]')) out.push(el.getAttribute('aria-label') || '');
    return out;
  });
  for (const text of texts) {
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || /^build /i.test(line)) continue;
      const lower = line.toLowerCase();
      const words = lower.split(/[^a-zçğıöşüâ]+/).filter(Boolean);
      const english = words.filter((w) => ENGLISH_WORDS.has(w)).length;
      if (englishOnly.has(lower) || (words.length >= 3 && english >= 3) || (words.length > 0 && words.length < 3 && english === words.length && englishOnly.has(lower))) {
        const hit = `"${line.slice(0, 100)}"`;
        if (!leftovers.has(hit)) leftovers.set(hit, name);
      }
    }
  }
}

async function runSize(browser, width, height, base) {
  const dir = path.join(OUT, `${width}x${height}`);
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && /AI-RACE ERROR/.test(m.text())) errors.push(m.text());
  });
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  const q = `lang=${LOCALE}${INSETS ? `&insets=${INSETS}` : ''}`;
  const tag = `${width}x${height}`;
  const shot = async (name) => {
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await sleep(400);
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
    await scanText(page, `${tag}/${name}`);
    if (LOCALE === 'tr') await scanEnglish(page, `${tag}/${name}`);
    console.log(`saved ${path.relative(ROOT, path.join(dir, `${name}.png`))}`);
  };
  const has = (sel) => page.$(sel).then((el) => !!el);
  const click = async (sel, wait = 500) => {
    await page.waitForSelector(sel, { timeout: 8000 });
    await page.click(sel);
    await sleep(wait);
  };
  const tabs = () => page.$$('[role="tab"]');
  const advance = (n, opts) => page.evaluate((n, opts) => window.__game.advance(n, opts), n, opts);
  const forceEvent = (eventId) =>
    page.evaluate((eventId) => {
      const store = window.__game.store;
      const s = store.getState().state;
      store.setState({ eventResult: null, state: { ...s, pendingEvent: { eventId, labId: s.playerLabId } } });
    }, eventId);

  // ── Start flow ──
  await page.goto(`${base}/?debug=1&${q}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}/?debug=1&${q}`, { waitUntil: 'networkidle0' });
  await sleep(800);
  await shot('start-0-mode');
  if (await has('[data-testid="mode-race"]')) await click('[data-testid="mode-race"]');
  if (await has('[data-testid="start-dice"]')) await click('[data-testid="start-dice"]');
  await shot('start-1-name');
  if (await has('[data-testid="start-howto-open"]')) {
    await click('[data-testid="start-howto-open"]');
    await shot('start-howto');
    await click('[data-testid="start-howto-close"]');
  }
  await click('[data-testid="start-next"]');
  if (await has('[data-testid="founder-hustler"]')) await click('[data-testid="founder-hustler"]');
  await shot('start-2-founder');
  await click('[data-testid="start-next"]', 1200);
  await shot('start-3-region-empty');
  await click('[data-testid="start-region-list"]');
  await page.type('[data-testid="start-region-search"]', 'tür');
  await sleep(300);
  await shot('start-3-region-list');
  await click('[data-testid="region-row-turkiye"]', 900);
  await shot('start-3-region');

  // ── A run mid-game ──
  await page.goto(`${base}/?autostart=1&debug=1&seed=${SEED}&${q}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 15000 });
  await page.evaluate(() => window.__game.store.getState().setSpeed(0));
  await page.addStyleTag({ content: '[data-testid="achievement-toast"]{display:none !important}' });
  await advance(900, { bot: true });
  await sleep(1500);
  await shot('game-1-map');
  await click('[data-testid="map-regions"]', 800);
  await shot('game-2-regions-list');
  const home = await page.evaluate(() => {
    const s = window.__game.store.getState().state;
    return s.labs[s.playerLabId].homeRegion;
  });
  await click(`[data-testid="regions-row-${home}"]`, 1200);
  await shot('game-3-region-panel');
  const t = await tabs();
  await t[1].click();
  await sleep(1000);
  await shot('game-4-trees');
  const node = await page.evaluate(() => {
    const tile = document.querySelector('[data-testid^="node-"]:not([data-testid^="node-sheet"]):not([data-testid^="node-buy"])');
    return tile ? tile.getAttribute('data-testid') : null;
  });
  if (node) {
    await click(`[data-testid="${node}"]`, 900);
    await shot('game-5-node-sheet');
    if (await has('[data-testid="node-sheet-close"]')) await click('[data-testid="node-sheet-close"]');
    else if (await has('[data-testid="sheet-close"]')) await click('[data-testid="sheet-close"]');
  }
  await (await tabs())[0].click();
  await sleep(700);
  await forceEvent('sandbox-escape');
  await sleep(1200);
  await shot('game-6-event-card');
  const choice = await page.evaluate(() => {
    const el = document.querySelector('[data-testid^="event-choice-"]:not([aria-disabled="true"])');
    return el ? el.getAttribute('data-testid') : null;
  });
  if (choice) {
    await click(`[data-testid="${choice}"]`, 1200);
    await shot('game-7-event-result');
    if (await has('[data-testid="event-continue"]')) await click('[data-testid="event-continue"]');
  }
  await page.evaluate(() => window.__game.store.getState().setSpeed(0));
  await forceEvent('weekend-coup');
  await sleep(1200);
  await shot('game-8-event-card-2');
  await page.evaluate(() => {
    const store = window.__game.store;
    store.setState({ state: { ...store.getState().state, pendingEvent: null } });
  });
  const all = await tabs();
  if (all[2]) {
    await all[2].click();
    await sleep(900);
    await shot('game-9-news');
  }
  if (all[3]) {
    await all[3].click();
    await sleep(900);
    await shot('game-10-race');
  }
  await (await tabs())[0].click();
  await page.evaluate(() => window.__game.forceComposure(3));
  await sleep(1500);
  await shot('game-11-critical');
  await page.evaluate(() => window.__game.forceComposure(null));

  // ── End ──
  for (let i = 0; i < 60; i++) {
    await advance(500, { bot: true });
    if (await page.evaluate(() => window.__game.store.getState().state.status === 'ended')) break;
  }
  await page.waitForFunction(() => location.pathname === '/end', { timeout: 15000 }).catch(() => undefined);
  await sleep(2000);
  await shot('end');

  // ── Tutorial: first steps ──
  await page.goto(`${base}/?autostart=1&seed=${SEED}&debug=1&tutorial=1&${q}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="tutorial-card"]', { timeout: 15000 });
  await shot('tutorial-1');
  for (let i = 2; i <= 4; i++) {
    if (!(await has('[data-testid="tutorial-next"]'))) break;
    await click('[data-testid="tutorial-next"]', 700);
    await shot(`tutorial-${i}`);
  }

  // ── Garage ──
  await page.goto(`${base}/garage?debug=1&${q}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__garage && window.__garage.state(), { timeout: 15000 });
  await page.evaluate(() => window.__garage.scene('mid'));
  await sleep(800);
  await shot('garage-1-main');
  for (const id of ['garage-tab-upgrades', 'garage-tab-ship']) {
    if (await has(`[data-testid="${id}"]`)) {
      await click(`[data-testid="${id}"]`, 700);
      await shot(`garage-${id.replace('garage-tab-', '2-')}`);
    }
  }
  await click('[data-testid="garage-settings"]', 900);
  await shot('garage-3-settings');

  // ── Switch to English with the row: text must change without a reload ──
  const before = await page.evaluate(() => document.body.innerText);
  await click(`[data-testid="locale-${LOCALE === 'tr' ? 'en' : 'tr'}"]`, 1200);
  const after = await page.evaluate(() => document.body.innerText);
  const switched = after !== before && (LOCALE === 'tr' ? /settings|garage|build/i : /ayarlar|garaj|kur/i).test(after);
  console.log(`${switched ? 'ok  ' : 'FAIL'} language row switches the visible text without a reload`);
  await page.screenshot({ path: path.join(dir, 'garage-4-switched-language.png') });
  await page.evaluate(() => localStorage.clear());
  await page.close();
  return { errors, switched };
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ missing: run npx expo export --platform web first');
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--lang=en-US'] });
  let failed = false;
  try {
    for (const [w, h] of SIZES) {
      const { errors, switched } = await runSize(browser, w, h, base);
      if (!switched) failed = true;
      if (errors.length) {
        failed = true;
        console.log('page errors:');
        for (const e of errors) console.log(`  ${e}`);
      }
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  textScanSummary();
  if (leftovers.size === 0) console.log('English scan: no English leftovers on screen');
  else {
    console.log(`English scan: ${leftovers.size} line(s) that look English:`);
    for (const [hit, name] of leftovers) console.log(`  [${name}] ${hit}`);
    process.exitCode = 1;
  }
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
