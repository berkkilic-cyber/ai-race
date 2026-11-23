#!/usr/bin/env node
/**
 * Proves sounds fire on the web build, headless: plays part of a run and a few Garage taps
 * and prints the sound log from `window.__feel` (present with `?debug=1`).
 *
 *   npx expo export --platform web && node scripts/sfx/feelcheck.js
 *
 * Race: autostart (seed 7), switch tabs (map -> trees -> map), press a Button, then let
 * the debug bot play in short chunks (real time between chunks, as at 1x, so the rate
 * limits behave as in play) with moments collected and events resolved. Garage: touch
 * taps on the tap stage (with the pitch rate of each), a buy, and an unaffordable buy.
 * Garage lab: stage unlocked, training ready / revealed / kept / scrapped, staff moves,
 * happenings (appear, good, averted, missed), a milestone, the ship-day steps and the
 * choice, the bonus multiplier through the test ad, and 12 s of helpers in Latent Space;
 * each step prints the sounds it made.
 * Checks (exits 1 on failure): the expected sounds appear, no page errors, and the bot
 * stretch never produces more sounds than ticks / 5.
 * Env: CHROME, PORT (default 8791), W, H (default 926x428), INSETS (default 0,47,21,47).
 */
/* global __dirname */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8791);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const VIEW = { width: Number(process.env.W || 926), height: Number(process.env.H || 428) };
const INSETS = process.env.INSETS || '0,47,21,47';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.wav': 'audio/wav' };

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
function counts(names) {
  const c = {};
  for (const n of names) c[n] = (c[n] || 0) + 1;
  return c;
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ missing: run npx expo export --platform web first');
  const server = await serve();
  // Autoplay allowed so the browser actually plays the files (headless has no speakers either way).
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required', `--window-size=${VIEW.width},${VIEW.height}`] });
  const errors = [];
  const wavs = new Set();
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && /AI-RACE ERROR/.test(m.text())) errors.push(m.text());
    });
    page.on('requestfinished', (r) => {
      if (/\.wav(\?|$)/.test(r.url())) wavs.add(path.basename(r.url()).split('.')[0]);
    });
    await page.setViewport({ ...VIEW, deviceScaleFactor: 1, hasTouch: true });
    const cdp = await page.createCDPSession();
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i, radiusX: 2, radiusY: 2, force: 1 })) });
    const tapAt = async (p) => {
      await touch('touchStart', [p]);
      await sleep(30);
      await touch('touchEnd', []);
      await sleep(60);
    };
    const box = (sel) =>
      page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, sel);
    const tapSel = async (sel) => {
      const b = await box(sel);
      if (!b) throw new Error(`no ${sel}`);
      await tapAt(b);
    };
    const log = () => page.evaluate(() => window.__feel.log());
    const q = `debug=1&adseconds=1&insets=${INSETS}`;

    // ── Race ──
    await page.goto(`http://127.0.0.1:${PORT}/?${q}&autostart=1&seed=7`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`http://127.0.0.1:${PORT}/?${q}&autostart=1&seed=7`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__feel && window.__game && window.__game.store.getState().state, { timeout: 20000 });
    await page.evaluate(() => window.__game.store.getState().setSpeed(0));
    await sleep(500);
    const start = (await log()).length;
    // Tabs: trees, then back to the map.
    await tapSel('[role="tab"]:nth-of-type(2)').catch(async () => {
      const tabs = await page.$$('[role="tab"]');
      const b = await tabs[1].boundingBox();
      await tapAt({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
    });
    await sleep(400);
    const tabs = await page.$$('[role="tab"]');
    const b0 = await tabs[0].boundingBox();
    await tapAt({ x: b0.x + b0.width / 2, y: b0.y + b0.height / 2 });
    await sleep(400);
    const afterTabs = (await log()).slice(start);
    check(afterTabs.filter((n) => n === 'tab').length >= 2, `tab switches sound (${afterTabs.join(', ') || 'none'})`);

    // A Button press (any visible button with role=button and a testID that is a Button: the Regions list).
    const buttons = await page.$$('[data-testid="map-regions"], [data-testid="regions-button"]');
    if (buttons.length) {
      const bb = await buttons[0].boundingBox();
      await tapAt({ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 });
      await sleep(300);
      const closer = await box('[data-testid="sheet-close"]');
      if (closer) await tapAt(closer);
      await sleep(300);
    }

    // A region launch dispatched as the region panel would (with cash to pay for it).
    const launched = await page.evaluate(() => {
      const st = window.__game.store.getState();
      const s = st.state;
      const id = s.playerLabId;
      window.__game.store.setState({ state: { ...s, labs: { ...s.labs, [id]: { ...s.labs[id], cash: s.labs[id].cash + 5000 } } } });
      const region = st.pack.regions.find((r) => !(s.labs[id].adoption[r.id] > 0));
      return window.__game.store.getState().dispatch({ type: 'launchInRegion', labId: id, regionId: region.id }).ok;
    });
    await sleep(200);
    check(launched && (await log()).includes('region-launch'), 'a region launch sounds');

    // Bot stretch: 600 ticks in chunks of 10, 150 ms apart (about 1x pace at 30x speed in real time).
    const before = (await log()).length;
    let ticks = 0;
    for (let i = 0; i < 60; i++) {
      ticks += await page.evaluate(() => window.__game.advance(10, { bot: true, collectMoments: true }));
      await sleep(150);
    }
    // Push composure to a warning, then finish the run with the bot.
    await page.evaluate(() => window.__game.setMeters({ regulation: 70 }));
    await page.evaluate(() => window.__game.advance(1, {}));
    await sleep(200);
    const race = (await log()).slice(before);
    console.log(`\nrace bot stretch: ${ticks} ticks, ${race.length} sounds`);
    console.log(`  counts: ${JSON.stringify(counts(race))}`);
    console.log(`  first 40: ${race.slice(0, 40).join(' ')}`);
    check(race.length <= ticks / 5, `no sound per tick (${race.length} sounds in ${ticks} ticks)`);
    for (const n of ['buy', 'event-open', 'event-confirm', 'meter-warning']) check(race.includes(n), `race plays ${n}`);
    const any = race.filter((n) => ['moment-boost', 'moment-averted'].includes(n));
    check(any.length > 0, `moments collected sound (${any.length})`);
    // Run to the end.
    for (let i = 0; i < 400; i++) {
      const ended = await page.evaluate(() => {
        window.__game.advance(20, { bot: true, collectMoments: true });
        return window.__game.store.getState().state?.status === 'ended';
      });
      if (ended) break;
      await sleep(20);
    }
    await sleep(800);
    const tail = (await log()).slice(-6);
    console.log(`  last sounds of the run: ${tail.join(' ')}`);
    check(tail.some((n) => n === 'win-sting' || n === 'lose-sting'), 'the ending plays a sting');
    const full = await log();
    console.log(`  whole race page: ${full.length} sounds, ${JSON.stringify(counts(full))}`);

    // ── Garage ──
    await page.goto(`http://127.0.0.1:${PORT}/garage?${q}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__feel && window.__garage && window.__garage.state(), { timeout: 15000 });
    await page.evaluate(() => window.__garage.scene('fresh'));
    await sleep(400);
    const g0 = (await log()).length;
    const target = await box('[data-testid="garage-tap"]');
    for (let i = 0; i < 14; i++) {
      await touch('touchStart', [{ x: target.x + (i % 3) * 15, y: target.y }]);
      await sleep(20);
      await touch('touchEnd', []);
      await sleep(55); // about 13 taps a second
    }
    // A few more taps so the first generator is affordable (its button is disabled until then).
    for (let i = 0; i < 10 && !(await page.evaluate(() => window.__garage.state().tokens >= 15)); i++) await tapAt(target);
    await sleep(400);
    await tapSel('[data-testid="buy-intern"]').catch(() => undefined);
    await sleep(200);
    const entries = (await page.evaluate(() => window.__feel.entries())).slice(g0);
    const garage = entries.map((e) => e.name);
    console.log(`\ngarage: ${JSON.stringify(counts(garage))}`);
    console.log(`  tap rates: ${entries.filter((e) => e.name === 'garage-tap').map((e) => e.rate.toFixed(2)).join(' ')}`);
    console.log(`  sequence: ${garage.join(' ')}`);
    check(garage.filter((n) => n === 'garage-tap').length >= 10, 'Garage taps sound at 13 taps a second');
    check(garage.includes('garage-buy'), 'the Garage buy sounds');
    // Settings: shared Buttons answer with the tap, the close button with the back sound,
    // and the sound switch silences everything.
    const s0 = (await log()).length;
    await tapSel('[data-testid="garage-settings"]');
    await page.waitForSelector('[data-testid="feel-sound"]', { timeout: 5000 });
    await sleep(300);
    await tapSel('[data-testid="garage-reset"]');
    await sleep(200);
    await tapSel('[data-testid="garage-reset-cancel"]');
    await sleep(200);
    const pressed = (await log()).slice(s0);
    check(pressed.filter((n) => n === 'ui-tap').length === 2, `Buttons tap (${pressed.join(', ')})`);
    await tapSel('[data-testid="feel-sound"]');
    await sleep(200);
    const off = await page.evaluate(() => window.__feel.settings.getState().sound);
    const s1 = (await log()).length;
    await tapSel('[data-testid="garage-reset"]');
    await sleep(200);
    await tapSel('[data-testid="garage-reset-cancel"]');
    await sleep(200);
    check(!off && (await log()).length === s1, 'with sound switched off, presses are silent');
    await tapSel('[data-testid="feel-sound"]');
    await sleep(200);
    const saved = await page.evaluate(() => localStorage.getItem('feel.settings'));
    console.log(`  saved settings: ${saved}`);
    await tapSel('[data-testid="sheet-close"]');
    await sleep(300);
    console.log(`  settings sequence: ${(await log()).slice(s0).join(' ')}`);
    check((await log()).slice(-1)[0] === 'ui-back', 'closing the sheet plays the back sound');

    // ── Garage lab (task 28): every new mechanic through the debug hooks and real taps ──
    const lab = [];
    /** Runs one step and records the sounds it made. */
    const step = async (name, run, wait = 350) => {
      const from = (await log()).length;
      await run();
      await sleep(wait);
      const got = (await log()).slice(from);
      lab.push([name, got]);
      console.log(`  ${name.padEnd(26)} ${got.join(' ') || '(silent)'}`);
      return got;
    };
    const g = (fn, ...args) => page.evaluate(fn, ...args);
    const patch = (fn) => page.evaluate(`(() => { const st = window.__garage.store.getState(); st.replace((${fn})(st.state)); })()`);
    console.log('\ngarage lab:');
    await g(() => window.__garage.scene('fresh'));
    await sleep(300);
    const stage = await step('stage unlocked', () => g(() => window.__garage.grant(2e7)), 900);
    check(stage.includes('garage-stage'), 'moving to the Office plays the stage sound');
    await g(() => window.__garage.store.getState().dismissStage());
    await tapSel('[data-testid="garage-tab-lab"]');
    await sleep(300);
    const ready = await step('training run ready', () => patch('(s) => ({ ...s, training: { ...s.training, charges: s.training.charges + 1 } })'));
    check(ready.includes('training-ready'), 'a training run coming ready chimes');
    const reveal = await step('candidates revealed', () => tapSel('[data-testid="garage-launch-training"]'));
    check(reveal.includes('training-reveal'), 'launching a run reveals with its sound');
    const keepSel = await g(() => {
      const el = document.querySelector('[data-testid^="garage-keep-"]');
      return el ? `[data-testid="${el.getAttribute('data-testid')}"]` : null;
    });
    const kept = await step('candidate kept', () => (keepSel ? tapSel(keepSel) : Promise.resolve()));
    check(kept.includes('model-keep') && !kept.includes('ui-tap'), 'keeping a candidate plays the keep sound (and not the tap)');
    await g(() => window.__garage.training());
    await sleep(300);
    const scrapped = await step('candidates scrapped', () => tapSel('[data-testid="garage-scrap"]'));
    check(scrapped.includes('model-scrap'), 'scrapping plays the scrap sound');
    await g(() => window.__garage.scene('datacentre'));
    await sleep(300);
    await tapSel('[data-testid="garage-tab-lab"]');
    await sleep(200);
    await g(() => document.querySelector('[data-testid="garage-lab-staff"]')?.scrollIntoView({ block: 'nearest' }));
    await sleep(200);
    const staff = await step('staff moved (x2)', async () => {
      await tapSel('[data-testid="garage-staff-research-minus"]');
      await sleep(120);
      await tapSel('[data-testid="garage-staff-safety-minus"]');
    });
    check(staff.filter((n) => n === 'staff-move').length === 2, 'each staff move ticks');
    const shown = await step('happening appears', () => g(() => window.__garage.happening('pizza')));
    check(shown.includes('happening-pop'), 'a happening appearing makes a soft pop');
    const good = await step('happening tapped (good)', () => tapSel('[data-testid="garage-happening"]'));
    check(good.includes('moment-boost'), 'tapping a good happening plays the boost');
    await g(() => window.__garage.happening('bug'));
    await sleep(300);
    const averted = await step('happening tapped (averted)', () => tapSel('[data-testid="garage-happening"]'));
    check(averted.includes('moment-averted'), 'stopping a bad happening plays the averted sound');
    const missed = await step('happening missed', () => patch('(s) => ({ ...s, happening: { uid: s.uidSeq, id: "bug", spawnedAt: s.now, expiresAt: s.now + 300, x: 0.5, y: 0.5 }, uidSeq: s.uidSeq + 1, nextHappeningAt: s.now + 600000 })'), 1200);
    check(missed.includes('happening-miss'), 'a happening slipping away makes a soft miss');
    await tapSel('[data-testid="garage-tab-build"]');
    await sleep(200);
    await patch('(s) => ({ ...s, tokens: 1e15, generators: { ...s.generators, intern: 99 } })');
    await sleep(300);
    const milestone = await step('milestone reached', () => tapSel('[data-testid="buy-intern"]'));
    check(milestone.includes('milestone'), 'buying the 100th of a tier plays the milestone');
    await g(() => window.__garage.scene('ship'));
    await sleep(300);
    const sdReveal = await step('ship day: benchmark', () => g(() => window.__garage.shipDay()), 600);
    check(sdReveal.includes('shipday-reveal'), 'ship day opens with the benchmark reveal');
    const sdPress = await step('ship day: headline', () => tapSel('[data-testid="garage-shipday-next"]'), 500);
    check(sdPress.includes('shipday-press') && !sdPress.includes('ui-tap'), 'the headline lands with the press');
    await tapSel('[data-testid="garage-shipday-next"]');
    await sleep(400);
    const sdChoice = await step('ship day: choice made', () => tapSel('[data-testid="garage-shipday-choice-hype"]'));
    check(sdChoice.includes('event-confirm'), 'picking a launch plan stamps');
    const shipped = await step('ship it', () => tapSel('[data-testid="garage-shipday-ship"]'), 600);
    check(shipped.includes('garage-ship'), 'shipping plays the rocket');
    await g(() => window.__garage.store.getState().dismissLaunch());
    await g(() => window.__garage.scene('office'));
    await sleep(300);
    await g(() => window.__garage.bonusOffer('golden'));
    await page.waitForSelector('[data-testid="ad-bonusMultiply"]', { timeout: 5000 });
    await tapSel('[data-testid="ad-bonusMultiply"]');
    await page.waitForSelector('[data-testid="mock-ad-claim"]', { timeout: 5000 });
    await sleep(1300);
    const multiplied = await step('bonus multiplied', () => tapSel('[data-testid="mock-ad-claim"]'), 500);
    check(multiplied.includes('bonus-multiply'), 'claiming the multiplier plays its sound');
    await g(() => window.__garage.scene('latent'));
    await sleep(300);
    const auto0 = await g(() => window.__garage.state().stats.autoBought);
    const helpers = await step('helpers (12 s, auto-buy on)', () => patch('(s) => ({ ...s, nextAutoBuyAt: s.now + 1000, nextHappeningAt: s.now + 500 })'), 12000);
    const bought = (await g(() => window.__garage.state().stats.autoBought)) - auto0;
    console.log(`    auto-buys in that time: ${bought}`);
    check(bought >= 2 && helpers.filter((n) => n === 'helper-tick').length === 1, `the helpers work quietly: one tick for ${bought} auto-buys`);
    check(helpers.every((n) => ['helper-tick', 'happening-pop'].includes(n)), 'nothing else sounds while the helpers work');

    console.log(`\nWAV files fetched by the page: ${wavs.size} (${[...wavs].sort().join(', ')})`);
    check(wavs.size > 0, 'the browser loaded the sound files');
    check(errors.length === 0, `no page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  } finally {
    await browser.close();
    server.close();
  }
  if (failures) {
    console.log(`\n${failures} check(s) failed`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
