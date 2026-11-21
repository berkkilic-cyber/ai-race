#!/usr/bin/env node
/**
 * Map touch check on the web build with real touch events (Chrome touch emulation and CDP
 * Input.dispatchTouchEvent, multi-touch for the pinch), not mouse events.
 *
 *   npx expo export --platform web
 *   node scripts/screens/touch.js                                  # 844x390, no insets
 *   W=926 H=428 INSETS=0,47,21,47 node scripts/screens/touch.js
 *
 * Checks (exits 1 if any fails):
 *   tap a region opens its panel (and the hit region is the one tapped); tap the sea closes it;
 *   one-finger drag pans; a pinch zooms around its midpoint; the zoomed view survives 60 ticks
 *   at 3x; a tap after zooming selects the right region; a double tap resets the view;
 *   the Regions button opens the list and a row opens that region's panel;
 *   a two-second long press on the mascot shows the touch debug overlay;
 *   the tutorial's "tap your home region" completes by a map tap, and (fresh run) by the
 *   Regions button, whose hint appears after a few seconds;
 *   on the start screen, the home-region picker takes a tap, a pinch and a drag.
 * Screenshots go to docs/screenshots/native/touch-<W>x<H>-*.png.
 * Serves dist/ in-process; the server and browser are closed before exiting.
 * Env: CHROME, PORT (default 8773), SEED (7), DAYS (120), W, H, INSETS.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'native');
const PORT = Number(process.env.PORT || 8773);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const VIEW = { width: Number(process.env.W || 844), height: Number(process.env.H || 390) };
const INSETS = process.env.INSETS || '';
const DAYS = Number(process.env.DAYS || 120);
const TAG = `touch-${VIEW.width}x${VIEW.height}`;

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
let failures = 0;
function check(ok, what) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
}

const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/packs/ai-lab/geometry.json'), 'utf8'));

/** A page with touch emulation and helpers that send real touch events. */
async function touchPage(context, errors) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ ...VIEW, deviceScaleFactor: 1, hasTouch: true });
  const cdp = await page.createCDPSession();
  const send = (type, points) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id ?? 0, radiusX: 2, radiusY: 2, force: 1 })) });
  const h = {
    page,
    async tap(p, holdMs = 60) {
      await send('touchStart', [p]);
      await sleep(holdMs);
      await send('touchEnd', []);
      await sleep(80);
    },
    async drag(from, dx, dy, steps = 12, stepMs = 16) {
      await send('touchStart', [from]);
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', [{ x: from.x + (dx * i) / steps, y: from.y + (dy * i) / steps }]);
        await sleep(stepMs);
      }
      await send('touchEnd', []);
      await sleep(250);
    },
    /** Two fingers at centre ± d0 horizontally, spreading to ± d1. */
    async pinch(c, d0, d1, steps = 12) {
      const pts = (d) => [
        { x: c.x - d, y: c.y, id: 1 },
        { x: c.x + d, y: c.y, id: 2 },
      ];
      await send('touchStart', [pts(d0)[0]]);
      await send('touchStart', pts(d0));
      for (let i = 1; i <= steps; i++) {
        await send('touchMove', pts(d0 + ((d1 - d0) * i) / steps));
        await sleep(16);
      }
      // One finger lifts (a move with the remaining finger only), then the other.
      await send('touchMove', [pts(d1)[1]]);
      await send('touchEnd', []);
      await sleep(300);
    },
    async hold(p, ms) {
      await send('touchStart', [p]);
      await sleep(ms);
      await send('touchEnd', []);
      await sleep(200);
    },
    /** The map's view transform and the map box. */
    view: () =>
      page.evaluate(() => {
        const svg = [...document.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
        const layer = svg.parentElement;
        const box = document.querySelector('[data-testid="map-touch"]').getBoundingClientRect();
        const t = getComputedStyle(layer).transform;
        const m = new DOMMatrixReadOnly(t === 'none' ? undefined : t);
        return { s: m.a, tx: m.e, ty: m.f, box: { x: box.x, y: box.y, w: box.width, h: box.height } };
      }),
    /** Page point of a map point (map units) under the current transform. */
    at: (mx, my) =>
      page.evaluate(
        (mx, my) => {
          const svg = [...document.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
          const vb = svg.viewBox.baseVal;
          const r = svg.getBoundingClientRect();
          const k = Math.min(r.width / vb.width, r.height / vb.height);
          return { x: r.x + (r.width - vb.width * k) / 2 + mx * k, y: r.y + (r.height - vb.height * k) / 2 + my * k };
        },
        mx,
        my,
      ),
    has: (testID) => page.evaluate((id) => !!document.querySelector(`[data-testid="${id}"]`), testID),
    touchInfo: () => page.evaluate(() => JSON.parse(JSON.stringify(window.__game.touch()))),
    async point(testID) {
      return page.evaluate((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }, testID);
    },
    async shot(name) {
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await sleep(350);
      const file = path.join(OUT, `${TAG}-${name}.png`);
      await page.screenshot({ path: file });
      console.log(`     saved ${path.relative(ROOT, file)}`);
    },
  };
  return h;
}

