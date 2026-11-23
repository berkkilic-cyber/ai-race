#!/usr/bin/env node
/**
 * Performance check on the web build with Chrome's CPU throttled (a stand-in for a phone
 * running a development build). Scenarios (SCENARIOS, comma-separated; default
 * startup,run,pan,trees,svg,engine), mid-game (the bot plays DAYS days first):
 *
 *   startup  a cold load of the start screen and of `/?autostart=1` (time to the first frame
 *            with the screen interactive), the JavaScript loaded (bytes, modules) and which
 *            font files load before the first frame
 *   run      the game at 3x for TICKS ticks (events auto-resolved with their first choice)
 *   pan      dragging and wheel-zooming the map for about 3 seconds
 *   trees    opening the Trees tab and coming back to the map
 *   svg      SVG element and DOM node counts on the map screen
 *   soak     (opt-in) SOAK_MIN minutes (default 10) at 3x, moments tapped, JS heap after
 *            a forced GC every 30 s; reports the heap trend after the first 2 minutes. Keeps
 *            the run alive (debug meter writes) so the same screen is measured throughout.
 *   engine   the engine's public step() per tick in plain Node (no browser), over a full bot
 *            run played the way the UI plays it: median and p95, early and late game
 *
 * For each browser scenario: ticks per second achieved, frame times (average, 95th
 * percentile, worst), long tasks (count, total ms, longest) and React commits (per tick for
 * `run`).
 *
 *   npx expo export --platform web
 *   node scripts/screens/perf.js            # THROTTLE=6 TICKS=300 DAYS=200 W=926 H=428
 *
 * Prints one JSON line per scenario and a table. Serves dist/ (or DIST) in-process; the
 * server and browser are closed before exiting. Env: CHROME, PORT (default 8771), SEED (7),
 * INSETS.
 * LIVE=1: before each scenario, put three moment bubbles, a route and a launch banner on the
 * map (through the `window.__mapLive` debug handle), so the live layers are measured too.
 * RENDERS=1: components rendered per tick during `run`, and the "render roots" (components
 * that rendered while their parent did not: what the store, a context or a timer woke up).
 * PROFILE=1|2: CPU profile of `run` (self time; 2 adds inclusive time). Use an unminified
 * export for readable names: npx expo export --platform web --no-minify --output-dir /tmp/x
 * and DIST=/tmp/x.
 * TRACE=1: Chrome trace of `run`, main-thread self time by event (script, style, layout,
 * paint ...): what the CPU profile calls "(program)". Use a small TICKS (e.g. 60).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.resolve(process.env.DIST || path.join(ROOT, 'dist'));
const PORT = Number(process.env.PORT || 8771);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const VIEW = { width: Number(process.env.W || 926), height: Number(process.env.H || 428) };
const INSETS = process.env.INSETS || '0,47,21,47';
const THROTTLE = Number(process.env.THROTTLE || 6);
const TICKS = Number(process.env.TICKS || 300);
const DAYS = Number(process.env.DAYS || 200);
const SCENARIOS = new Set((process.env.SCENARIOS || 'startup,run,pan,trees,svg,engine').split(','));
const SOAK_MIN = Number(process.env.SOAK_MIN || 10);

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
  window.__perf = { commits: 0, longTasks: [], frames: [], recording: false, tickToCommit: [], stepMs: [], tickStart: 0 };
  const perf = window.__perf;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject() {
      return 1;
    },
    onScheduleFiberRoot() {},
    onCommitFiberRoot(_id, root) {
      perf.totalCommits = (perf.totalCommits || 0) + 1;
      if (!perf.recording) return;
      const sinceTick = perf.tickStart ? performance.now() - perf.tickStart : -1;
      if (perf.tickStart) {
        perf.tickToCommit.push(sinceTick);
        perf.tickStart = 0;
      }
      perf.commits++;
      if (!perf.renders) return;
      const commitRoots = {};
      let commitRenders = 0;
      // Which components rendered in this commit (PerformedWork flag), by name, and which of
      // them are roots (rendered while the nearest component above did not).
      const stack = [[root.current, false]];
      while (stack.length) {
        const [f, parentRendered] = stack.pop();
        const composite = typeof f.type !== 'string' && !!f.type;
        const rendered = composite && (f.flags & 1) === 1;
        // A subtree React skipped keeps its old child pointer (and stale flags): do not descend.
        if (f.child && (!f.alternate || f.child !== f.alternate.child)) stack.push([f.child, composite ? rendered : parentRendered]);
        if (f.sibling) stack.push([f.sibling, parentRendered]);
        if (rendered) {
          const t = f.type.render || f.type.type || f.type;
          const name = (t && (t.displayName || t.name)) || 'anon';
          perf.renders[name] = (perf.renders[name] || 0) + 1;
          commitRenders++;
          if (!parentRendered) {
            perf.roots[name] = (perf.roots[name] || 0) + 1;
            commitRoots[name] = (commitRoots[name] || 0) + 1;
          }
        }
      }
      // The heaviest commits: how long since the tick that caused them, what woke up, how much rendered.
      perf.slowCommits.push({ ms: +sinceTick.toFixed(1), renders: commitRenders, roots: Object.keys(commitRoots).join(' ') });
      if (perf.slowCommits.length > 40) {
        perf.slowCommits.sort((a, b) => b.renders - a.renders);
        perf.slowCommits.length = 20;
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

const q = (arr, p) => {
  const a = arr.slice().sort((x, y) => x - y);
  return a.length ? +a[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(1) : 0;
};

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
    longestTaskMs: Math.round(raw.longTasks.reduce((m, d) => Math.max(m, d), 0)),
    over100: raw.longTasks.filter((d) => d > 100).length,
    commits: raw.commits,
    ...(raw.stepMs && raw.stepMs.length ? { tickMsMed: q(raw.stepMs, 0.5), tickMsP95: q(raw.stepMs, 0.95), tickMsMax: q(raw.stepMs, 1) } : {}),
    ...(raw.tickToCommit && raw.tickToCommit.length ? { toCommitMsMed: q(raw.tickToCommit, 0.5), toCommitMsP95: q(raw.tickToCommit, 0.95), toCommitMsMax: q(raw.tickToCommit, 1) } : {}),
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
  // PROFILE_FOCUS=name: inclusive time of the functions called (at any depth) under `name`.
  if (process.env.PROFILE_FOCUS) {
    const parentOf = new Map();
    for (const n of profile.nodes) for (const c of n.children || []) parentOf.set(c, n.id);
    const under = new Map();
    let focusTotal = 0;
    for (let i = 0; i < profile.samples.length; i++) {
      const chain = [];
      for (let id = profile.samples[i]; id !== undefined; id = parentOf.get(id)) chain.push(byId.get(id).callFrame);
      const at = chain.findIndex((f) => f.functionName === process.env.PROFILE_FOCUS);
      if (at < 0) continue;
      focusTotal += dt[i] || 0;
      const seen = new Set();
      for (const f of chain.slice(0, at)) {
        const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop().slice(0, 12)}:${f.lineNumber}`;
        if (seen.has(key)) continue;
        seen.add(key);
        under.set(key, (under.get(key) || 0) + (dt[i] || 0));
      }
    }
    console.log(`--- under ${process.env.PROFILE_FOCUS}: ${(focusTotal / 1000).toFixed(0)}ms`);
    for (const [k, v] of [...under.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)) console.log(`${(v / 1000).toFixed(0).padStart(6)}ms ${((v / focusTotal) * 100).toFixed(0).padStart(3)}%  ${k}`);
  }
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


/** The renderer main thread's ids in a trace. */
function mainThreads(events) {
  const main = new Set();
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain') main.add(`${e.pid}:${e.tid}`);
  return main;
}

