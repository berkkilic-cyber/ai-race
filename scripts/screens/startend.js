#!/usr/bin/env node
/**
 * Screenshots of the start flow and the end screen at a landscape phone viewport (844x390).
 *
 *   npx expo export --platform web && node scripts/screens/startend.js [outDir]
 *
 * Serves dist/ on a local port (inside this process), drives headless Chrome
 * with puppeteer-core, walks the three start steps, then plays runs with the
 * `?debug=1` handle (window.__game) until it has a win and a loss. Each page
 * that scrolls is also captured scrolled to the bottom (`*-bottom.png`).
 * The server and browser are closed before exiting.
 * Env: CHROME (default /usr/bin/google-chrome), PORT (default: any free port), WIDTH/HEIGHT (default 844x390),
 *      SEEDS (comma list to try, default 1..40), EXTRA (dir for middle-of-page shots).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { scanText, textScanSummary } = require('./textScan');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots'));
const PORT = Number(process.env.PORT || 0);
const WIDTH = Number(process.env.WIDTH || 844);
const HEIGHT = Number(process.env.HEIGHT || 390);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SEEDS = (process.env.SEEDS || Array.from({ length: 40 }, (_, i) => i + 1).join(',')).split(',').map(Number);
const EXTRA = process.env.EXTRA ? path.resolve(process.env.EXTRA) : null;

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

/** Scrolls the largest scrollable element; returns false when nothing scrolls. */
function scrollMain(page, where) {
  return page.evaluate((where) => {
    const els = [...document.querySelectorAll('div')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 150;
    });
    if (!els.length) return false;
    const el = els.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0];
    el.scrollTop = where === 'bottom' ? el.scrollHeight : where === 'top' ? 0 : Math.round(where * (el.scrollHeight - el.clientHeight));
    return true;
  }, where);
}

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  fs.mkdirSync(OUT, { recursive: true });
  if (EXTRA) fs.mkdirSync(EXTRA, { recursive: true });
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
    const base = `http://127.0.0.1:${server.address().port}`;
    const shot = async (name, dir = OUT) => {
      await page.screenshot({ path: path.join(dir, name) });
      await scanText(page, String(name));
      console.log(`saved ${path.join(dir, name)}`);
    };
    /** Top shot, plus a bottom shot when the page scrolls (and middle shots into EXTRA). */
    const shotPage = async (name) => {
      await shot(`${name}.png`);
      if (EXTRA) {
        for (const f of [0.33, 0.66]) {
          if (await scrollMain(page, f)) {
            await sleep(300);
            await shot(`${name}-${Math.round(f * 100)}.png`, EXTRA);
          }
        }
      }
      if (await scrollMain(page, 'bottom')) {
        await sleep(400);
        await shot(`${name}-bottom.png`);
        await scrollMain(page, 'top');
        await sleep(200);
      }
    };
    const click = async (testId) => {
      await page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 5000 });
      await page.click(`[data-testid="${testId}"]`);
      await sleep(400);
    };
    const text = (testId) => page.$eval(`[data-testid="${testId}"]`, (el) => el.textContent);

    // ── Start flow ──
    await page.goto(`${base}/?debug=1`, { waitUntil: 'networkidle0' });
    await sleep(800);
    await click('start-dice');
    await shotPage('start-1-name');
    await click('start-howto-open');
    await sleep(300);
    await shot('start-howto.png');
    await click('start-howto-close');

    // Validation: an empty name blocks Next.
    await page.click('[data-testid="start-name"]');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(200);
    console.log(`empty name, next button: ${await text('start-next')}`);
    await page.type('[data-testid="start-name"]', 'Probably Safe Labs');
    await click('start-next');
    await click('founder-hustler');
    await shotPage('start-2-founder');
    await click('start-next');
    await sleep(1200);
    console.log(`no region, found button: ${await text('start-found')}`);

    // Tap a region's centroid on the map (same fit maths as the map), then pick another from the list.
    const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/packs/ai-lab/geometry.json'), 'utf8'));
    const box = await (await page.$('[data-testid="picker-map"]')).boundingBox();
    const k = Math.min(box.width / geometry.width, box.height / geometry.height);
    const [cx, cy] = geometry.regions.india.centroid;
    await page.mouse.click(box.x + (box.width - geometry.width * k) / 2 + cx * k, box.y + (box.height - geometry.height * k) / 2 + cy * k);
    // A single tap is confirmed only once the double-tap window (500 ms) has passed.
    await sleep(900);
    console.log(`map tap picked: ${await text('start-region-panel')}`);
    await click('start-region-list');
    await page.type('[data-testid="start-region-search"]', 'can');
    await sleep(300);
    await click('region-row-canada');
    await sleep(800);
    console.log(`list picked: ${await text('start-region-panel')}`);
    await shotPage('start-3-region');
    await click('start-found');
    await page.waitForFunction(() => location.pathname === '/game', { timeout: 5000 });
    console.log('found the lab -> /game');

    // ── Endings: play runs until one win and one loss are captured ──
    const want = { win: 'end-win', lose: 'end-lose' };
    for (const seed of SEEDS) {
      if (!want.win && !want.lose) break;
      await page.goto(`${base}/?autostart=1&debug=1&seed=${seed}`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 10000 });
      await page.evaluate(() => window.__game.store.getState().setSpeed(0));
      for (let i = 0; i < 60; i++) {
        await page.evaluate(() => window.__game.advance(500, { bot: true }));
        if (await page.evaluate(() => window.__game.store.getState().state.status === 'ended')) break;
      }
      const ending = await page.evaluate(() => window.__game.store.getState().state.ending);
      console.log(`seed ${seed}: ${ending ? `${ending.kind} ${ending.endingId} day ${ending.tick + 1}` : 'no ending'}`);
      if (!ending || !want[ending.kind]) continue;
      await page.waitForFunction(() => location.pathname === '/end', { timeout: 10000 });
      await sleep(2000);
      await shotPage(want[ending.kind]);
      want[ending.kind] = null;
    }
    if (want.win) {
      // No natural win with these seeds: play a run part-way, then put the player at the AGI line
      // (and nearly broke, for the secret Broke Genius achievement) through the debug handle and let
      // the engine finish the run.
      console.log('no win reached with these seeds; staging an AGI win through the debug handle');
      await page.goto(`${base}/?autostart=1&debug=1&seed=${SEEDS[0]}`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 10000 });
      await page.evaluate(() => window.__game.store.getState().setSpeed(0));
      await page.evaluate(() => window.__game.advance(1100, { bot: true }));
      await page.evaluate(() => {
        const store = window.__game.store;
        const s = store.getState().state;
        const p = s.labs[s.playerLabId];
        store.setState({ state: { ...s, labs: { ...s.labs, [p.id]: { ...p, agiProgress: 100, cash: 0 } } } });
      });
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.__game.advance(50, { bot: true }));
        if (await page.evaluate(() => window.__game.store.getState().state.status === 'ended')) break;
      }
      const ending = await page.evaluate(() => window.__game.store.getState().state.ending);
      console.log(`staged: ${ending ? `${ending.kind} ${ending.endingId} day ${ending.tick + 1}` : 'no ending'}`);
      if (ending && ending.kind === 'win') {
        await page.waitForFunction(() => location.pathname === '/end', { timeout: 10000 });
        await sleep(2000);
        await shotPage('end-win');
      }
    }

    // One full run with the bot playing and collecting moments (a quick player, through the
    // debug handle): the run must end, the end screen render, and Play again start a new run.
    {
      await page.goto(`${base}/?autostart=1&debug=1&seed=${SEEDS[0] + 100}`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 10000 });
      await page.evaluate(() => window.__game.store.getState().setSpeed(0));
      for (let i = 0; i < 80; i++) {
        await page.evaluate(() => window.__game.advance(100, { bot: true, collectMoments: true }));
        if (await page.evaluate(() => window.__game.store.getState().state.status === 'ended')) break;
      }
      const run = await page.evaluate(() => {
        const s = window.__game.store.getState().state;
        const p = s.labs[s.playerLabId];
        return { status: s.status, ending: s.ending, collected: p.stats.momentsCollected, missed: p.stats.momentsMissed };
      });
      console.log(`moments run: ${run.status} ${run.ending ? `${run.ending.kind} ${run.ending.endingId} day ${run.ending.tick + 1}` : ''}, moments collected ${run.collected}, missed ${run.missed}`);
      if (run.status !== 'ended') throw new Error('the moments run did not end');
      if (run.collected === 0) throw new Error('the bot collected no moments');
      await page.waitForFunction(() => location.pathname === '/end', { timeout: 10000 });
      await page.waitForSelector('[data-testid="end-title"]', { timeout: 10000 });
      await sleep(1500);
      await shotPage('end-moments-run');
    }

    // Play again keeps the lab; /end without a finished run goes back to /.
    if (await page.$('[data-testid="end-play-again"]')) {
      await click('end-play-again');
      await page.waitForFunction(() => location.pathname === '/game', { timeout: 5000 });
      const lab = await page.evaluate(() => {
        const s = window.__game.store.getState().state;
        const p = s.labs[s.playerLabId];
        return `${p.name} / ${p.founderId} / ${p.homeRegion} / seed ${s.seed}`;
      });
      console.log(`play again -> ${lab}`);
      const fresh = await page.evaluate(() => {
        const s = window.__game.store.getState().state;
        return { status: s.status, tick: s.tick, moments: s.labs[s.playerLabId].stats.momentsCollected };
      });
      if (fresh.status !== 'running' || fresh.tick > 50 || fresh.moments !== 0) throw new Error(`play again did not start a fresh run: ${JSON.stringify(fresh)}`);
      console.log('play again started a fresh run');
    }
    await page.goto(`${base}/end`, { waitUntil: 'networkidle0' });
    await sleep(800);
    console.log(`fresh /end -> ${await page.evaluate(() => location.pathname)}`);
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