/** A visible point inside a region (its centroid when that hits it, else a sample inside its box). */
function insidePoint(id) {
  return geometry.regions[id].centroid;
}

async function mapChecks(context, errors) {
  const h = await touchPage(context, errors);
  const { page } = h;
  const q = `debug=1${INSETS ? `&insets=${INSETS}` : ''}`;
  await page.goto(`http://127.0.0.1:${PORT}/?autostart=1&seed=${SEED}&${q}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
  await page.addStyleTag({ content: '[data-testid="achievement-toast"]{display:none !important}' });
  await page.evaluate((days) => {
    const g = window.__game;
    g.store.getState().setSpeed(0);
    g.advance(days, { bot: true });
  }, DAYS);
  await sleep(1000);
  const home = await page.evaluate(() => {
    const s = window.__game.store.getState().state;
    return s.labs[s.playerLabId].homeRegion;
  });
  const v0 = await h.view();
  console.log(`viewport ${VIEW.width}x${VIEW.height} insets ${INSETS || 'none'}; map ${Math.round(v0.box.w)}x${Math.round(v0.box.h)} at ${Math.round(v0.box.x)},${Math.round(v0.box.y)}; scale ${v0.s.toFixed(2)}`);

  // Tap the home region.
  let p = await h.at(...insidePoint(home));
  await h.tap(p);
  await sleep(500);
  let info = await h.touchInfo();
  check((await h.has('region-sheet')) && info.region === home, `tap on ${home} opens its panel (hit ${info.region}; callbacks ${info.callbacks.map((c) => c.name).join(',')})`);
  // The sea (far west Pacific) closes it. Wait out the double-tap window first.
  await sleep(400);
  p = await h.at(geometry.width * 0.02, geometry.height * 0.45);
  await h.tap(p);
  await sleep(500);
  info = await h.touchInfo();
  check(!(await h.has('region-sheet')), `tap on the sea closes the panel (hit ${info.region})`);

  // Pinch to zoom in around the map centre.
  await sleep(400);
  const c = { x: v0.box.x + v0.box.w * 0.45, y: v0.box.y + v0.box.h / 2 };
  const before = await h.view();
  const mapPt = await page.evaluate(
    (cx, cy) => {
      const svg = [...document.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
      const vb = svg.viewBox.baseVal;
      const r = svg.getBoundingClientRect();
      const k = Math.min(r.width / vb.width, r.height / vb.height);
      return { x: (cx - r.x - (r.width - vb.width * k) / 2) / k, y: (cy - r.y - (r.height - vb.height * k) / 2) / k };
    },
    c.x,
    c.y,
  );
  await h.pinch(c, 40, 120);
  const v1 = await h.view();
  const back = await h.at(mapPt.x, mapPt.y);
  check(v1.s > before.s * 2.6 && v1.s < before.s * 3.4, `pinch 80→240 pt zooms ×3 (scale ${before.s.toFixed(2)} → ${v1.s.toFixed(2)})`);
  check(Math.abs(back.x - c.x) < 3 && Math.abs(back.y - c.y) < 3, `the pinch midpoint stays under the fingers (moved ${(back.x - c.x).toFixed(1)},${(back.y - c.y).toFixed(1)})`);

  // One-finger drags pan.
  let prev = v1;
  for (const [name, dx, dy] of [
    ['left', -100, 0],
    ['right', 160, 0],
    ['up', 0, -50],
    ['down', 0, 70],
  ]) {
    await h.drag(c, dx, dy);
    const v = await h.view();
    if (process.env.VERBOSE) console.log(JSON.stringify(await h.touchInfo()));
    check(Math.abs(v.tx - prev.tx - dx) < 1.5 && Math.abs(v.ty - prev.ty - dy) < 1.5 && Math.abs(v.s - v1.s) < 0.01, `drag ${name} ${dx},${dy}: moved ${(v.tx - prev.tx).toFixed(1)},${(v.ty - prev.ty).toFixed(1)} (scale ${v.s.toFixed(2)})`);
    prev = v;
  }
  // Two quick drags: never a double tap.
  await h.drag(c, -30, 0, 4, 16);
  await h.drag(c, -30, 0, 4, 16);
  await sleep(500);
  const v2 = await h.view();
  check(Math.abs(v2.s - v1.s) < 0.01 && Math.abs(v2.tx - (prev.tx - 60)) < 2, `two quick drags pan by -60 and keep the zoom (moved ${(v2.tx - prev.tx).toFixed(1)})`);
  await h.shot('zoomed');

  // 60 ticks at 3x: the view stays put.
  const t0 = await page.evaluate(() => {
    const g = window.__game;
    // Events resolve themselves with the first choice so the clock keeps running.
    g.store.subscribe((s) => {
      if (s.state && s.state.pendingEvent && s.state.pendingEvent.labId === s.state.playerLabId) {
        const ev = s.pack.events.find((e) => e.id === s.state.pendingEvent.eventId);
        setTimeout(() => {
          const st = g.store.getState();
          if (!st.state || !st.state.pendingEvent) return;
          st.dispatch({ type: 'resolveEvent', labId: st.state.playerLabId, choiceId: ev.choices[0].id });
          g.store.getState().dismissEventResult();
        }, 0);
      }
    });
    return g.store.getState().state.tick;
  });
  await page.evaluate(() => window.__game.store.getState().setSpeed(3));
  await page.waitForFunction((t) => window.__game.store.getState().state.tick >= t + 60, { timeout: 60000, polling: 100 }, t0);
  await page.evaluate(() => window.__game.store.getState().setSpeed(0));
  await sleep(400);
  const v3 = await h.view();
  check(Math.abs(v3.s - v2.s) < 0.001 && Math.abs(v3.tx - v2.tx) < 0.5 && Math.abs(v3.ty - v2.ty) < 0.5, `after 60+ ticks at 3x the zoomed view is unchanged (scale ${v3.s.toFixed(2)})`);

  // A tap after zooming selects the region under the finger. Each target is located right
  // before its tap (opening a panel re-centres the map), large regions only so the marker
  // point lies inside the region's own shape.
  const box = v3.box;
  const tried = [];
  for (const [id, g] of Object.entries(geometry.regions).sort((a, b) => b[1].area - a[1].area)) {
    if (tried.length >= 3) break;
    const q2 = await h.at(g.centroid[0], g.centroid[1]);
    const free = (await h.has('region-sheet')) ? box.w * 0.5 : box.w;
    if (!(q2.x > box.x + 70 && q2.x < box.x + free - 20 && q2.y > box.y + 30 && q2.y < box.y + box.h - 30)) continue;
    tried.push(id);
    await h.tap(q2);
    await sleep(700);
    info = await h.touchInfo();
    check(info.region === id && (await h.has('region-sheet')), `tap at ${id} (${Math.round(q2.x)},${Math.round(q2.y)}) after zoom selects ${info.region}`);
    await sleep(350);
  }
  check(tried.length > 0, `tapped ${tried.length} region(s) after zoom`);
  const vSel = await h.view();
  check(Math.abs(vSel.s - v3.s) < 0.01, `opening panels keeps the zoom (scale ${vSel.s.toFixed(2)})`);
  await h.shot('panel');
  // Close via the sea, then a double tap resets the view.
  await page.click('[data-testid="region-sheet"] [aria-label]').catch(() => undefined);
  await sleep(400);
  const dt = { x: box.x + box.w * 0.2, y: box.y + box.h * 0.9 };
  await h.tap(dt);
  await sleep(120);
  await h.tap(dt);
  await sleep(700);
  const v4 = await h.view();
  check(Math.abs(v4.s - v0.s) < 0.02, `double tap resets the view (scale ${v4.s.toFixed(2)})`);

  // Regions panel.
  await sleep(400);
  const btn = await h.point('map-regions');
  await h.tap(btn);
  await sleep(600);
  check(await h.has('regions-sheet'), 'the Regions button opens the list');
  await h.shot('regions');
  const target = Object.entries(geometry.regions).sort((a, b) => a[1].area - b[1].area)[3][0];
  await page.type('[data-testid="regions-search"]', '');
  const row = await h.point(`regions-row-${target}`);
  if (row) {
    await page.evaluate((id) => document.querySelector(`[data-testid="regions-row-${id}"]`).scrollIntoView({ block: 'center' }), target);
    await sleep(200);
    await h.tap(await h.point(`regions-row-${target}`));
    await sleep(900);
  }
  const title = await page.evaluate(() => document.querySelector('[data-testid="region-sheet"]')?.textContent ?? '');
  const name = await page.evaluate((id) => {
    const s = window.__game.store.getState();
    const r = s.pack.regions.find((x) => x.id === id);
    return s.pack.strings.en[r.nameKey];
  }, target);
  check(!!row && title.includes(name) && !(await h.has('regions-sheet')), `a row (${target}, a small region) opens its panel`);
  const centred = await h.at(...geometry.regions[target].centroid);
  const vis = await h.view();
  check(centred.x > vis.box.x && centred.x < vis.box.x + vis.box.w && centred.y > vis.box.y && centred.y < vis.box.y + vis.box.h, `and the map brings it into view (at ${Math.round(centred.x)},${Math.round(centred.y)}, scale ${vis.s.toFixed(2)})`);
  await h.shot('regions-picked');

  // Debug overlay: long-press the mascot for two seconds.
  const mascot = await h.point('mascot');
  await h.hold(mascot, 2300);
  await sleep(300);
  check(await h.has('map-debug'), 'a two-second long press on the mascot shows the touch debug overlay');
  await h.tap(await h.at(...insidePoint(home)));
  await sleep(500);
  await h.shot('debug');
  await page.close();
}

/** The start screen's home-region picker: a tap picks the region, a drag pans, a pinch zooms. */
async function pickerChecks(context, errors) {
  const h = await touchPage(context, errors);
  const { page } = h;
  await page.goto(`http://127.0.0.1:${PORT}/?debug=1${INSETS ? `&insets=${INSETS}` : ''}`, { waitUntil: 'networkidle0' });
  await page.type('[data-testid="start-name"]', 'Touch Lab');
  for (let i = 0; i < 4 && !(await h.has('picker-map')); i++) {
    const next = await h.point('start-next');
    if (!next) break;
    await h.tap(next);
    await sleep(700);
  }
  if (!(await h.has('picker-map')) && process.env.VERBOSE) console.log(await page.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((e) => e.dataset.testid).join(' ')));
  check(await h.has('picker-map'), 'start screen: the home-region picker map is shown');
  const atPicker = (mx, my) =>
    page.evaluate(
      (mx, my) => {
        const svg = document.querySelector('[data-testid="picker-map"] svg');
        const vb = svg.viewBox.baseVal;
        const r = svg.getBoundingClientRect();
        const k = Math.min(r.width / vb.width, r.height / vb.height);
        return { x: r.x + (r.width - vb.width * k) / 2 + mx * k, y: r.y + (r.height - vb.height * k) / 2 + my * k };
      },
      mx,
      my,
    );
  const target = Object.entries(geometry.regions).sort((a, b) => b[1].area - a[1].area)[1][0];
  await h.tap(await atPicker(...geometry.regions[target].centroid));
  await sleep(500);
  let info = await h.touchInfo();
  const panel = await page.evaluate(() => document.querySelector('[data-testid="start-region-panel"]')?.textContent ?? '');
  const name = await page.evaluate((id) => {
    const s = window.__game.store.getState();
    const r = s.pack.regions.find((x) => x.id === id);
    return s.pack.strings.en[r.nameKey];
  }, target);
  check(info.map === 'picker' && info.region === target && panel.includes(name), `start screen: a tap on ${target} picks it (hit ${info.region})`);
  await h.shot('picker-picked');
  const box = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="picker-touch"]').getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await sleep(400);
  await h.pinch(box, 30, 90);
  info = await h.touchInfo();
  check(info.view.s > 2.5, `start screen: a pinch zooms the picker (scale ${info.view.s.toFixed(2)})`);
  const before = info.view;
  await h.drag(box, -60, 0);
  info = await h.touchInfo();
  check(Math.abs(info.view.tx - before.tx + 60) < 1.5, `start screen: a drag pans the picker (moved ${(info.view.tx - before.tx).toFixed(1)})`);
  await h.shot('picker');
  await page.close();
}