/**
 * Main-thread CPU time (thread time, `tdur`) of the top-level tasks in a trace. Thread time
 * does not grow when other processes compete for the CPU, nor with Chrome's CPU throttle
 * (which suspends the thread), so it compares runs fairly on a busy machine: it is the
 * unthrottled CPU cost on this machine.
 */
function traceCpu(events) {
  const main = mainThreads(events);
  let cpu = 0;
  let wall = 0;
  let first = Infinity;
  let last = 0;
  const tasks = [];
  for (const e of events) {
    if (!main.has(`${e.pid}:${e.tid}`) || e.ph !== 'X' || e.name !== 'ThreadControllerImpl::RunTask') continue;
    const d = (e.tdur || 0) / 1000;
    cpu += d;
    wall += (e.dur || 0) / 1000;
    tasks.push(d);
    first = Math.min(first, e.ts);
    last = Math.max(last, e.ts + (e.dur || 0));
  }
  tasks.sort((a, b) => b - a);
  return { cpuMs: cpu, wallMs: wall, spanMs: (last - first) / 1000, topTaskCpuMs: tasks.slice(0, 3).map((x) => +x.toFixed(1)) };
}

/** Main-thread self CPU time by trace event name (TRACE=1): what "(program)" in a CPU profile is made of. */
function printTrace(events) {
  const main = mainThreads(events);
  const spans = [];
  for (const e of events) {
    if (!main.has(`${e.pid}:${e.tid}`)) continue;
    if (e.ph === 'X' && e.dur && e.tdur !== undefined) spans.push({ name: e.name, ts: e.ts, end: e.ts + e.dur, cpu: e.tdur });
  }
  spans.sort((a, b) => a.ts - b.ts || b.end - a.end);
  const self = new Map();
  const stack = [];
  for (const sp of spans) {
    while (stack.length && stack[stack.length - 1].end <= sp.ts) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) self.set(parent.name, (self.get(parent.name) || 0) - sp.cpu);
    self.set(sp.name, (self.get(sp.name) || 0) + sp.cpu);
    stack.push(sp);
  }
  const busy = [...self.values()].reduce((a, b) => a + Math.max(0, b), 0);
  console.log(`--- main thread self CPU time by trace event (total ${(busy / 1000).toFixed(0)} ms)`);
  for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, Number(process.env.TRACE_TOP || 20))) {
    console.log(`${((v / busy) * 100).toFixed(1).padStart(5)}%  ${(v / 1000).toFixed(0).padStart(6)}ms  ${k}`);
  }
}

