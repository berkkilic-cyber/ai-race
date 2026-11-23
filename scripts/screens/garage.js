#!/usr/bin/env node
/**
 * Garage (idle clicker) screenshots and checks on the web build, with real touch events.
 *
 *   npx expo export --platform web
 *   node scripts/screens/garage.js                                   # 844x390, no insets
 *   W=926 H=428 INSETS=0,47,21,47 node scripts/screens/garage.js
 *   EXPO_PUBLIC_THEME=hazard npx expo export --platform web && THEME=hazard node scripts/screens/garage.js
 *
 * Captures: the mode choice on the title step, a fresh garage, mid-progress, the upgrades
 * panel, a golden moment, an incident, the offline-return panel with its ad option, the
 * test ad, the doubled offline panel, the ship panel and the three ship-day steps and the
 * launch result, every stage's room (garage, office, data centre, company town, latent
 * space) with its Lab tab (training candidates, kept models, staff, helpers), a lab
 * happening, the stage card, stats and achievements, settings, a late save, and (default
 * size, 844 wide, only) a narrow portrait window.
 * Checks (exits 1 if any fails): the mode choice opens /garage; one touch tap earns tokens;
 * two fingers at once count as two taps; a buy works; the golden moment collects; the
 * incident fixes by taps; the offline report doubles through the test ad; ship day ships
 * with the chosen plan; a training candidate can be kept; staff moves; a happening
 * collects; at most one ad offer is on screen in every capture; no page errors; no raw
 * string keys on screen.
 * Screenshots go to docs/screenshots/garage/<theme>-<W>x<H>-NN-name.png.
 * Serves dist/ in-process; the server and browser are closed before exiting.
 * Env: CHROME, PORT (default 8781), W, H, INSETS, THEME (names the files only).
 *
 * PERF=1: instead, a throttled performance check (the method of scripts/screens/perf.js,
 * CPU throttle THROTTLE, default 6x): the data-centre room with blinking racks, a lab
 * happening and a golden moment on screen, then rapid touch tapping on the model for
 * SECONDS (default 5) at TAPS per second (default 10). Prints frame times (average, p95,
 * worst), long tasks, React commits per second and the components that rendered most.
 */
/* global __dirname */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { scanText, textScanSummary } = require('./textScan');

const ROOT = path.join(__dirname, '..', '..');
const DIST = process.env.DIST ? path.resolve(process.env.DIST) : path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'garage');
const PORT = Number(process.env.PORT || 8781);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const VIEW = { width: Number(process.env.W || 844), height: Number(process.env.H || 390) };
const INSETS = process.env.INSETS || '';
const THEME = process.env.THEME || 'neon';
const TAG = `${THEME}-${VIEW.width}x${VIEW.height}`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };
/** Garage keys are not in textScan's list; catch them here. */
const GARAGE_KEY = /\bgarage\.[a-z][\w-]*\.[\w.-]+/;

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

/**
 * In the page: what overlaps that must not. The one ad offer never covers the model's ring
 * or a happening; a happening never covers the ring; the HUD, the model, the offer and the
 * happening stay inside the side insets. Returns a list of problems (empty when clear).
 */
function layoutProblems(insets) {
  const [, right = 0, , left = 0] = (insets || '0,0,0,0').split(',').map(Number);
  const rect = (id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height, id } : null;
  };
  const hit = (a, b) => a && b && a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
  const out = [];
  const tap = rect('garage-tap');
  // The visible ring: a square of 1.04 x the surface height, centred on it.
  const ring = tap ? { x: tap.x + tap.w / 2 - tap.h * 0.52, y: tap.y - tap.h * 0.02, w: tap.h * 1.04, h: tap.h * 1.04, id: 'model' } : null;
  const offer = rect('garage-offer-slot') || rect('garage-bonus-offer');
  const happening = rect('garage-happening-wrap');
  if (hit(offer, ring)) out.push(`${offer.id} covers the model`);
  if (hit(offer, happening)) out.push(`${offer.id} covers the happening`);
  if (hit(happening, ring)) out.push('the happening covers the model');
  for (const r of [rect('garage-hud'), tap, offer, happening]) {
    if (r && (r.x < left - 1 || r.x + r.w > window.innerWidth - right + 1)) out.push(`${r.id} under a side inset`);
  }
  return out;
}
let failures = 0;
function check(ok, what) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
}

