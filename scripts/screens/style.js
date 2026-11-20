#!/usr/bin/env node
/**
 * Style-proof screenshots ("calm lab, loud world", docs/DESIGN.md) at 844x390, one set
 * per theme, plus a measurement of how many map dot buckets re-render per tick.
 *
 *   EXPO_PUBLIC_THEME=paper npx expo export --platform web && THEME=paper node scripts/screens/style.js
 *   EXPO_PUBLIC_THEME=night npx expo export --platform web && THEME=night node scripts/screens/style.js
 *
 * Writes docs/screenshots/style/<theme>-<name>.png: map-calm, map-midgame, map-critical,
 * map-panel, event-card, event-result, trees, start, end. THEME only names the files: the
 * palette is baked into dist/ at export time. Serves dist/ in-process and drives headless
 * Chrome through the `?debug=1` handle (window.__game); the server and browser are closed
 * before exiting. Env: CHROME (default /usr/bin/google-chrome), PORT (default 8767),
 * SEED (default 7), SCALE (device pixel ratio, default 1), MEASURE=0 to skip the render measurement.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots', 'style'));
const THEME = process.env.THEME || 'paper';
const PORT = Number(process.env.PORT || 8767);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const MEASURE = process.env.MEASURE !== '0';
/** Device pixel ratio of the shots (1 = 844x390 images). */
const SCALE = Number(process.env.SCALE || 1);
const VIEW = { width: 844, height: 390 };

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
    await page.setViewport({ ...VIEW, deviceScaleFactor: SCALE });
    const base = `http://127.0.0.1:${PORT}`;
    const shot = async (name) => {
      await page.evaluate(() => document.fonts && document.fonts.ready);
      const file = path.join(OUT, `${THEME}-${name}.png`);
      await page.screenshot({ path: file });
      console.log(`saved ${path.relative(ROOT, file)}`);
    };
    const game = (fn, arg) => page.evaluate(fn, arg);
    const advance = (n, opts) => page.evaluate((n, opts) => window.__game.advance(n, opts), n, opts);
    const setSpeed = (s) => game((s) => window.__game.store.getState().setSpeed(s), s);
    // Achievement toasts earned while fast-forwarding would cover the strip: hide them for these shots.
    const hideToasts = () => page.addStyleTag({ content: '[data-testid="achievement-toast"]{display:none !important}' });
    const forceEvent = (eventId) =>
      game((eventId) => {
        const store = window.__game.store;
        const s = store.getState().state;
        store.setState({ eventResult: null, state: { ...s, pendingEvent: { eventId, labId: s.playerLabId } } });
      }, eventId);
    const clickRegion = async (regionId) => {
      const target = await game((regionId) => {
        const svg = [...document.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
        const vb = svg.viewBox.baseVal;
        const r = svg.getBoundingClientRect();
        const k = Math.min(r.width / vb.width, r.height / vb.height);
        return { k, x: r.x + (r.width - vb.width * k) / 2, y: r.y + (r.height - vb.height * k) / 2, regionId };
      }, regionId);
      const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/packs/ai-lab/geometry.json'), 'utf8'));
      const [cx, cy] = geometry.regions[regionId].centroid;
      await page.mouse.click(target.x + cx * target.k, target.y + cy * target.k);
    };

    // Start screen.
    await page.goto(`${base}/?debug=1`, { waitUntil: 'networkidle0' });
    await sleep(1200);
    await shot('start');

    // Early run, composure 0.
    await page.goto(`${base}/?autostart=1&debug=1&seed=${SEED}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
    await hideToasts();
    await setSpeed(0);
    await advance(260, { bot: true });
    await game(() => window.__game.forceComposure(0));
    await setSpeed(1);
    await sleep(1800);
    await shot('map-calm');
    await game(() => window.__game.forceComposure(null));

    // Midgame: about day 1,500 with the bot playing.
    await setSpeed(0);
    await advance(1240, { bot: true });
    const mid = await game(() => {
      const s = window.__game.store.getState().state;
      return { day: s.tick + 1, status: s.status, sites: s.labOrder.reduce((n, id) => n + s.labs[id].dataCentres.length, 0) };
    });
    console.log(`midgame: day ${mid.day}, ${mid.status}, ${mid.sites} data centres`);
    await setSpeed(1);
    await sleep(1600);
    await shot('map-midgame');

    // Region side panel on the player's home region.
    await setSpeed(0);
    const home = await game(() => {
      const s = window.__game.store.getState().state;
      return s.labs[s.playerLabId].homeRegion;
    });
    await clickRegion(home);
    await sleep(1000);
    await shot('map-panel');
    const close = (await page.$('[data-testid="region-sheet"] [aria-label="Close"]')) ?? (await page.$('[data-testid="sheet-close"]'));
    if (close) await close.click();
    await sleep(500);

    // Composure 3: regulation near the limit, BREAKING band, frame pulsing.
    await game(() => window.__game.setMeters({ regulation: 91 }));
    await setSpeed(1);
    await sleep(1500);
    await shot('map-critical');
    await setSpeed(0);
    await game(() => window.__game.setMeters({ regulation: 30 }));

    // Render measurement: tick one day at a time and compare bucket renders with bucket colour changes.
    if (MEASURE) {
      await advance(1, {});
      await sleep(300);
      const counts = await game(async () => {
        const g = window.__game;
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const ticks = 120;
        let changed = 0;
        let prev = g.dotColors();
        g.resetRenderStats();
        for (let i = 0; i < ticks; i++) {
          g.advance(1, { bot: true });
          await wait(170); // 3x speed is one tick per 167 ms
          const next = g.dotColors();
          for (const id of Object.keys(next)) {
            const a = prev[id].split(',');
            const b = next[id].split(',');
            for (let k = 0; k < b.length; k++) if (a[k] !== b[k]) changed++;
          }
          prev = next;
        }
        const stats = g.renderStats();
        const buckets = Object.values(prev).reduce((n, key) => n + key.split(',').length, 0);
        return { ticks, buckets, changed, bucketRenders: stats.dotBucket ?? 0, regionRenders: stats.dotRegion ?? 0 };
      });
      console.log(
        `render check over ${counts.ticks} ticks: ${counts.buckets} buckets on the map, ${counts.changed} bucket colour changes, ` +
          `${counts.bucketRenders} bucket renders, ${counts.regionRenders} region renders ` +
          `(a full re-render would be ${counts.buckets * counts.ticks} bucket renders)`,
      );
    }

    // Event card and its result (a bad-news card: the loud voice at its loudest).
    await forceEvent('staged-demo');
    await sleep(1400);
    await shot('event-card');
    const choice = await page.$('[data-testid^="event-choice-"]:not([aria-disabled="true"])');
    if (choice) {
      await choice.click();
      await sleep(1200);
      await shot('event-result');
      const cont = await page.$('[data-testid="event-continue"]');
      if (cont) await cont.click();
    }
    await setSpeed(0);

    // Trees tab.
    const tabs = await page.$$('[role="tab"]');
    if (tabs.length === 3) {
      await tabs[1].click();
      await sleep(1000);
      await shot('trees');
      await tabs[0].click();
      await sleep(400);
    }

    // Play to an ending.
    for (let i = 0; i < 40; i++) {
      await advance(500, { bot: true });
      if (await game(() => window.__game.store.getState().state.status === 'ended')) break;
    }
    await page.waitForFunction(() => location.pathname === '/end', { timeout: 10000 });
    await sleep(2500);
    await shot('end');
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (errors.length) {
    console.log('Page errors:');
    for (const e of [...new Set(errors)]) console.log(`  ${e}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
