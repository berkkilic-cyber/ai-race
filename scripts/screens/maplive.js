#!/usr/bin/env node
/**
 * The live map on the web build: moment bubbles (both kinds), the collect pop, an expiring
 * threat, launch banners (rival and player), a route arc mid-flight, data-centre racks at
 * three levels, node objects, a GPU crate, an edge indicator, the region panel of a blocked
 * region, the standings strip and the first-run coach line. Things are forced through the
 * `?debug=1` handles (`window.__game`, `window.__mapLive`), so every capture is deterministic.
 *
 *   npx expo export --platform web
 *   node scripts/screens/maplive.js                                   # 844x390, no insets
 *   W=926 H=428 INSETS=0,47,21,47 node scripts/screens/maplive.js
 *   THEME=hazard node scripts/screens/maplive.js                      # name tag only: build with EXPO_PUBLIC_THEME
 *
 * Screenshots go to docs/screenshots/maplive/<theme>-<W>x<H>-*.png. Serves dist/ in-process;
 * the server and browser are closed before exiting. Env: CHROME, PORT (8774), SEED (7), DAYS (140).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { scanText, textScanSummary } = require('./textScan');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'maplive');
const PORT = Number(process.env.PORT || 8774);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const VIEW = { width: Number(process.env.W || 844), height: Number(process.env.H || 390) };
const INSETS = process.env.INSETS || '';
const DAYS = Number(process.env.DAYS || 140);
const THEME = process.env.THEME || 'blueprint';
const TAG = `${THEME}-${VIEW.width}x${VIEW.height}`;
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

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
const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/packs/ai-lab/geometry.json'), 'utf8'));

async function open(browser, extra = '') {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ ...VIEW, deviceScaleFactor: 2, hasTouch: true });
  const q = `debug=1${INSETS ? `&insets=${INSETS}` : ''}${extra}`;
  await page.goto(`http://127.0.0.1:${PORT}/?autostart=1&seed=${SEED}&${q}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => location.pathname === '/game' && !!window.__game && !!window.__mapLive);
  await page.addStyleTag({ content: '[data-testid="achievement-toast"]{display:none !important}' });
  await page.evaluate((days) => {
    const g = window.__game;
    g.store.getState().setSpeed(0);
    g.advance(days, { bot: true });
    // A lived-in map: the player in a handful of regions around home.
    window.__mapLive.spread(6);
  }, DAYS);
  // Let banners of launches during the fast-forward play out.
  await sleep(Number(process.env.SETTLE || 7000));
  const cdp = await page.createCDPSession();
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: 0, radiusX: 2, radiusY: 2, force: 1 })) });
  const h = {
    page,
    errors,
    async tap(p) {
      await send('touchStart', [p]);
      await sleep(50);
      await send('touchEnd', []);
    },
    at: (mx, my) =>
      page.evaluate(
        (mx, my) => {
          const svg = [...document.querySelector('[data-testid="map-touch"]').parentElement.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
          const vb = svg.viewBox.baseVal;
          const r = svg.getBoundingClientRect();
          const k = Math.min(r.width / vb.width, r.height / vb.height);
          return { x: r.x + (r.width - vb.width * k) / 2 + mx * k, y: r.y + (r.height - vb.height * k) / 2 + my * k };
        },
        mx,
        my,
      ),
    live: (fn, ...args) => page.evaluate(fn, ...args),
    async shot(name) {
      if (ONLY && !ONLY.has(name)) return;
      await page.evaluate(() => document.fonts && document.fonts.ready);
      const file = path.join(OUT, `${TAG}-${name}.png`);
      await page.screenshot({ path: file });
      await scanText(page, path.basename(String(file)));
      console.log(`saved ${path.relative(ROOT, file)}`);
    },
    async wheel(p, steps) {
      await page.mouse.move(p.x, p.y);
      for (let i = 0; i < Math.abs(steps); i++) {
        await page.mouse.wheel({ deltaY: steps > 0 ? -120 : 120 });
        await sleep(40);
      }
      await sleep(300);
    },
  };
  return h;
}

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', `--window-size=${VIEW.width},${VIEW.height}`] });
  const errors = [];
  try {
    // 1. Bubbles of both kinds, racks at three levels (one offline), node objects, the standings strip.
    let h = await open(browser);
    await h.live(() => {
      const m = window.__mapLive;
      m.dataCentres([1, 2, 3, 2], true);
      m.giveNodes(['cap-robotics', 'shadow-lobbying']);
      m.spawnMoment('boost', { life: 60 });
      m.spawnMoment('threat', { life: 60 });
      m.spawnMoment('boost', { defId: 'angel-wire', life: 60 });
    });
    await sleep(900);
    await h.shot('bubbles');
    // Zoomed in around home: racks and bubbles keep their size.
    const home = await h.live(() => {
      const s = window.__game.store.getState().state;
      return s.labs[s.playerLabId].homeRegion;
    });
    await h.wheel(await h.at(...geometry.regions[home].centroid), 10);
    await sleep(400);
    await h.shot('racks-zoomed');
    // An urgent threat (last third of its life), ring nearly drained.
    await h.live(() => {
      const s = window.__game.store.getState();
      const st = s.state;
      const t = st.moments.find((m) => m.uid.includes('dbg') && s.pack.moments.find((d) => d.id === m.defId).kind === 'threat');
      window.__game.store.setState({ state: { ...st, moments: st.moments.map((m) => (m === t ? { ...m, spawnTick: st.tick - 50, expiresTick: st.tick + 8 } : m)) } });
    });
    await sleep(600);
    await h.shot('threat-urgent');
    // 2. Collect pop: tap a boost bubble with a touch.
    const bubbles = await h.live(() => window.__mapLive.bubbles());
    const boostId = Object.keys(bubbles).find((id) => id.includes('angel-wire')) || Object.keys(bubbles)[0];
    if (boostId) {
      await h.tap(bubbles[boostId]);
      await sleep(230);
      await h.shot('collect-pop');
      await sleep(500);
      await h.shot('collect-float');
    }
    // 3. A threat left alone lands: let the run go at 3x until it expires.
    await h.live(() => window.__game.store.getState().setSpeed(3));
    await h.page.waitForFunction(() => !window.__game.store.getState().state.moments.some((m) => m.uid.includes('dbg') && m.expiresTick - m.spawnTick < 60), { timeout: 15000, polling: 30 }).catch(() => undefined);
    await h.live(() => window.__game.store.getState().setSpeed(0));
    await sleep(200);
    await h.shot('threat-landed-shake');
    await sleep(450);
    await h.shot('threat-landed');
    errors.push(...h.errors);
    await h.page.close();

    // 4. Launch banners: a rival, then the player; route arcs mid-flight; a GPU crate.
    h = await open(browser);
    await h.live(() => window.__mapLive.launch(undefined, 4));
    await sleep(700);
    await h.shot('banner-rival');
    await sleep(3100);
    await h.live(() => window.__mapLive.launch(window.__game.store.getState().state.playerLabId, 3));
    await sleep(700);
    await h.shot('banner-mine');
    await sleep(3200);
    const route = await h.live(() => window.__mapLive.entry({ channel: 'ocean' }));
    await h.live(() => window.__mapLive.entry({ channel: 'viral' }));
    await sleep(800);
    await h.shot('route-flight');
    await sleep(3200);
    await h.shot('route-faint');
    await h.live(() => window.__mapLive.addCompute(3));
    await sleep(900);
    await h.shot('gpu-crate');
    console.log(`route ${JSON.stringify(route)}`);

    // 5. The region panel of a blocked region (and its barrier mark on the map).
    const blocked = await h.live(() => {
      const s = window.__game.store.getState();
      const lab = s.state.labs[s.state.playerLabId];
      // The selector is not exposed; find a region the player is not in whose links into it carry a barrier the player has no channel for.
      const present = new Set(Object.keys(lab.adoption).filter((id) => lab.adoption[id] > 0));
      const r = s.pack.regions.find((x) => !present.has(x.id) && Object.keys(x.linkBarriers || {}).some((n) => present.has(n)));
      return r ? r.id : null;
    });
    if (blocked) {
      await h.tap(await h.at(...geometry.regions[blocked].centroid));
      await sleep(900);
      await h.shot('region-blocked');
    }
    errors.push(...h.errors);
    await h.page.close();

    // 6. Edge indicator: zoomed in on home, a moment far away.
    h = await open(browser);
    const home2 = await h.live(() => {
      const s = window.__game.store.getState().state;
      return s.labs[s.playerLabId].homeRegion;
    });
    for (let i = 0; i < 3; i++) {
      await h.page.click('[data-testid="map-zoom-in"]');
      await sleep(150);
    }
    await sleep(400);
    await h.live(() => {
      const s = window.__game.store.getState().state;
      const lab = s.labs[s.playerLabId];
      const far = Object.keys(lab.adoption).filter((id) => lab.adoption[id] > 0 && id !== lab.homeRegion);
      window.__mapLive.spawnMoment('threat', { regionId: far[far.length - 1], life: 60 });
      window.__mapLive.spawnMoment('boost', { regionId: far[0], life: 60 });
    });
    await sleep(800);
    await h.shot('edge-indicator');
    errors.push(...h.errors);
    await h.page.close();

    // 7. First-run coach line (a fresh browser context: nothing stored yet).
    h = await open(browser);
    await h.live(() => {
      window.__mapLiveCoach = true;
      window.__game.store.getState().setSpeed(1);
    });
    await h.live(() => window.__mapLive.spawnMoment('boost', { life: 40 }));
    await sleep(800);
    await h.shot('coach-boost');
    errors.push(...h.errors);
    await h.page.close();
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (errors.length) {
    console.log('Page errors:');
    for (const e of [...new Set(errors)]) console.log(`  ${e}`);
    process.exit(1);
  }
}

main()
  .then(() => textScanSummary())
  .catch((err) => {
  console.error(err);
  process.exit(1);
});