async function tutorialRoute(context, errors, route) {
  const h = await touchPage(context, errors);
  const { page } = h;
  const q = `debug=1&tutorial=1${INSETS ? `&insets=${INSETS}` : ''}`;
  await page.goto(`http://127.0.0.1:${PORT}/?autostart=1&seed=${SEED}&${q}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
  await page.waitForSelector('[data-testid="tutorial-card"]', { timeout: 10000 });
  const caption = () => page.evaluate(() => document.querySelector('[data-testid="tutorial-caption"]')?.textContent ?? '');
  const holeCentre = () =>
    page.evaluate(() => {
      const r = [...document.querySelectorAll('[data-testid="tutorial"] rect')][0];
      if (!r) return null;
      const b = r.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
  const tapTestId = async (id) => {
    await page.waitForSelector(`[data-testid="${id}"]`, { timeout: 8000 });
    await h.tap(await h.point(id));
    await sleep(600);
  };
  await tapTestId('tutorial-next');
  await tapTestId('tutorial-next');
  const tabs = async (i) => {
    const pts = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((el) => { const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }));
    await h.tap(pts[i]);
    await sleep(800);
  };
  await tabs(1);
  await h.tap(await holeCentre());
  await sleep(800);
  await h.tap(await holeCentre());
  await sleep(1500);
  await tabs(0);
  await sleep(900);
  const c0 = await caption();
  check(/home region/i.test(c0), `tutorial (${route}): "tap your home region" is up: "${c0}"`);
  if (route === 'map') {
    await h.tap(await holeCentre());
    await sleep(900);
    const c1 = await caption();
    check((await h.has('region-sheet')) && /Build/i.test(c1), `tutorial: a map tap in the cut-out opens the home panel and moves on: "${c1}"`);
    await h.shot('tutorial-map-tap');
  } else {
    await sleep(4600);
    const c1 = await caption();
    check(/Regions button/i.test(c1), `tutorial: after a few seconds the caption names the Regions button: "${c1}"`);
    await h.shot('tutorial-hint');
    await h.tap(await h.point('map-regions'));
    await sleep(900);
    const c2 = await caption();
    check((await h.has('regions-sheet')) && /list/i.test(c2), `tutorial: the Regions button works through the dimmer and opens the list: "${c2}"`);
    await h.shot('tutorial-list');
    const home = await page.evaluate(() => {
      const s = window.__game.store.getState().state;
      return s.labs[s.playerLabId].homeRegion;
    });
    await page.evaluate((id) => document.querySelector(`[data-testid="regions-row-${id}"]`).scrollIntoView({ block: 'center' }), home);
    await sleep(300);
    await h.tap(await h.point(`regions-row-${home}`));
    await sleep(1000);
    const c3 = await caption();
    check((await h.has('region-sheet')) && /Build/i.test(c3), `tutorial: picking home in the list opens its panel and moves on: "${c3}"`);
  }
  await page.close();
}

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', `--window-size=${VIEW.width},${VIEW.height}`] });
  const errors = [];
  try {
    if (!process.env.ONLY || process.env.ONLY === 'map') await mapChecks(await browser.createBrowserContext(), errors);
    if (!process.env.ONLY || process.env.ONLY === 'picker') await pickerChecks(await browser.createBrowserContext(), errors);
    if (!process.env.ONLY || process.env.ONLY === 'tutorial') {
      await tutorialRoute(await browser.createBrowserContext(), errors, 'map');
      await tutorialRoute(await browser.createBrowserContext(), errors, 'list');
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (errors.length) {
    console.log('Page errors:');
    for (const e of [...new Set(errors)]) console.log(`  ${e}`);
    failures++;
  }
  if (failures) {
    console.log(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('all touch checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
