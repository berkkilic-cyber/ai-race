#!/usr/bin/env node
/**
 * Screenshots of the event card, result view, news log, ticker and achievement
 * toasts/sheet on the exported web build, at a landscape phone viewport (844x390).
 *
 *   npx expo export --platform web && node scripts/screens/events.js [outDir]
 *
 * Serves dist/ in-process, drives headless Chrome with puppeteer-core and uses the
 * `?debug=1` handle (window.__game). To get specific cards on screen it sets
 * `pendingEvent` on the store directly (debug only); the run is paused throughout.
 * The server and browser are closed before exiting.
 * Env: CHROME (default /usr/bin/google-chrome), PORT (default 8766), SEED (default 7),
 * WIDTH/HEIGHT (default 844x390).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { scanText, textScanSummary } = require('./textScan');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots'));
const PORT = Number(process.env.PORT || 8766);
const SEED = Number(process.env.SEED || 7);
const WIDTH = Number(process.env.WIDTH || 844);
const HEIGHT = Number(process.env.HEIGHT || 390);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';

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
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', `--window-size=${WIDTH},${HEIGHT}`] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    const shot = async (name) => {
      await page.screenshot({ path: path.join(OUT, name) });
      await scanText(page, String(name));
      console.log(`saved ${name}`);
    };
    const advance = (n, opts) => page.evaluate((n, opts) => window.__game.advance(n, opts), n, opts);
    const click = async (selector) => {
      const el = await page.$(selector);
      if (!el) throw new Error(`not found: ${selector}`);
      await el.click();
    };
    /** Puts the given event on screen as the pending event (debug only). */
    const forceEvent = (eventId) =>
      page.evaluate((eventId) => {
        const store = window.__game.store;
        const s = store.getState().state;
        store.setState({ eventResult: null, state: { ...s, pendingEvent: { eventId, labId: s.playerLabId } } });
      }, eventId);
    const tabs = async () => page.$$('[role="tab"]');

    await page.goto(`http://127.0.0.1:${PORT}/?autostart=1&debug=1&seed=${SEED}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
    await page.evaluate(() => window.__game.store.getState().setSpeed(0));
    // A lived-in run: about 900 days with the bot playing, events auto-resolved.
    await advance(900, { bot: true });
    await sleep(1500);

    // 1. Toasts: let the ones earned during the warm-up drain, then award one plain and one secret achievement.
    const drainToasts = async () => {
      for (let i = 0; i < 40 && (await page.$('[data-testid="achievement-toast"]')); i++) await sleep(500);
      await sleep(300);
    };
    const award = (secret) =>
      page.evaluate((secret) => {
        const store = window.__game.store;
        const { state, pack } = store.getState();
        const next = pack.achievements.find((a) => a.secret === secret && !state.achievements.includes(a.id));
        if (next) store.setState({ state: { ...state, achievements: [...state.achievements, next.id] } });
      }, secret);
    await drainToasts();
    await award(false);
    await sleep(900);
    await shot('achievement-toast.png');
    await drainToasts();
    await award(true);
    await sleep(900);
    await shot('achievement-toast-secret.png');
    await drainToasts();

    // 2. Cards.
    await forceEvent('staged-demo');
    await sleep(1200);
    await shot('events-card-bad.png');

    await forceEvent('viral-poem');
    await sleep(1200);
    await shot('events-card-good.png');

    await forceEvent('sandbox-escape');
    await sleep(1200);
    await shot('events-card-risky-disabled.png');

    // 3. Result with deltas: spin the sandbox story (gains Hype, raises Regulation, may backfire).
    await click('[data-testid="event-choice-spin"]');
    await sleep(1200);
    await shot('events-result.png');
    await click('[data-testid="event-continue"]');
    await sleep(600);
    await page.evaluate(() => window.__game.store.getState().setSpeed(0));

    // 4. News tab, filter, achievements sheet.
    const t = await tabs();
    if (t.length < 3) throw new Error('tabs not found');
    await t[2].click();
    await sleep(1000);
    await shot('news-log.png');
    await click('[data-testid="news-filter-rivals"]');
    await sleep(600);
    await shot('news-filter-rivals.png');
    await click('[data-testid="news-filter-all"]');
    await click('[data-testid="news-achievements"]');
    await sleep(800);
    await shot('achievements-sheet.png');
    await click('[data-testid="achievements-close"]');
    await sleep(300);
    await t[0].click();
    await sleep(800);

    // 5. Ticker with a headline too long for the strip (an event body used as a stand-in long headline).
    await page.evaluate(() => {
      const store = window.__game.store;
      const s = store.getState().state;
      const rival = s.labOrder.find((id) => id !== s.playerLabId);
      const item = { tick: s.tick, textKey: 'event.sandbox-escape.body', tone: 'bad', labId: rival };
      store.setState({ state: { ...s, news: [...s.news, item] } });
    });
    await sleep(3200);
    await shot('ticker-long-headline.png');
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (errors.length) {
    console.log('Page errors:');
    for (const e of errors) console.log(`  ${e}`);
  }
}

main()
  .then(() => textScanSummary())
  .catch((err) => {
  console.error(err);
  process.exit(1);
});
