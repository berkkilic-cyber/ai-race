#!/usr/bin/env node
/**
 * Safe-area screenshots: the web build with emulated phone insets (`?insets=` debug
 * parameter, see src/ui/hooks/useInsets.tsx), to check the landscape shell the way a
 * notched iPhone lays it out.
 *
 *   npx expo export --platform web
 *   W=859 H=396 INSETS=0,59,21,59 PREFIX=after-insets node scripts/screens/native.js
 *   W=844 H=390 INSETS=0,0,0,0 PREFIX=zero-insets node scripts/screens/native.js
 *
 * Writes docs/screenshots/native/<PREFIX>-<name>.png for each name in SHOTS (default
 * start,map,panel,event,trees,end). DAYS (default 260) is how far the bot plays before the
 * map shot. Serves dist/ in-process and drives headless Chrome through `?debug=1`; the
 * server and browser are closed before exiting. Env: CHROME, PORT (default 8768), SEED (7).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { scanText, textScanSummary } = require('./textScan');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'native');
const PORT = Number(process.env.PORT || 8768);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const VIEW = { width: Number(process.env.W || 859), height: Number(process.env.H || 396) };
const INSETS = process.env.INSETS || '0,59,21,59';
const PREFIX = process.env.PREFIX || 'after-insets';
const DAYS = Number(process.env.DAYS || 260);
const SHOTS = new Set((process.env.SHOTS || 'start,map,panel,event,trees,end').split(','));

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
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewport({ ...VIEW, deviceScaleFactor: 1 });
    const base = `http://127.0.0.1:${PORT}`;
    const q = `debug=1&insets=${INSETS}`;
    const shot = async (name) => {
      await page.evaluate(() => document.fonts && document.fonts.ready);
      const file = path.join(OUT, `${PREFIX}-${name}.png`);
      await page.screenshot({ path: file });
      await scanText(page, path.basename(String(file)));
      console.log(`saved ${path.relative(ROOT, file)}`);
    };
    const game = (fn, arg) => page.evaluate(fn, arg);
    const advance = (n, opts) => page.evaluate((n, opts) => window.__game.advance(n, opts), n, opts);
    const setSpeed = (s) => game((s) => window.__game.store.getState().setSpeed(s), s);
    const hideToasts = () => page.addStyleTag({ content: '[data-testid="achievement-toast"]{display:none !important}' });

    if (SHOTS.has('start')) {
      await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle0' });
      await sleep(1200);
      await shot('start');
    }

    const needsRun = ['map', 'panel', 'event', 'trees', 'end'].some((s) => SHOTS.has(s));
    if (!needsRun) return;
    await page.goto(`${base}/?autostart=1&seed=${SEED}&${q}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
    await hideToasts();
    await setSpeed(0);
    await advance(DAYS, { bot: true });
    await game(() => window.__game.forceComposure(0));
    await setSpeed(1);
    await sleep(2500);
    if (SHOTS.has('map')) await shot('map');
    await setSpeed(0);

    if (SHOTS.has('panel')) {
      const home = await game(() => {
        const s = window.__game.store.getState().state;
        return s.labs[s.playerLabId].homeRegion;
      });
      const target = await game((regionId) => {
        const svg = [...document.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
        const vb = svg.viewBox.baseVal;
        const r = svg.getBoundingClientRect();
        const k = Math.min(r.width / vb.width, r.height / vb.height);
        return { k, x: r.x + (r.width - vb.width * k) / 2, y: r.y + (r.height - vb.height * k) / 2, regionId };
      }, home);
      const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/packs/ai-lab/geometry.json'), 'utf8'));
      const [cx, cy] = geometry.regions[home].centroid;
      await page.mouse.click(target.x + cx * target.k, target.y + cy * target.k);
      await sleep(1000);
      await shot('panel');
      const close = (await page.$('[data-testid="region-sheet"] [aria-label="Close"]')) ?? (await page.$('[data-testid="sheet-close"]'));
      if (close) await close.click();
      await sleep(500);
    }

    if (SHOTS.has('event')) {
      await game(() => window.__game.forceComposure(3));
      await game(() => {
        const store = window.__game.store;
        const s = store.getState().state;
        store.setState({ eventResult: null, state: { ...s, pendingEvent: { eventId: 'staged-demo', labId: s.playerLabId } } });
      });
      await sleep(1500);
      await shot('event');
      const choice = await page.$('[data-testid^="event-choice-"]:not([aria-disabled="true"])');
      if (choice) {
        await choice.click();
        await sleep(800);
        const cont = await page.$('[data-testid="event-continue"]');
        if (cont) await cont.click();
      }
      await sleep(600);
      await game(() => window.__game.forceComposure(null));
      await setSpeed(0);
    }

    if (SHOTS.has('trees')) {
      const tabs = await page.$$('[role="tab"]');
      if (tabs.length === 3) {
        await tabs[1].click();
        await sleep(1000);
        await shot('trees');
        await tabs[0].click();
        await sleep(400);
      }
    }

    if (SHOTS.has('end')) {
      for (let i = 0; i < 40; i++) {
        await advance(500, { bot: true });
        if (await game(() => window.__game.store.getState().state.status === 'ended')) break;
      }
      await page.waitForFunction(() => location.pathname === '/end', { timeout: 10000 });
      await sleep(2500);
      await shot('end');
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (errors.length) {
    console.log('Page errors:');
    for (const e of [...new Set(errors)]) console.log(`  ${e}`);
  }
}

main()
  .then(() => textScanSummary())
  .catch((err) => {
  console.error(err);
  process.exit(1);
});
