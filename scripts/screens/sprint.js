#!/usr/bin/env node
/**
 * Sprint task checks on the exported web build, at 926x428 and 844x390 with
 * `?insets=0,47,21,47`, each in a fresh browser context (empty storage = a first-time player):
 *
 * 1. Start screen: Sprint is preselected for a first-time player, beside the difficulty.
 * 2. Quit and resume: start a Sprint run, play 200 ticks, open the run menu (the game pauses),
 *    Save and quit, see "Continue run" on the start screen, continue, and check the tick and
 *    resources match; then reload the page mid-run and continue again.
 * 3. Restart / abandon confirmations, the discard confirmation when founding a new lab over a save.
 * 4. End screens (a win and a loss) with the close-call line; Rematch replays the same seed.
 *
 *   npx expo export --platform web && node scripts/screens/sprint.js
 *
 * Screenshots: docs/screenshots/sprint/<W>x<H>-<name>.png. Exits non-zero on a failed check.
 * Env: CHROME (default /usr/bin/google-chrome), SIZES (default "926x428,844x390"), INSETS.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { scanText, textScanSummary } = require('./textScan');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'sprint');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SIZES = (process.env.SIZES || '926x428,844x390').split(',').map((s) => s.split('x').map(Number));
const INSETS = process.env.INSETS || '0,47,21,47';

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
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
function check(ok, what) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
}

async function runSize(browser, base, [W, H]) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const tag = `${W}x${H}`;
  const q = `debug=1&insets=${INSETS}`;
  const shot = async (name) => {
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await sleep(400);
    const file = path.join(OUT, `${tag}-${name}.png`);
    await page.screenshot({ path: file });
    await scanText(page, `${tag}-${name}`);
    console.log(`saved ${path.relative(ROOT, file)}`);
  };
  const has = (id) => page.$(`[data-testid="${id}"]`).then((el) => !!el);
  const click = async (id) => {
    await page.waitForSelector(`[data-testid="${id}"]`, { timeout: 8000 });
    await page.click(`[data-testid="${id}"]`);
    await sleep(450);
  };
  const game = (fn, arg) => page.evaluate(fn, arg);
  const snapshot = () =>
    game(() => {
      const s = window.__game.store.getState().state;
      if (!s) return null;
      const p = s.labs[s.playerLabId];
      return { tick: s.tick, hype: p.hype, cash: p.cash, seed: s.seed, runLength: s.runLength, difficulty: s.difficulty, rng: s.rng, status: s.status };
    });
  /** The run stored on the device (what Continue loads). */
  const stored = () =>
    game(() => {
      const text = localStorage.getItem('ai-race.run.v1');
      if (!text) return null;
      const s = JSON.parse(text).state;
      const p = s.labs[s.playerLabId];
      return { tick: s.tick, hype: p.hype, cash: p.cash, seed: s.seed, runLength: s.runLength, difficulty: s.difficulty, rng: s.rng, status: s.status };
    });
  const same = (a, b) => !!a && !!b && a.tick === b.tick && a.hype === b.hype && a.cash === b.cash && a.rng === b.rng;
  const waitPath = (p) => page.waitForFunction((p) => location.pathname === p, { timeout: 10000 }, p);

  console.log(`\n── ${tag} ──`);

  // 1. Start screen, first-time player.
  await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle0' });
  await sleep(800);
  check(!(await has('continue-card')), `${tag}: no Continue card without a save`);
  await click('start-dice');
  await click('start-next');
  await sleep(600);
  const sprintOn = await page.$eval('[data-testid="runlength-sprint"]', (el) => el.getAttribute('aria-checked') ?? el.getAttribute('aria-selected'));
  check(sprintOn === 'true', `${tag}: Sprint preselected for a first-time player (aria ${sprintOn})`);
  await shot('start-founder-sprint');

  // 2. Quit and resume through the menu.
  await page.goto(`${base}/?autostart=1&seed=5&runLength=sprint&${q}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 10000 });
  await game(() => window.__game.store.getState().setSpeed(1));
  await game(() => window.__game.advance(200, { bot: true }));
  await sleep(600);
  const playing = await snapshot();
  check(playing.runLength === 'sprint' && playing.tick >= 200, `${tag}: Sprint run at tick ${playing.tick}`);
  await click('run-menu-button');
  check(await has('run-menu'), `${tag}: run menu opens`);
  check((await game(() => window.__game.store.getState().speed)) === 0, `${tag}: opening the menu pauses the game`);
  const before = await snapshot();
  await sleep(1200);
  check((await snapshot()).tick === before.tick, `${tag}: no ticks while the menu is open`);
  await shot('run-menu');
  // Tap outside: closes and resumes.
  await page.mouse.click(8, H - 8);
  await sleep(400);
  check(!(await has('run-menu')) && (await game(() => window.__game.store.getState().speed)) === 1, `${tag}: tapping outside closes the menu and resumes`);
  await click('run-menu-button');
  await sleep(300);
  // Snapshot with the menu open (paused): what Save and quit writes.
  const atQuit = await snapshot();
  await click('run-menu-restart');
  await shot('run-menu-restart-confirm');
  await click('run-menu-cancel');
  await click('run-menu-save-quit');
  await waitPath('/');
  await page.waitForSelector('[data-testid="continue-card"]', { timeout: 8000 });
  await sleep(500);
  const line = await page.$eval('[data-testid="continue-line"]', (el) => el.textContent);
  check(/Day \d+/.test(line), `${tag}: Continue card shows "${line}"`);
  await shot('start-continue');
  const savedAtQuit = await stored();
  check(same(savedAtQuit, atQuit), `${tag}: Save and quit stored tick ${savedAtQuit && savedAtQuit.tick} with the same hype, cash and rng as the paused run (tick ${atQuit.tick})`);
  await click('continue-run');
  await waitPath('/game');
  // Continue resumes at 1x: compare the first state in the store with the paused one.
  const resumed = await game(() => {
    window.__game.store.getState().setSpeed(0);
    const s = window.__game.store.getState().state;
    const p = s.labs[s.playerLabId];
    return { tick: s.tick, hype: p.hype, cash: p.cash, rng: s.rng, runLength: s.runLength };
  });
  check(resumed.runLength === 'sprint' && resumed.tick >= atQuit.tick && resumed.tick <= atQuit.tick + 2, `${tag}: continued at tick ${resumed.tick} (saved ${atQuit.tick}), still a Sprint`);

  // Reload mid-run, continue again.
  await game(() => window.__game.store.getState().setSpeed(0));
  await sleep(300);
  await game(() => window.__game.advance(60, { bot: true }));
  const atReload = await snapshot();
  // Leave the race page the hard way (a full page load, as a reload does; the debug params kept so
  // window.__game stays available). A cold load of /game itself logs React #418, a hydration
  // mismatch that predates this task (baseline 37f5843), so the reload lands on / here.
  await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle0' });
  await waitPath('/');
  await page.waitForSelector('[data-testid="continue-card"]', { timeout: 8000 });
  const savedAtReload = await stored();
  check(same(savedAtReload, atReload), `${tag}: a reload mid-run kept tick ${savedAtReload && savedAtReload.tick} (left at ${atReload.tick}) with the same hype, cash and rng`);
  await click('continue-run');
  await waitPath('/game');
  const afterReload = await game(() => window.__game.store.getState().state.tick);
  check(afterReload >= atReload.tick && afterReload <= atReload.tick + 2, `${tag}: after a reload continued at tick ${afterReload}`);

  // Back (web history / gesture) opens the menu instead of leaving silently.
  await game(() => window.__game.store.getState().setSpeed(1));
  await page.evaluate(() => history.back());
  await sleep(800);
  const backPath = await page.evaluate(() => location.pathname);
  const backMenu = await has('run-menu');
  console.log(`     back during a run -> path ${backPath}, menu ${backMenu ? 'open' : 'closed'}`);

  // Abandon: confirmation, then no save.
  if (backPath !== '/game') {
    await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle0' });
    await click('continue-run');
    await waitPath('/game');
  }
  if (!(await has('run-menu'))) await click('run-menu-button');
  await click('run-menu-abandon');
  await shot('run-menu-abandon-confirm');
  await click('run-menu-abandon-confirm');
  await waitPath('/');
  await sleep(800);
  check(!(await has('continue-card')), `${tag}: abandoned run leaves no Continue card`);

  // Discard confirmation when founding a lab over a save.
  await page.goto(`${base}/?autostart=1&seed=9&runLength=sprint&${q}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 10000 });
  await game(() => window.__game.advance(30, { bot: true }));
  await click('run-menu-button');
  await click('run-menu-save-quit');
  await waitPath('/');
  await click('continue-new');
  await click('start-dice');
  await click('start-next');
  await click('start-next');
  await sleep(1000);
  await click('start-region-list');
  await click('region-row-canada');
  await sleep(500);
  await click('start-found');
  check(await has('discard-confirm'), `${tag}: founding a new lab over a save asks first`);
  await shot('start-discard-confirm');
  await click('discard-cancel');
  check((await page.evaluate(() => location.pathname)) === '/', `${tag}: "Keep my run" stays on the start screen`);

  // 4. End screens: a win and a loss, Sprint.
  const want = { win: 'end-win', lose: 'end-lose' };
  for (let seed = 1; seed <= 40 && (want.win || want.lose); seed++) {
    await page.goto(`${base}/?autostart=1&seed=${seed}&runLength=sprint&${q}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 10000 });
    await game(() => window.__game.store.getState().setSpeed(0));
    for (let i = 0; i < 20; i++) {
      await game(() => window.__game.advance(200, { bot: true, collectMoments: true }));
      if ((await snapshot()).status === 'ended') break;
    }
    const ending = await game(() => window.__game.store.getState().state.ending);
    if (!ending || !want[ending.kind]) continue;
    console.log(`     seed ${seed}: ${ending.kind} ${ending.endingId} day ${ending.tick + 1}`);
    await waitPath('/end');
    await sleep(2200);
    const call = await page.$eval('[data-testid="end-close-call"]', (el) => el.textContent);
    check(call.length > 10 && !/NaN|undefined|ui\.sprint/.test(call), `${tag}: ${ending.kind} close call "${call}"`);
    check((await has('end-rematch')) && (await has('end-play-again')) && (await has('end-new-lab')), `${tag}: Rematch, New run and Change lab on the end screen`);
    await shot(want[ending.kind]);
    if (ending.kind === 'lose') {
      await click('end-rematch');
      await waitPath('/game');
      const again = await snapshot();
      check(again.seed === seed && again.tick < 5 && again.runLength === 'sprint', `${tag}: Rematch replays seed ${again.seed} from day one`);
    }
    want[ending.kind] = null;
  }
  check(!want.win && !want.lose, `${tag}: captured a win and a loss`);
  const ignorable = (e) => /Requiring unknown module|favicon/.test(e);
  const real = [...new Set(errors)].filter((e) => !ignorable(e));
  check(real.length === 0, `${tag}: no page errors${real.length ? `: ${real.map((e) => e.split('\n')[0]).join(' | ')}` : ''}`);
  await context.close();
}

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const size of SIZES) await runSize(browser, base, size);
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  textScanSummary();
  if (failures.length) {
    console.log(`\n${failures.length} check(s) failed:`);
    for (const f of failures) console.log(`  ${f}`);
    process.exit(1);
  }
  console.log('\nall sprint checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
