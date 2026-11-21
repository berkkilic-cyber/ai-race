#!/usr/bin/env node
/**
 * Screenshots of every step of the first-run tutorial on the exported web build, playing
 * it the way a player would: Next, open Trees, buy the first model, tap home, build a
 * data centre, wait for the first event card, choose, finish.
 *
 *   npx expo export --platform web
 *   node scripts/screens/tutorial.js
 *   W=859 H=396 INSETS=0,59,21,59 PREFIX=insets node scripts/screens/tutorial.js
 *
 * Writes docs/screenshots/tutorial/<PREFIX>-NN-<step>.png (PREFIX default "wide", 844x390,
 * no insets). Uses `?debug=1&tutorial=1` (debug pages skip the tutorial without
 * tutorial=1) and a fresh browser profile, so the "done" flag is unset. Serves dist/
 * in-process; the server and browser are closed before exiting.
 * Env: CHROME, PORT (default 8769), SEED (7), W, H, INSETS, PREFIX.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { scanText, textScanSummary } = require('./textScan');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'tutorial');
const PORT = Number(process.env.PORT || 8769);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const VIEW = { width: Number(process.env.W || 844), height: Number(process.env.H || 390) };
const INSETS = process.env.INSETS || '';
const PREFIX = process.env.PREFIX || 'wide';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };

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
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', `--window-size=${VIEW.width},${VIEW.height}`] });
  const errors = [];
  let n = 0;
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewport({ ...VIEW, deviceScaleFactor: 1 });
    const base = `http://127.0.0.1:${PORT}`;
    const q = `debug=1&tutorial=1${INSETS ? `&insets=${INSETS}` : ''}`;
    const game = (fn, arg) => page.evaluate(fn, arg);
    const caption = () => game(() => document.querySelector('[data-testid="tutorial-caption"]')?.textContent ?? null);
    const shot = async (name) => {
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await sleep(450);
      const file = path.join(OUT, `${PREFIX}-${String(++n).padStart(2, '0')}-${name}.png`);
      await page.screenshot({ path: file });
      await scanText(page, path.basename(String(file)));
      console.log(`saved ${path.relative(ROOT, file)}  ${(await caption()) ?? ''}`);
    };
    const click = async (selector) => {
      await page.waitForSelector(selector, { timeout: 8000 });
      await page.click(selector);
      await sleep(500);
    };
    const tab = async (i) => {
      const tabs = await page.$$('[role="tab"]');
      await tabs[i].click();
      await sleep(700);
    };
    // Click the centre of the tutorial's current cut-out (the highlighted target).
    const clickHole = async () => {
      const rect = await game(() => {
        const r = [...document.querySelectorAll('[data-testid="tutorial"] rect')][0];
        if (!r) return null;
        const b = r.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      });
      if (!rect) throw new Error('no cut-out');
      await page.mouse.click(rect.x, rect.y);
      await sleep(800);
    };

    await page.goto(`${base}/?autostart=1&seed=${SEED}&${q}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
    await page.waitForSelector('[data-testid="tutorial-card"]', { timeout: 10000 });
    await shot('home');
    await click('[data-testid="tutorial-next"]');
    await shot('strip');
    await click('[data-testid="tutorial-next"]');
    await shot('buy-open-trees');
    await tab(1);
    await shot('buy-tile');
    await clickHole();
    await shot('buy-confirm');
    await clickHole();
    await sleep(1200);
    await shot('build-open-map');
    await tab(0);
    await shot('build-tap-home');
    // The waiting caption: take the cash away for a moment (debug only), then give it back.
    const cash = await game(() => {
      const store = window.__game.store;
      const s = store.getState().state;
      const me = s.labs[s.playerLabId];
      store.setState({ state: { ...s, labs: { ...s.labs, [me.id]: { ...me, cash: 0 } } } });
      return me.cash;
    });
    await sleep(600);
    await shot('build-wait-cash');
    await game((cash) => {
      const store = window.__game.store;
      const s = store.getState().state;
      const me = s.labs[s.playerLabId];
      store.setState({ state: { ...s, labs: { ...s.labs, [me.id]: { ...me, cash: Math.max(cash, me.cash) } } } });
    }, cash);
    await sleep(800);
    await clickHole();
    await shot('build-button');
    await clickHole();
    await sleep(600);
    await shot('compute');
    await click('[data-testid="tutorial-next"]');
    await shot('meters');
    await click('[data-testid="tutorial-next"]');
    await shot('speed');
    await click('[data-testid="tutorial-next"]');
    // Step 8 waits for the first card with the run going; fast-forward to it.
    await game(() => window.__game.advance(2000, { stopAtEvent: true }));
    await page.waitForSelector('[data-testid="event-card"]', { timeout: 10000 });
    await sleep(900);
    await shot('event');
    await click('[data-testid="tutorial-next"]');
    await shot('event-after');
    await click('[data-testid^="event-choice-"]:not([aria-disabled="true"])');
    const cont = await page.$('[data-testid="event-continue"]');
    if (cont) await click('[data-testid="event-continue"]');
    await page.waitForSelector('[data-testid="tutorial-card"]', { timeout: 10000 });
    await shot('outro');
    await click('[data-testid="tutorial-next"]');
    await shot('done');
    const done = await game(() => !document.querySelector('[data-testid="tutorial-card"]'));
    if (!done) throw new Error('tutorial still showing after finishing');
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (errors.length) {
    console.log('Page errors:');
    for (const e of [...new Set(errors)]) console.log(`  ${e.split('\n')[0]}`);
  }
}

main()
  .then(() => textScanSummary())
  .catch((err) => {
  console.error(err);
  process.exit(1);
});
