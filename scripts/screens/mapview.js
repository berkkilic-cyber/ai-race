#!/usr/bin/env node
/**
 * Map view check on the web build: the map's zoom and pan stay where the player put them.
 *
 *   npx expo export --platform web
 *   node scripts/screens/mapview.js                      # 926x428, insets 0,47,21,47
 *   W=844 H=390 INSETS=0,0,0,0 node scripts/screens/mapview.js
 *
 * Steps (each asserted; exits 1 on the first failure):
 *   1. zoom to 3x with the wheel;
 *   2. drag left, right, up and down by fixed amounts: the map moves by the dragged amount;
 *   3. two quick short drags in a row (what a double tap must never be): the view is not reset;
 *   4. let 60 game ticks pass at 3x: the transform is unchanged;
 *   5. tap the home region: the region panel opens; tap empty sea: it closes.
 * Serves dist/ in-process; the server and browser are closed before exiting.
 * Env: CHROME, PORT (default 8772), SEED (7), DAYS (120).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8772);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const VIEW = { width: Number(process.env.W || 926), height: Number(process.env.H || 428) };
const INSETS = process.env.INSETS || '0,47,21,47';
const DAYS = Number(process.env.DAYS || 120);
const WHEEL_STEP = 0.0015;

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

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', `--window-size=${VIEW.width},${VIEW.height}`] });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewport({ ...VIEW, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:${PORT}/?autostart=1&seed=${SEED}&debug=1&insets=${INSETS}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
    await page.addStyleTag({ content: '[data-testid="achievement-toast"]{display:none !important}' });
    await page.evaluate((days) => {
      const g = window.__game;
      g.store.getState().setSpeed(0);
      g.advance(days, { bot: true });
    }, DAYS);
    await sleep(1200);

    /** The map's view transform (scale, tx, ty) read from the moving layer, and the container box. */
    const view = () =>
      page.evaluate(() => {
        // The map's own canvas: a world-map SVG with the geometry's viewBox (not an icon, bubble or overlay SVG).
          const svg = [...document.querySelectorAll('[data-testid="world-map"] svg')].filter((s) => s.viewBox && s.viewBox.baseVal && s.viewBox.baseVal.width > 200).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
        const layer = svg.parentElement;
        const box = layer.parentElement.getBoundingClientRect();
        const m = new DOMMatrixReadOnly(getComputedStyle(layer).transform === 'none' ? undefined : getComputedStyle(layer).transform);
        return { s: m.a, tx: m.e, ty: m.f, box: { x: box.x, y: box.y, w: box.width, h: box.height } };
      });
    const drag = async (from, dx, dy, steps = 12, stepMs = 16) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
        await sleep(stepMs);
      }
      await page.mouse.up();
      await sleep(250);
    };

    const v0 = await view();
    const centre = { x: v0.box.x + v0.box.w / 2, y: v0.box.y + v0.box.h / 2 };
    console.log(`viewport ${VIEW.width}x${VIEW.height} insets ${INSETS}; map area ${Math.round(v0.box.w)}x${Math.round(v0.box.h)}; start scale ${v0.s.toFixed(2)}`);

    // 1. Zoom to 3x around the centre.
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.wheel({ deltaY: -Math.log(3 / v0.s) / WHEEL_STEP });
    await sleep(400);
    const v1 = await view();
    check(Math.abs(v1.s - 3) < 0.05, `wheel zoom to 3x (scale ${v1.s.toFixed(2)})`);

    // 2. Drag in all four directions.
    let prev = v1;
    for (const [name, dx, dy] of [
      ['left', -120, 0],
      ['right', 200, 0],
      ['up', 0, -60],
      ['down', 0, 90],
    ]) {
      await drag(centre, dx, dy);
      const v = await view();
      const mx = v.tx - prev.tx;
      const my = v.ty - prev.ty;
      check(Math.abs(mx - dx) < 1.5 && Math.abs(my - dy) < 1.5 && Math.abs(v.s - 3) < 0.05, `drag ${name} by ${dx},${dy}: map moved ${mx.toFixed(1)},${my.toFixed(1)} at scale ${v.s.toFixed(2)}`);
      prev = v;
    }

    // 3. Two quick short drags in a row: must pan twice, never count as a double tap (reset).
    await drag(centre, -30, 0, 4, 16);
    await drag(centre, -30, 0, 4, 16);
    await sleep(600);
    const v3 = await view();
    check(Math.abs(v3.s - 3) < 0.05 && Math.abs(v3.tx - (prev.tx - 60)) < 2, `two quick drags pan by -60 and keep the zoom (scale ${v3.s.toFixed(2)}, moved ${(v3.tx - prev.tx).toFixed(1)})`);

    // 4. Sixty ticks at 3x: nothing moves the view.
    const tick0 = await page.evaluate(() => window.__game.store.getState().state.tick);
    await page.evaluate(() => window.__game.store.getState().setSpeed(3));
    await page.waitForFunction((t) => window.__game.store.getState().state.tick >= t + 60 || !!window.__game.store.getState().state.pendingEvent, { timeout: 60000, polling: 100 }, tick0);
    // An event card pauses the run: resolve it and keep going until 60 ticks have passed.
    for (let guard = 0; guard < 20; guard++) {
      const done = await page.evaluate((t) => {
        const g = window.__game;
        const st = g.store.getState();
        if (st.state.tick >= t + 60) return true;
        if (st.state.pendingEvent) {
          const ev = st.pack.events.find((e) => e.id === st.state.pendingEvent.eventId);
          st.dispatch({ type: 'resolveEvent', labId: st.state.playerLabId, choiceId: ev.choices[0].id });
          g.store.getState().dismissEventResult();
        }
        return false;
      }, tick0);
      if (done) break;
      await sleep(800);
    }
    await page.evaluate(() => window.__game.store.getState().setSpeed(0));
    const ticks = (await page.evaluate(() => window.__game.store.getState().state.tick)) - tick0;
    await sleep(400);
    const v4 = await view();
    check(ticks >= 60 && Math.abs(v4.s - v3.s) < 0.001 && Math.abs(v4.tx - v3.tx) < 0.5 && Math.abs(v4.ty - v3.ty) < 0.5, `after ${ticks} ticks at 3x the view is unchanged (scale ${v4.s.toFixed(2)} tx ${v4.tx.toFixed(1)} ty ${v4.ty.toFixed(1)})`);

    // 5. Taps: the home region opens its panel, empty sea closes it.
    const reset = await page.$('[data-testid="map-reset"]');
    await reset.click();
    await sleep(700);
    const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/packs/ai-lab/geometry.json'), 'utf8'));
    const home = await page.evaluate(() => {
      const s = window.__game.store.getState().state;
      return s.labs[s.playerLabId].homeRegion;
    });
    const at = async (mx, my) =>
      page.evaluate(
        (mx, my) => {
          // The map's own canvas: a world-map SVG with the geometry's viewBox (not an icon, bubble or overlay SVG).
          const svg = [...document.querySelectorAll('[data-testid="world-map"] svg')].filter((s) => s.viewBox && s.viewBox.baseVal && s.viewBox.baseVal.width > 200).sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
          const vb = svg.viewBox.baseVal;
          const r = svg.getBoundingClientRect();
          const k = Math.min(r.width / vb.width, r.height / vb.height);
          return { x: r.x + (r.width - vb.width * k) / 2 + mx * k, y: r.y + (r.height - vb.height * k) / 2 + my * k };
        },
        mx,
        my,
      );
    const [hx, hy] = geometry.regions[home].centroid;
    // A moment bubble over the region would (rightly) take the tap: clear them for this check.
    await page.evaluate(() => {
      const st = window.__game.store;
      const s = st.getState().state;
      st.setState({ state: { ...s, moments: [] } });
    });
    await sleep(300);
    const p = await at(hx, hy);
    await page.mouse.click(p.x, p.y);
    await sleep(900);
    check(!!(await page.$('[data-testid="region-sheet"]')), `tap on the home region (${home}) opens its panel`);
    // Empty sea: the middle of the Pacific in map units, as a fraction of the map.
    const sea = await at(geometry.width * 0.02, geometry.height * 0.55);
    if (process.env.VERBOSE) console.log("sea point", sea);
    await page.mouse.click(sea.x, sea.y);
    await sleep(900);
    check(!(await page.$('[data-testid="region-sheet"]')), 'tap on empty sea closes the panel');
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (errors.length) {
    console.log('Page errors:');
    for (const e of [...new Set(errors)]) console.log(`  ${e}`);
  }
  if (failures) {
    console.log(`${failures} check(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
