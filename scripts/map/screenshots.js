#!/usr/bin/env node
/**
 * Takes UI screenshots of the exported web build at a landscape phone viewport
 * (844x390, the design size), plus one portrait (390x844) fallback shot.
 *
 *   npx expo export --platform web && node scripts/map/screenshots.js [outDir]
 *
 * Serves dist/ on a local port (inside this process), drives headless Chrome
 * with puppeteer-core and uses the `?debug=1` handle (window.__game) to
 * fast-forward the run. The server and browser are closed before exiting.
 * Env: CHROME (default /usr/bin/google-chrome), PORT (default 8765), SEED (default 7).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots'));
const PORT = Number(process.env.PORT || 8765);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const WIDE = { width: 844, height: 390 };
const NARROW = { width: 390, height: 844 };

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const candidates = [url, `${url}.html`, path.join(url, 'index.html')];
    for (const c of candidates) {
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
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', `--window-size=${WIDE.width},${WIDE.height}`],
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewport({ ...WIDE, deviceScaleFactor: 1 });
    const base = `http://127.0.0.1:${PORT}`;
    const shot = async (name) => {
      await page.screenshot({ path: path.join(OUT, name) });
      console.log(`saved ${name}`);
    };
    const advance = (n, opts) => page.evaluate((n, opts) => window.__game.advance(n, opts), n, opts);
    const game = (fn) => page.evaluate(fn);

    // 1. Start screen.
    await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
    await sleep(800);
    await shot('01-start.png');

    // 2. Map right after starting.
    await page.goto(`${base}/?autostart=1&debug=1&seed=${SEED}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
    await sleep(3000);
    await shot('02-map-start.png');

    // 3. About 600 ticks of play at 3x (fast-forwarded with the bot), then open the home region sheet.
    await game(() => window.__game.store.getState().setSpeed(3));
    await advance(600, { bot: true });
    await sleep(1500);
    await shot('03-map-600.png');
    // Tap the player's home region at its marker point (map units -> screen through the SVG box).
    const home = await page.evaluate(() => {
      const s = window.__game.store.getState().state;
      return s.labs[s.playerLabId].homeRegion;
    });
    const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/packs/ai-lab/geometry.json'), 'utf8'));
    const box = await page.evaluate(() => {
      const svg = [...document.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      return { x: r.x, y: r.y, width: r.width, height: r.height, vw: vb.width, vh: vb.height };
    });
    const k = Math.min(box.width / box.vw, box.height / box.vh);
    const [cx, cy] = geometry.regions[home].centroid;
    const target = { x: box.x + (box.width - box.vw * k) / 2 + cx * k - 6, y: box.y + (box.height - box.vh * k) / 2 + cy * k - 6 };
    await page.mouse.click(target.x + 6, target.y + 6);
    await sleep(800);
    console.log(`home region: ${home}`);
    await sleep(800);
    await shot('04-map-600-sheet.png');
    await page.keyboard.press('Escape');

    // 4. An event card, then its result.
    await game(() => window.__game.store.getState().setSpeed(0));
    // Wide mode: the side panel's close button; narrow mode: the scrim.
    const closeBtn = (await page.$('[data-testid="region-sheet"] [aria-label="Close"]')) ?? (await page.$('[aria-label="close"]'));
    if (closeBtn) await closeBtn.click();
    for (let i = 0; i < 20; i++) {
      await advance(400, { bot: true, stopAtEvent: true });
      const pending = await game(() => !!window.__game.store.getState().state.pendingEvent);
      const ended = await game(() => window.__game.store.getState().state.status === 'ended');
      if (pending || ended) break;
    }
    await sleep(800);
    await shot('05-event.png');
    const choice = await page.$('[data-testid^="event-choice-"]:not([aria-disabled="true"])');
    if (choice) {
      await choice.click();
      await sleep(800);
      await shot('06-event-result.png');
      const cont = await page.$('[data-testid="event-continue"]');
      if (cont) await cont.click();
    }

    // 5. Trees and News tabs (client-side navigation keeps the run).
    const tabs = await page.$$('[role="tab"]');
    if (tabs.length === 3) {
      await tabs[1].click();
      await sleep(800);
      await shot('07-trees.png');
      await tabs[2].click();
      await sleep(800);
      await shot('08-news.png');
      await tabs[0].click();
      await sleep(500);
    }

    // 6. Play to an ending.
    for (let i = 0; i < 40; i++) {
      await advance(500, { bot: true });
      if (await game(() => window.__game.store.getState().state.status === 'ended')) break;
    }
    await page.waitForFunction(() => location.pathname === '/end', { timeout: 10000 });
    await sleep(800);
    await shot('09-end.png');

    // 7. Portrait fallback: a fresh run at a narrow window (proves the narrow shell still renders).
    await page.setViewport({ ...NARROW, deviceScaleFactor: 1 });
    await page.goto(`${base}/?autostart=1&debug=1&seed=${SEED}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
    await advance(300, { bot: true });
    await sleep(1500);
    await shot('10-narrow-fallback.png');
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (errors.length) {
    console.log('Page errors:');
    for (const e of errors) console.log(`  ${e}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