/** Installed before the app loads: counts React commits (and what rendered), long tasks and frame times. */
function instrument() {
  window.__perf = { commits: 0, longTasks: [], frames: [], recording: false, renders: {} };
  const perf = window.__perf;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject() {
      return 1;
    },
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      if (!perf.recording) return;
      perf.commits++;
      const stack = [root.current];
      while (stack.length) {
        const f = stack.pop();
        if (f.child && (!f.alternate || f.child !== f.alternate.child)) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
        if ((f.flags & 1) === 1 && typeof f.type !== 'string' && f.type) {
          const t = f.type.render || f.type.type || f.type;
          const name = (t && (t.displayName || t.name)) || 'anon';
          perf.renders[name] = (perf.renders[name] || 0) + 1;
        }
      }
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };
  try {
    new PerformanceObserver((list) => {
      if (!perf.recording) return;
      for (const e of list.getEntries()) perf.longTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    // no long-task support
  }
  let last = 0;
  const loop = (t) => {
    if (perf.recording && last) perf.frames.push(t - last);
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function perfCheck() {
  const THROTTLE = Number(process.env.THROTTLE || 6);
  const SECONDS = Number(process.env.SECONDS || 5);
  const TAPS = Number(process.env.TAPS || 10);
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', `--window-size=${VIEW.width},${VIEW.height}`] });
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(instrument);
    await page.setViewport({ ...VIEW, deviceScaleFactor: 1, hasTouch: true });
    const q = `debug=1${INSETS ? `&insets=${INSETS}` : ''}`;
    await page.goto(`http://127.0.0.1:${PORT}/garage?${q}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__garage && window.__garage.state(), { timeout: 15000 });
    await page.evaluate((scene) => window.__garage.scene(scene), process.env.SCENE || 'datacentre');
    await sleep(500);
    await page.evaluate(() => {
      if (window.__garage.happening) window.__garage.happening('overheat');
      window.__garage.golden('angel');
    });
    const target = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="garage-tap"]').getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    await sleep(1500);
    await page.evaluate(() => Object.assign(window.__perf, { commits: 0, longTasks: [], frames: [], recording: true, renders: {} }));
    const t0 = Date.now();
    let taps = 0;
    while (Date.now() - t0 < SECONDS * 1000) {
      const p = { x: target.x + ((taps % 5) - 2) * 12, y: target.y + ((taps % 3) - 1) * 10, id: taps % 7 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, radiusX: 2, radiusY: 2, force: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      taps++;
      const next = t0 + (taps * 1000) / TAPS;
      if (next > Date.now()) await sleep(next - Date.now());
    }
    const secs = (Date.now() - t0) / 1000;
    const raw = await page.evaluate(() => {
      window.__perf.recording = false;
      return { ...window.__perf, happening: !!document.querySelector('[data-testid="garage-happening"]'), golden: !!document.querySelector('[data-testid="garage-golden"]'), taps: window.__garage.state().stats.taps };
    });
    const frames = raw.frames.slice().sort((a, b) => a - b);
    const avg = frames.reduce((a, f) => a + f, 0) / Math.max(1, frames.length);
    const out = {
      throttle: THROTTLE,
      seconds: +secs.toFixed(1),
      tapsSent: taps,
      frames: frames.length,
      avgFrameMs: +avg.toFixed(1),
      p95FrameMs: +(frames[Math.floor(frames.length * 0.95)] ?? 0).toFixed(1),
      worstFrameMs: +(frames[frames.length - 1] ?? 0).toFixed(1),
      longTasks: raw.longTasks.length,
      longTaskMs: Math.round(raw.longTasks.reduce((a, d) => a + d, 0)),
      commits: raw.commits,
      commitsPerSecond: +(raw.commits / secs).toFixed(1),
      happeningOnScreen: raw.happening,
      goldenOnScreen: raw.golden,
    };
    console.log(JSON.stringify(out));
    const top = Object.entries(raw.renders).sort((a, b) => b[1] - a[1]).slice(0, 12);
    console.log('renders:', top.map(([k, v]) => `${k} ${v}`).join(', '));
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  if (process.env.PERF) return perfCheck();
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ missing: run npx expo export --platform web first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', `--window-size=${VIEW.width},${VIEW.height}`] });
  const errors = [];
  let n = 0;
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && /AI-RACE ERROR/.test(m.text())) errors.push(m.text());
    });
    await page.setViewport({ ...VIEW, deviceScaleFactor: 1, hasTouch: true });
    const cdp = await page.createCDPSession();
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 2, radiusY: 2, force: 1 })) });
    const tapAt = async (p) => {
      await touch('touchStart', [p]);
      await sleep(40);
      await touch('touchEnd', []);
      await sleep(60);
    };
    const box = (id) =>
      page.evaluate((tid) => {
        const el = document.querySelector(`[data-testid="${tid}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
      }, id);
    const tapId = async (id) => {
      await page.evaluate((tid) => {
        const el = document.querySelector(`[data-testid="${tid}"]`);
        if (el) el.scrollIntoView({ block: 'nearest' });
      }, id);
      await sleep(60);
      const b = await box(id);
      if (!b) throw new Error(`no ${id}`);
      await tapAt(b);
    };
    const has = (id) => page.evaluate((tid) => !!document.querySelector(`[data-testid="${tid}"]`), id);
    const g = (fn, ...args) => page.evaluate(fn, ...args);
    const shot = async (name) => {
      n += 1;
      await sleep(350);
      const file = path.join(OUT, `${TAG}-${String(n).padStart(2, '0')}-${name}.png`);
      await page.screenshot({ path: file });
      await scanText(page, name);
      const raw = await page.evaluate(() => document.body.innerText);
      const hit = GARAGE_KEY.exec(raw);
      check(!hit, `${name}: no raw garage keys${hit ? ` (${hit[0]})` : ''}`);
      const ads = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="ad-"]')].map((e) => e.getAttribute('data-testid')));
      check(ads.length <= 1, `${name}: at most one ad offer on screen${ads.length > 1 ? ` (${ads.join(', ')})` : ''}`);
      const clash = await page.evaluate(layoutProblems, INSETS);
      check(clash.length === 0, `${name}: layout clear (offer, happening, model, insets)${clash.length ? ` (${clash.join('; ')})` : ''}`);
      console.log(`     ${path.relative(ROOT, file)}`);
    };
    const q = `debug=1&adseconds=2${INSETS ? `&insets=${INSETS}` : ''}`;

    // 1. Mode choice on the title step.
    await page.goto(`http://127.0.0.1:${PORT}/?${q}`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.waitForSelector('[data-testid="mode-garage"]', { timeout: 15000 });
    await shot('mode-choice');
    await tapId('mode-garage');
    await page.waitForFunction(() => location.pathname === '/garage', { timeout: 10000 }).catch(() => undefined);
    check((await page.evaluate(() => location.pathname)) === '/garage', 'the Garage choice opens /garage');

    // 2. Fresh garage (with the debug handle).
    await page.goto(`http://127.0.0.1:${PORT}/garage?${q}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__garage && window.__garage.state(), { timeout: 15000 });
    await g(() => window.__garage.scene('fresh'));
    await sleep(300);
    const target = await box('garage-tap');
    const taps0 = await g(() => window.__garage.state().stats.taps);
    for (let i = 0; i < 6; i++) await tapAt({ x: target.x + (i % 3) * 20 - 20, y: target.y });
    const taps1 = await g(() => window.__garage.state().stats.taps);
    check(taps1 - taps0 === 6, `six touch taps count six (got ${taps1 - taps0})`);
    // Two fingers down together, then a third while they are held.
    await touch('touchStart', [{ x: target.x - 40, y: target.y, id: 1 }, { x: target.x + 40, y: target.y, id: 2 }]);
    await sleep(30);
    await touch('touchStart', [{ x: target.x - 40, y: target.y, id: 1 }, { x: target.x + 40, y: target.y, id: 2 }, { x: target.x, y: target.y + 30, id: 3 }]);
    await sleep(30);
    await touch('touchEnd', []);
    await sleep(100);
    const taps2 = await g(() => window.__garage.state().stats.taps);
    check(taps2 - taps1 === 3, `three fingers count three taps (got ${taps2 - taps1})`);
    const tokens = await g(() => window.__garage.state().tokens);
    check(tokens > 0, `taps earn tokens (${tokens})`);
    for (let i = 0; i < 8; i++) await tapAt({ x: target.x + 30, y: target.y - 10 });
    // Let the pop-out numbers finish so the capture shows the screen, not a number in flight.
    await sleep(700);
    await shot('fresh');
    await tapId('buy-intern');
    check((await g(() => window.__garage.state().generators.intern)) === 1, 'buying the first generator works');

    // 3. Mid-progress, several generators.
    await g(() => window.__garage.scene('mid'));
    await sleep(200);
    for (let i = 0; i < 5; i++) await tapAt({ x: target.x + (i - 2) * 25, y: target.y });
    await shot('mid-progress');

    // 4. Upgrades panel.
    await tapId('garage-tab-upgrades');
    await shot('upgrades');
    await tapId('garage-tab-build');

    // 5. Golden moment, then collect it.
    await g(() => window.__garage.golden('keynote'));
    await page.waitForSelector('[data-testid="garage-golden"]', { timeout: 5000 });
    await shot('golden');
    await tapId('garage-golden');
    await sleep(200);
    check(!(await has('garage-golden')) && (await g(() => window.__garage.state().stats.goldenCaught)) >= 3, 'tapping the golden moment collects it');
    await shot('frenzy');

    // 6. Incident.
    await g(() => {
      const s = window.__garage.store.getState();
      s.replace({ ...s.state, frenzy: null });
    });
    await g(() => window.__garage.incident('gpu-shortage', 'gpu'));
    await page.waitForSelector('[data-testid="garage-incident"]', { timeout: 5000 });
    await shot('incident');
    for (let i = 0; i < 4; i++) await tapId('garage-incident');
    check(!(await has('garage-incident')), 'tapping the incident fixes it');

    // 7. Offline return with the ad option, the test ad, then doubled.
    await g(() => window.__garage.fastForward(3 * 3600 * 1000 + 12 * 60 * 1000));
    await page.waitForSelector('[data-testid="garage-offline"]', { timeout: 5000 });
    await shot('offline-return');
    const before = await g(() => window.__garage.state().tokens);
    await tapId('ad-offlineDouble');
    await page.waitForSelector('[data-testid="mock-ad"]', { timeout: 5000 });
    await shot('mock-ad');
    await sleep(2300);
    await tapId('mock-ad-claim');
    await sleep(300);
    const after = await g(() => window.__garage.state().tokens);
    const report = await g(() => window.__garage.state().offline);
    check(report && report.doubled && after > before * 1.4, `the test ad doubles the offline earnings (${before} -> ${after})`);
    await shot('offline-doubled');
    await tapId('garage-offline-collect');

    // 8. Ship panel, ship day (reveal, press, choice) and the launch result.
    await g(() => window.__garage.scene('ship'));
    await tapId('garage-tab-ship');
    await shot('ship-panel');
    await tapId('garage-ship-button');
    await page.waitForSelector('[data-testid="garage-shipday-reveal"]', { timeout: 5000 });
    await sleep(700);
    await shot('shipday-reveal');
    await tapId('garage-shipday-next');
    await page.waitForSelector('[data-testid="garage-shipday-press"]', { timeout: 5000 });
    await sleep(500);
    await shot('shipday-press');
    await tapId('garage-shipday-next');
    await page.waitForSelector('[data-testid="garage-shipday-choose"]', { timeout: 5000 });
    await tapId('garage-shipday-choice-hype');
    await shot('shipday-choose');
    await tapId('garage-shipday-ship');
    await page.waitForSelector('[data-testid="garage-launch"]', { timeout: 5000 });
    check((await g(() => window.__garage.state().generation)) === 1, 'shipping advances the model generation');
    check((await g(() => window.__garage.state().shipChoice)) === 'hype', 'ship day ships with the chosen plan');
    await shot('launch-result');
    await tapId('garage-launch-continue');

    // 9. The stages: each room, and the Lab tab as it grows.
    await g(() => window.__garage.scene('office'));
    await g(() => window.__garage.store.setState({ stageCard: 1 }));
    await page.waitForSelector('[data-testid="garage-stage-card"]', { timeout: 5000 });
    await shot('stage-card');
    await tapId('garage-stage-continue');
    await tapId('garage-tab-build');
    await shot('office');
    await tapId('garage-tab-lab');
    await g(() => window.__garage.training());
    await page.waitForSelector('[data-testid="garage-lab-training"]', { timeout: 5000 });
    await shot('lab-candidates');
    const cand = await g(() => window.__garage.state().training.candidates[0].uid);
    const keepId = (await has(`garage-keep-${cand}`)) ? `garage-keep-${cand}` : null;
    if (keepId) {
      await tapId(keepId);
      await sleep(150);
      const full = await g(() => window.__garage.state().training.candidates !== null);
      if (full) {
        await shot('lab-swap');
        const old = await g(() => window.__garage.state().models[0].uid);
        await tapId(`garage-replace-${old}`);
      }
    }
    await sleep(150);
    check(await g((u) => window.__garage.state().models.some((m) => m.uid === u), cand), 'a training candidate can be kept');
    await shot('lab-models');
    await g(() => window.__garage.happening('overheat'));
    await page.waitForSelector('[data-testid="garage-happening"]', { timeout: 5000 });
    await shot('happening');
    const caught0 = await g(() => window.__garage.state().stats.happeningsCaught);
    await tapId('garage-happening');
    await sleep(150);
    check((await g(() => window.__garage.state().stats.happeningsCaught)) === caught0 + 1, 'tapping a happening collects it');
    await g(() => window.__garage.bonusOffer('happening'));
    await page.waitForSelector('[data-testid="garage-bonus-offer"]', { timeout: 5000 });
    await shot('bonus-offer');
    const t0b = await g(() => window.__garage.state().tokens);
    await tapId('ad-bonusMultiply');
    await page.waitForSelector('[data-testid="mock-ad"]', { timeout: 5000 });
    await sleep(2300);
    await tapId('mock-ad-claim');
    await sleep(300);
    check((await g(() => window.__garage.state().tokens)) >= t0b + 9999 && !(await has('garage-bonus-offer')), 'the bonus multiplier pays through the test ad and goes');

    await g(() => window.__garage.scene('datacentre'));
    await tapId('garage-tab-build');
    await g(() => window.__garage.happening('gpu-truck'));
    await shot('datacentre');
    await tapId('garage-tab-lab');
    const safety0 = await g(() => window.__garage.state().staff.safety);
    await tapId('garage-staff-safety-plus');
    check((await g(() => window.__garage.state().staff.safety)) === safety0 + 1, 'staff moves between lanes');
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="garage-lab-staff"]');
      if (el) el.scrollIntoView();
    });
    await shot('lab-staff');

    await g(() => window.__garage.scene('town'));
    await tapId('garage-tab-build');
    await g(() => window.__garage.happening('petition'));
    await shot('town');
    await g(() => window.__garage.scene('latent'));
    await shot('latent');
    await tapId('garage-tab-lab');
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="garage-lab-auto"]');
      if (el) el.scrollIntoView();
    });
    await shot('lab-helpers');
    await tapId('garage-tab-build');

    // 10. Stats and achievements, settings.
    await g(() => window.__garage.scene('late'));
    await sleep(200);
    await shot('late-save');
    await tapId('garage-stats');
    await page.waitForSelector('[data-testid="garage-stats-sheet"]', { timeout: 5000 });
    await shot('stats');
    await tapId('sheet-close');
    await tapId('garage-settings');
    await page.waitForSelector('[data-testid="garage-settings-sheet"]', { timeout: 5000 });
    await shot('settings');
    await tapId('sheet-close');

    // 11. Narrow portrait window (usable, not polished), with the default size's run.
    if (VIEW.width === 844) {
      await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 1, hasTouch: true });
      await sleep(400);
      await shot('narrow');
    }
  } finally {
    await browser.close();
    server.close();
  }
  for (const e of errors) console.log(`page error: ${e}`);
  check(errors.length === 0, 'no page errors');
  const scanned = textScanSummary();
  if (failures || scanned) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