/** Starts a trace: light (top-level tasks only, for CPU time) unless TRACE=1. */
function startTrace(page) {
  const full = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink', 'cc', 'toplevel', '__metadata'];
  return page.tracing.start({ categories: process.env.TRACE ? full : ['toplevel', '__metadata'] });
}

async function stopTrace(page) {
  const events = JSON.parse(new (require('node:util').TextDecoder)().decode(await page.tracing.stop())).traceEvents;
  if (process.env.TRACE) printTrace(events);
  return traceCpu(events);
}

/** Cold loads: start screen and autostart to the map, with what they load. */
async function startup(browser, base) {
  const out = {};
  for (const [label, url, ready] of [
    ['start', `${base}/?insets=${INSETS}`, () => !!document.querySelector('[data-testid="start-next"], [data-testid="start-found"]')],
    ['game', `${base}/?autostart=1&seed=${SEED}&insets=${INSETS}&debug=1`, () => location.pathname === '/game' && document.querySelectorAll('svg path').length > 40],
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ ...VIEW, deviceScaleFactor: 1 });
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(ready, { timeout: 120000, polling: 'raf' });
    // The first frame painted with the screen in place.
    const firstFrameMs = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))));
    const wallMs = Date.now() - t0;
    await sleep(1500);
    const res = await page.evaluate(() =>
      performance.getEntriesByType('resource').map((e) => ({ name: e.name, size: e.decodedBodySize, start: e.startTime, end: e.responseEnd })),
    );
    const js = res.filter((r) => /\.js(\?|$)/.test(r.name));
    const fonts = res.filter((r) => /\.(ttf|otf|woff2?)(\?|$)/.test(r.name));
    const firstJs = js.filter((r) => r.start < firstFrameMs);
    let modules = 0;
    for (const r of firstJs) {
      const file = path.join(DIST, new URL(r.name).pathname);
      if (fs.existsSync(file)) modules += (fs.readFileSync(file, 'utf8').match(/__d\(/g) || []).length;
    }
    out[label] = {
      firstFrameMs: Math.round(firstFrameMs),
      wallMs,
      jsFiles: firstJs.length,
      jsKB: Math.round(firstJs.reduce((a, r) => a + r.size, 0) / 1024),
      modules,
      fontsBeforeFrame: fonts.filter((r) => r.start < firstFrameMs).length,
      fontKBBeforeFrame: Math.round(fonts.filter((r) => r.start < firstFrameMs).reduce((a, r) => a + r.size, 0) / 1024),
      fontsLater: fonts.filter((r) => r.start >= firstFrameMs).length,
      fontNames: fonts.map((r) => path.basename(new URL(r.name).pathname).replace(/\.[0-9a-f]{20,}/, '')).join(' '),
    };
    await page.close();
  }
  let allModules = 0;
  let allKB = 0;
  const jsDir = path.join(DIST, '_expo', 'static', 'js', 'web');
  if (fs.existsSync(jsDir)) {
    for (const f of fs.readdirSync(jsDir)) {
      const file = path.join(jsDir, f);
      allModules += (fs.readFileSync(file, 'utf8').match(/__d\(/g) || []).length;
      allKB += fs.statSync(file).size / 1024;
    }
  }
  return { ...out, bundleKB: Math.round(allKB), bundleModules: allModules };
}

