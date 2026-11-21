#!/usr/bin/env node
/**
 * Performance check on the web build with Chrome's CPU throttled (a stand-in for a phone
 * running a development build). Three scenarios, mid-game (the bot plays DAYS days first):
 *
 *   run    the game at 3x for TICKS ticks (events auto-resolved with their first choice)
 *   pan    dragging and wheel-zooming the map for about 3 seconds
 *   trees  opening the Trees tab and coming back to the map
 *
 * For each: ticks per second achieved, frame times (average, 95th percentile, worst),
 * long tasks (count and total ms) and React commits (per tick for `run`).
 *
 *   npx expo export --platform web
 *   node scripts/screens/perf.js            # THROTTLE=6 TICKS=300 DAYS=200 W=926 H=428
 *
 * Prints one JSON line per scenario and a table. Serves dist/ in-process; the server and
 * browser are closed before exiting. Env: CHROME, PORT (default 8771), SEED (7), INSETS.
 * LIVE=1: before each scenario, put three moment bubbles, a route and a launch banner on the
 * map (through the `window.__mapLive` debug handle), so the live layers are measured too.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8771);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const VIEW = { width: Number(process.env.W || 926), height: Number(process.env.H || 428) };
const INSETS = process.env.INSETS || '0,47,21,47';
const THROTTLE = Number(process.env.THROTTLE || 6);
const TICKS = Number(process.env.TICKS || 300);
const DAYS = Number(process.env.DAYS || 200);
const SCENARIOS = new Set((process.env.SCENARIOS || 'run,pan,trees').split(','));

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

/** Installed before the app loads: a DevTools hook that counts React commits, a long-task observer and a frame recorder. */
function instrument() {
  window.__perf = { commits: 0, longTasks: [], frames: [], recording: false };
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
      if (!perf.renders) return;
      // Which components rendered in this commit (PerformedWork flag), by name.
      const stack = [root.current];
      while (stack.length) {
        const f = stack.pop();
        // A subtree React skipped keeps its old child pointer (and stale flags): do not descend.
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

function summarise(name, raw, extra = {}) {
  const frames = raw.frames.slice().sort((a, b) => a - b);
  const avg = frames.reduce((s, f) => s + f, 0) / Math.max(1, frames.length);
  const p95 = frames[Math.floor(frames.length * 0.95)] ?? 0;
  const worst = frames[frames.length - 1] ?? 0;
  const out = {
    scenario: name,
    frames: frames.length,
    avgFrameMs: +avg.toFixed(1),
    p95FrameMs: +p95.toFixed(1),
    worstFrameMs: +worst.toFixed(1),
    longTasks: raw.longTasks.length,
    longTaskMs: Math.round(raw.longTasks.reduce((s, d) => s + d, 0)),
    commits: raw.commits,
    ...extra,
  };
  return out;
}

/** Top functions by self time in a CPU profile (PROFILE=1). */
function printProfile(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]);
    const f = n.callFrame;
    const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber}`;
    self.set(key, (self.get(key) || 0) + (dt[i] || 0));
  }
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.PROFILE_TOP || 30));
  for (const [k, v] of top) console.log(`${((v / total) * 100).toFixed(1).padStart(5)}%  ${(v / 1000).toFixed(0).padStart(6)}ms  ${k}`);
  // Inclusive time per function name (PROFILE=2), for the big entry points.
  if (process.env.PROFILE === '2') {
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
    const incl = new Map();
    for (let i = 0; i < profile.samples.length; i++) {
      const seen = new Set();
      for (let id = profile.samples[i]; id !== undefined; id = parent.get(id)) {
        const name = byId.get(id).callFrame.functionName || '(anon)';
        if (seen.has(name)) continue;
        seen.add(name);
        incl.set(name, (incl.get(name) || 0) + (dt[i] || 0));
      }
    }
    console.log('--- inclusive');
    for (const [k, v] of [...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)) console.log(`${(v / 1000).toFixed(0).padStart(6)}ms  ${k}`);
  }
}

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', `--window-size=${VIEW.width},${VIEW.height}`] });
  const results = [];
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewport({ ...VIEW, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(instrument);
    if (process.env.REDUCED) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const base = `http://127.0.0.1:${PORT}`;
    await page.goto(`${base}/?autostart=1&seed=${SEED}&debug=1&insets=${INSETS}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
    await page.addStyleTag({ content: '[data-testid="achievement-toast"]{display:none !important}' });
    await page.evaluate((days) => {
      const g = window.__game;
      g.store.getState().setSpeed(0);
      g.advance(days, { bot: true });
      // Events resolve themselves with the first choice so the loop keeps running.
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
    }, DAYS);
    await sleep(1500);
    if (process.env.RENDERS) await page.evaluate(() => (window.__perfRenders = true));
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    await sleep(1000);

    const live = () =>
      process.env.LIVE
        ? page.evaluate(() => {
            const m = window.__mapLive;
            if (!m) return;
            const s = window.__game.store.getState().state;
            const lab = s.labs[s.playerLabId];
            const mine = s.moments.filter((x) => x.labId === lab.id).length;
            for (let i = mine; i < 3; i++) m.spawnMoment(i % 2 ? 'threat' : 'boost', { life: 100000 });
            m.entry({ channel: 'ocean' }) || m.entry({ channel: 'viral' });
            m.launch();
          })
        : Promise.resolve();
    const start = () =>
      page.evaluate(() => {
        Object.assign(window.__perf, { commits: 0, longTasks: [], frames: [], recording: true, renders: window.__perfRenders ? {} : null });
      });
    const stop = () =>
      page.evaluate(() => {
        window.__perf.recording = false;
        const { commits, longTasks, frames, renders } = window.__perf;
        return { commits, longTasks: longTasks.slice(), frames: frames.slice(), renders };
      });

    if (process.env.PREVISIT) {
      // Visit the other tabs first, so their (now hidden) screens are mounted during the run.
      const tabs = await page.$$('[role="tab"]');
      for (const i of [1, 2, 0]) {
        await tabs[i].click();
        await sleep(800);
      }
    }

    if (SCENARIOS.has('run')) {
      const t0 = await page.evaluate(() => window.__game.store.getState().state.tick);
      if (process.env.PROFILE) {
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
        await cdp.send('Profiler.start');
      }
      await live();
      await start();
      const began = Date.now();
      await page.evaluate(() => window.__game.store.getState().setSpeed(3));
      await page.waitForFunction((target) => {
        const s = window.__game.store.getState().state;
        return s.tick >= target || s.status !== 'running';
      }, { timeout: 600000, polling: 200 }, t0 + TICKS);
      const secs = (Date.now() - began) / 1000;
      await page.evaluate(() => window.__game.store.getState().setSpeed(0));
      const raw = await stop();
      if (process.env.PROFILE) printProfile((await cdp.send('Profiler.stop')).profile);
      if (raw.renders) {
        const top = Object.entries(raw.renders).sort((a, b) => b[1] - a[1]).slice(0, 40);
        console.log('--- component renders per tick');
        for (const [k, v] of top) console.log(`${(v / TICKS).toFixed(2).padStart(7)}  ${k}`);
      }
      const t1 = await page.evaluate(() => window.__game.store.getState().state.tick);
      const ticks = t1 - t0;
      results.push(summarise('run', raw, { ticks, seconds: +secs.toFixed(1), ticksPerSecond: +(ticks / secs).toFixed(2), targetTps: 6, commitsPerTick: +(raw.commits / Math.max(1, ticks)).toFixed(2) }));
    }

    if (SCENARIOS.has('pan')) {
      const box = await page.evaluate(() => {
        const svg = [...document.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
        const r = svg.parentElement.parentElement.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      await page.evaluate(() => window.__game.store.getState().setSpeed(3));
      await live();
      await start();
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      await page.mouse.move(cx, cy);
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel({ deltaY: -120 });
        await sleep(60);
      }
      for (let round = 0; round < 3; round++) {
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        for (let i = 0; i < 30; i++) {
          await page.mouse.move(cx + Math.sin(i / 5) * 120, cy + Math.cos(i / 7) * 60);
          await sleep(16);
        }
        await page.mouse.up();
      }
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel({ deltaY: 120 });
        await sleep(60);
      }
      const raw = await stop();
      await page.evaluate(() => window.__game.store.getState().setSpeed(0));
      results.push(summarise('pan', raw));
    }

    if (SCENARIOS.has('trees')) {
      await page.evaluate(() => window.__game.store.getState().setSpeed(3));
      await start();
      const tabs = await page.$$('[role="tab"]');
      const t0 = Date.now();
      await tabs[1].click();
      await page.waitForSelector('[data-testid^="tree-"], [data-testid="trees-screen"], [data-testid^="node-"]', { timeout: 20000 }).catch(() => undefined);
      const openMs = Date.now() - t0;
      await sleep(2000);
      await tabs[0].click();
      await sleep(1000);
      const raw = await stop();
      await page.evaluate(() => window.__game.store.getState().setSpeed(0));
      results.push(summarise('trees', raw, { openMs }));
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  for (const r of results) console.log(JSON.stringify(r));
  console.table(results);
  if (errors.length) {
    console.log('Page errors:');
    for (const e of [...new Set(errors)]) console.log(`  ${e}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