/** The engine's public step() per tick in Node, over a full run played like the UI plays it. */
async function engineBench() {
  const esbuild = require('esbuild');
  const entry = `
    import { aiLabPack } from '@/content';
    import { applyAction, chooseAiActions, chooseEventChoice, createGame, step } from '@/engine';
    export function bench(seed, maxTicks) {
      const pack = aiLabPack;
      let state = createGame(pack, { playerName: 'Bench Lab', founderId: pack.founders[0].id, homeRegion: pack.regions[0].id, seed });
      const costs = [];
      while (state.status === 'running' && state.tick < maxTicks) {
        if (state.pendingEvent) {
          const choice = chooseEventChoice(state, pack, state.playerLabId);
          if (!choice) break;
          const r = applyAction(state, pack, { type: 'resolveEvent', labId: state.playerLabId, choiceId: choice });
          if (!r.ok) break;
          state = r.state;
          continue;
        }
        if (state.tick % 10 === 0) {
          for (const a of chooseAiActions(state, pack, state.playerLabId)) {
            const r = applyAction(state, pack, a);
            if (r.ok) state = r.state;
          }
        }
        for (const m of state.moments) {
          if (m.labId === state.playerLabId && state.tick >= m.spawnTick + 4 && state.tick < m.expiresTick) {
            const r = applyAction(state, pack, { type: 'collectMoment', labId: state.playerLabId, uid: m.uid });
            if (r.ok) state = r.state;
          }
        }
        const t0 = performance.now();
        state = step(state, pack);
        costs.push(performance.now() - t0);
      }
      return { costs, ticks: state.tick, status: state.status };
    }`;
  const built = await esbuild.build({
    stdin: { contents: entry, resolveDir: ROOT, loader: 'ts', sourcefile: 'perf-engine.ts' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    alias: { '@': path.join(ROOT, 'src') },
    logLevel: 'warning',
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', built.outputFiles[0].text)(mod, mod.exports, require);
  const q = (arr, p) => {
    const a = arr.slice().sort((x, y) => x - y);
    return a.length ? +a[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(3) : 0;
  };
  mod.exports.bench(SEED + 1, 400); // warm up the JIT
  const runs = [];
  for (const seed of [SEED, SEED + 11, SEED + 23]) runs.push(mod.exports.bench(seed, 6000));
  const all = runs.flatMap((r) => r.costs);
  const early = runs.flatMap((r) => r.costs.slice(0, 600));
  const late = runs.flatMap((r) => r.costs.slice(Math.max(600, r.costs.length - 600)));
  return {
    scenario: 'engine',
    runs: runs.length,
    ticks: runs.map((r) => r.ticks).join('/'),
    endings: runs.map((r) => r.status).join('/'),
    medianMs: q(all, 0.5),
    p95Ms: q(all, 0.95),
    worstMs: q(all, 1),
    earlyMedianMs: q(early, 0.5),
    earlyP95Ms: q(early, 0.95),
    lateMedianMs: q(late, 0.5),
    lateP95Ms: q(late, 0.95),
    note: `Node ${process.version}, no CPU throttle`,
  };
}

async function main() {
  const results = [];
  if (SCENARIOS.has('engine')) results.push(await engineBench());
  const browserScenarios = [...SCENARIOS].filter((x) => x !== 'engine');
  if (!browserScenarios.length) return report(results, []);
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', `--window-size=${VIEW.width},${VIEW.height}`] });
  const errors = [];
  try {
    const base = `http://127.0.0.1:${PORT}`;
    if (SCENARIOS.has('startup')) {
      const st = await startup(browser, base);
      results.push({ scenario: 'startup', ...st.start, gameFirstFrameMs: st.game.firstFrameMs, gameJsKB: st.game.jsKB, gameModules: st.game.modules, bundleKB: st.bundleKB, bundleModules: st.bundleModules });
      console.log(`startup fonts: start screen ${st.start.fontsBeforeFrame} before first frame (${st.start.fontKBBeforeFrame} KB), ${st.start.fontsLater} later: ${st.start.fontNames}`);
      console.log(`startup fonts: game ${st.game.fontsBeforeFrame} before first frame (${st.game.fontKBBeforeFrame} KB), ${st.game.fontsLater} later: ${st.game.fontNames}`);
    }
    if (!browserScenarios.some((x) => x !== 'startup')) return;
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewport({ ...VIEW, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(instrument);
    if (process.env.REDUCED) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(`${base}/?autostart=1&seed=${SEED}&debug=1&insets=${INSETS}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
    await page.addStyleTag({ content: '[data-testid="achievement-toast"]{display:none !important}' });
    await page.evaluate((days) => {
      const g = window.__game;
      g.store.getState().setSpeed(0);
      g.advance(days, { bot: true });
      // Events resolve themselves with the first available choice so the loop keeps running.
      g.store.subscribe((s) => {
        if (s.state && s.state.pendingEvent && s.state.pendingEvent.labId === s.state.playerLabId) {
          const ev = s.pack.events.find((e) => e.id === s.state.pendingEvent.eventId);
          setTimeout(() => {
            const st = g.store.getState();
            if (!st.state || !st.state.pendingEvent) return;
            // The first choice the player can take (a choice it cannot afford fails).
            for (const c of ev.choices) if (st.dispatch({ type: 'resolveEvent', labId: st.state.playerLabId, choiceId: c.id }).ok) break;
            g.store.getState().dismissEventResult();
          }, 0);
        }
      });
    }, DAYS);
    // Time each tick: the store's tick() (engine step and store listeners) and the time from
    // its start to the React commit it causes.
    await page.evaluate(() => {
      const store = window.__game.store;
      const orig = store.getState().tick;
      store.setState({
        tick() {
          const perf = window.__perf;
          const t0 = performance.now();
          orig();
          if (perf.recording) {
            perf.stepMs.push(performance.now() - t0);
            perf.tickStart = t0;
          }
        },
      });
    });
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
        Object.assign(window.__perf, { commits: 0, longTasks: [], frames: [], recording: true, renders: window.__perfRenders ? {} : null, roots: {}, tickToCommit: [], stepMs: [], tickStart: 0, slowCommits: [] });
      });
    const stop = () =>
      page.evaluate(() => {
        window.__perf.recording = false;
        const { commits, longTasks, frames, renders, roots, tickToCommit, stepMs, slowCommits } = window.__perf;
        return { commits, longTasks: longTasks.slice(), frames: frames.slice(), renders, roots, tickToCommit: tickToCommit.slice(), stepMs: stepMs.slice(), slowCommits };
      });

    if (process.env.PREVISIT) {
      // Visit the other tabs first, so their (now hidden) screens are mounted during the run.
      const tabs = await page.$$('[role="tab"]');
      // PREVISIT=1: Trees and News; or a list of tab indices, e.g. PREVISIT=1,2,3 (3 = Race).
      const visit = process.env.PREVISIT === '1' ? [1, 2] : process.env.PREVISIT.split(',').map(Number);
      for (const i of [...visit, 0]) {
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
      await startTrace(page);
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
      const cpu = await stopTrace(page);
      if (raw.renders) {
        const top = Object.entries(raw.renders).sort((a, b) => b[1] - a[1]).slice(0, 40);
        console.log('--- component renders per tick');
        for (const [k, v] of top) console.log(`${(v / TICKS).toFixed(2).padStart(7)}  ${k}`);
        console.log('--- render roots per tick (rendered while the component above did not)');
        for (const [k, v] of Object.entries(raw.roots).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${(v / TICKS).toFixed(2).padStart(7)}  ${k}`);
        console.log('--- largest commits (components rendered; ms since the tick, -1 = not caused by a tick)');
        for (const c of raw.slowCommits.sort((a, b) => b.renders - a.renders).slice(0, 12)) console.log(`${String(c.renders).padStart(5)}  ${String(c.ms).padStart(6)}ms  ${c.roots}`);
      }
      const t1 = await page.evaluate(() => window.__game.store.getState().state.tick);
      const ticks = t1 - t0;
      results.push(summarise('run', raw, { ticks, seconds: +secs.toFixed(1), ticksPerSecond: +(ticks / secs).toFixed(2), targetTps: 6, commitsPerTick: +(raw.commits / Math.max(1, ticks)).toFixed(2), cpuMsPerTick: +(cpu.cpuMs / Math.max(1, ticks)).toFixed(2), cpuShare: +(cpu.cpuMs / (secs * 1000)).toFixed(2), topTaskCpuMs: cpu.topTaskCpuMs.join('/') }));
    }

    if (SCENARIOS.has('pan')) {
      const box = await page.evaluate(() => {
        const svg = [...document.querySelectorAll('svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
        const r = svg.parentElement.parentElement.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      await page.evaluate(() => window.__game.store.getState().setSpeed(3));
      await live();
      await startTrace(page);
      await start();
      const panBegan = Date.now();
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
      const panSecs = (Date.now() - panBegan) / 1000;
      const cpu = await stopTrace(page);
      await page.evaluate(() => window.__game.store.getState().setSpeed(0));
      results.push(summarise('pan', raw, { seconds: +panSecs.toFixed(1), cpuShare: +(cpu.cpuMs / (panSecs * 1000)).toFixed(2), topTaskCpuMs: cpu.topTaskCpuMs.join('/') }));
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

    if (SCENARIOS.has('svg')) {
      await live();
      await sleep(500);
      const counts = await page.evaluate(() => {
        const svgs = [...document.querySelectorAll('svg')];
        const map = svgs.sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0];
        return {
          svgRoots: svgs.length,
          svgElements: document.querySelectorAll('svg *').length,
          mapSvgElements: map ? map.querySelectorAll('*').length : 0,
          domNodes: document.getElementsByTagName('*').length,
        };
      });
      results.push({ scenario: 'svg', ...counts });
    }

    if (SCENARIOS.has('soak')) {
      results.push(await soak(page, cdp, live));
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  report(results, errors);
}

/** SOAK_MIN minutes at 3x, moments tapped; JS heap after a forced GC every 30 s. */
async function soak(page, cdp, live) {
  await page.evaluate(() => {
    const g = window.__game;
    // The player taps each moment a few ticks after it appears (events resolve themselves, see
    // main); meters and AGI are held below the endings so the run, and the screen being
    // measured, last the whole soak.
    window.__soak = g.store.subscribe((s, prev) => {
      const st = s.state;
      if (!st || !prev.state || st.tick === prev.state.tick) return;
      for (const m of st.moments) {
        if (m.labId === st.playerLabId && st.tick === m.spawnTick + 4) setTimeout(() => g.store.getState().dispatch({ type: 'collectMoment', labId: st.playerLabId, uid: m.uid }), 0);
      }
      if (st.tick % 25 !== 0) return;
      const labs = { ...st.labs };
      let changed = false;
      for (const id of st.labOrder) {
        const l = labs[id];
        if (l.agiProgress > 80 || l.regulation > 70 || l.backlash > 70) {
          labs[id] = { ...l, agiProgress: Math.min(l.agiProgress, 50), regulation: Math.min(l.regulation, 40), backlash: Math.min(l.backlash, 40) };
          changed = true;
        }
      }
      if (changed) setTimeout(() => g.store.setState({ state: { ...g.store.getState().state, labs } }), 0);
    });
    g.store.getState().setSpeed(3);
  });
  await live();
  await cdp.send('HeapProfiler.enable');
  const samples = [];
  const began = Date.now();
  const sample = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const dom = await cdp.send('Memory.getDOMCounters').catch(() => ({ nodes: 0, jsEventListeners: 0 }));
    const st = await page.evaluate(() => {
      const s = window.__game.store.getState().state;
      return { tick: s.tick, status: s.status, path: location.pathname };
    });
    samples.push({ min: +((Date.now() - began) / 60000).toFixed(2), heapMB: +(heap.usedSize / 1048576).toFixed(2), nodes: dom.nodes, listeners: dom.jsEventListeners, ...st });
    console.log(`soak ${JSON.stringify(samples[samples.length - 1])}`);
  };
  await sample();
  while (Date.now() - began < SOAK_MIN * 60000) {
    await sleep(30000);
    await sample();
  }
  await page.evaluate(() => {
    window.__soak();
    window.__game.store.getState().setSpeed(0);
  });
  // Least-squares slope of heap (MB per minute) from minute 2 on.
  const tail = samples.filter((x) => x.min >= 2);
  const n = tail.length;
  const mx = tail.reduce((a, x) => a + x.min, 0) / n;
  const my = tail.reduce((a, x) => a + x.heapMB, 0) / n;
  const slope = tail.reduce((a, x) => a + (x.min - mx) * (x.heapMB - my), 0) / Math.max(1e-9, tail.reduce((a, x) => a + (x.min - mx) ** 2, 0));
  const first = samples[0];
  const last = samples[samples.length - 1];
  return {
    scenario: 'soak',
    minutes: SOAK_MIN,
    samples: samples.length,
    ticks: last.tick - first.tick,
    heapStartMB: first.heapMB,
    heapAt2MB: tail[0] ? tail[0].heapMB : null,
    heapEndMB: last.heapMB,
    heapMaxMB: Math.max(...samples.map((x) => x.heapMB)),
    slopeMBPerMinAfter2: +slope.toFixed(3),
    domNodesStart: first.nodes,
    domNodesEnd: last.nodes,
    listenersStart: first.listeners,
    listenersEnd: last.listeners,
    endPath: last.path,
  };
}

function report(results, errors) {
  // Other work on the machine skews timings: print the load so runs can be compared fairly.
  const os = require('node:os');
  console.log(`load average ${os.loadavg().map((x) => x.toFixed(1)).join(' ')} on ${os.cpus().length} cores`);
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
