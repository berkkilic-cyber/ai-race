#!/usr/bin/env node
/**
 * The comeback habits (task 32) on the web build: away storage, daily missions and the
 * streak, and Paradigm Shift, in English and Turkish.
 *
 *   npx expo export --platform web
 *   node scripts/screens/habits.js                                   # 926x428 and 844x390, insets 0,47,21,47
 *   SIZES=844x390 LOCALES=en node scripts/screens/habits.js
 *
 * Captures per size and language: the Garage with the away-storage chip, its sheet, the
 * return card when the storage capped and when it did not, the missions sheet (fresh, in
 * progress, all claimed with the crate), the streak with a day off used, the start
 * screen's missions pill, a mission toast, the Paradigm panel locked, ready, its
 * confirmation and after two shifts with the tree.
 * Checks (exits 1 if any fails): the capped card says the storage filled; a mission claim
 * pays tokens; the crate opens; the Paradigm confirmation lists what is lost and kept and
 * the shift resets the model; no page errors; no raw string keys on screen.
 * Writes docs/screenshots/habits/<locale>-<W>x<H>-NN-name.png. Env: CHROME, PORT (8783).
 */
/* global __dirname */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { scanText } = require('./textScan');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'docs', 'screenshots', 'habits');
const PORT = Number(process.env.PORT || 8783);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const INSETS = process.env.INSETS ?? '0,47,21,47';
const SIZES = (process.env.SIZES || '926x428,844x390').split(',').map((s) => s.split('x').map(Number));
const LOCALES = (process.env.LOCALES || 'en,tr').split(',');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf' };
const RAW_KEY = /\b(garage|ui)\.[a-z][\w-]*\.[\w.-]+/;

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

async function run(browser, [W, H], locale) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && /AI-RACE ERROR/.test(m.text())) errors.push(m.text());
  });
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1, hasTouch: true });
  const tag = `${locale}-${W}x${H}`;
  let n = 0;
  const shot = async (name) => {
    n += 1;
    await sleep(450);
    const file = path.join(OUT, `${tag}-${String(n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    await scanText(page, `${tag} ${name}`);
    const raw = await page.evaluate(() => document.body.innerText);
    const hit = RAW_KEY.exec(raw);
    check(!hit, `${tag} ${name}: no raw keys${hit ? ` (${hit[0]})` : ''}`);
    console.log(`     ${path.relative(ROOT, file)}`);
  };
  const click = async (id) => {
    const ok = await page.evaluate((tid) => {
      const el = document.querySelector(`[data-testid="${tid}"]`);
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    }, id);
    if (!ok) throw new Error(`no ${id}`);
    await sleep(350);
  };
  const has = (id) => page.evaluate((tid) => !!document.querySelector(`[data-testid="${tid}"]`), id);
  const text = (id) => page.evaluate((tid) => document.querySelector(`[data-testid="${tid}"]`)?.innerText ?? '', id);
  const g = (fn, ...args) => page.evaluate(fn, ...args);
  const closeSheet = async () => {
    await page.evaluate(() => document.querySelector('[data-testid="sheet-close"]')?.click());
    await sleep(450);
  };
  const q = `debug=1&lang=${locale}&adseconds=1${INSETS ? `&insets=${INSETS}` : ''}`;

  // ---- Away storage ----
  await page.goto(`http://127.0.0.1:${PORT}/garage?${q}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://127.0.0.1:${PORT}/garage?${q}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__garage && window.__garage.state() && window.__missions, { timeout: 20000 });
  await g(() => window.__garage.setDate('2026-11-25T09:00:00Z'));
  await g(() => window.__garage.scene('mid'));
  await g(() => window.__missions.fresh());
  await sleep(400);
  check(await has('garage-storage'), `${tag}: the away-storage chip is in the header`);
  await shot('garage-storage-bar');
  await click('garage-storage');
  await shot('storage-sheet');
  await closeSheet();

  await g(() => window.__garage.fillStorage());
  await page.waitForSelector('[data-testid="garage-offline"]', { timeout: 5000 });
  check(await has('garage-offline-capped'), `${tag}: a long return says the storage filled`);
  await shot('return-capped');
  await click('garage-offline-collect');
  await g(() => window.__garage.fillStorage(1));
  await page.waitForSelector('[data-testid="garage-offline"]', { timeout: 5000 });
  check(await has('garage-offline-storage'), `${tag}: a short return shows the storage part-full`);
  await shot('return-not-capped');
  await click('garage-offline-collect');

  // ---- Missions ---- (in the Office, so a reward does not move the lab mid-capture)
  await g(() => window.__garage.scene('office'));
  await g(() => window.__missions.fresh(['tap-300', 'regions-5', 'ship-or-win']));
  await click('missions-button');
  check(await has('missions-sheet'), `${tag}: the missions button opens the sheet`);
  await shot('missions-fresh');
  await closeSheet();
  await g(() => {
    window.__missions.progress(1);
    window.__missions.streak({ current: 3, best: 5, lastDay: -1 });
  });
  await click('missions-button');
  await shot('missions-in-progress');
  const before = await g(() => window.__garage.state().tokens);
  await click('mission-claim-tap-300');
  await sleep(500);
  const after = await g(() => window.__garage.state().tokens);
  check(after > before, `${tag}: claiming a mission pays tokens (${Math.round(before)} -> ${Math.round(after)})`);
  await shot('missions-claimed-one');
  await closeSheet();
  await g(() => window.__missions.claimAll(false));
  await click('missions-button');
  await shot('missions-crate-ready');
  await click('missions-crate-open');
  await sleep(500);
  check(await g(() => window.__missions.state().today.crate === true), `${tag}: the daily crate opens`);
  await shot('missions-all-claimed');
  await closeSheet();
  // A day off covered yesterday.
  await g(() => window.__missions.streak({ current: 6, best: 9, lastDay: 0, dayOffIn: 6, coveredYesterday: true }));
  await click('missions-button');
  await page.evaluate(() => document.querySelector('[data-testid="missions-streak"]')?.scrollIntoView({ block: 'center' }));
  check(await has('missions-dayoff-used'), `${tag}: the streak says the day off covered yesterday`);
  await shot('streak-day-off');
  await closeSheet();
  // A toast when a mission completes in play.
  await g(() => {
    window.__missions.fresh(['tap-300', 'regions-5', 'ship-or-win']);
    window.__missions.race('regions', 5);
  });
  await sleep(250);
  check(await has('mission-toast'), `${tag}: a completed mission shows a toast`);
  await shot('mission-toast');
  await sleep(3200);

  // ---- Paradigm Shift ----
  await g(() => window.__garage.scene('late'));
  await g(() => window.__missions.fresh());
  await click('garage-tab-ship');
  await page.evaluate(() => document.querySelector('[data-testid="garage-paradigm"]')?.scrollIntoView({ block: 'start' }));
  await shot('paradigm-locked');
  await g(() => window.__garage.paradigm('ready'));
  await g(() => window.__missions.fresh());
  await click('garage-tab-ship');
  await page.evaluate(() => document.querySelector('[data-testid="garage-paradigm"]')?.scrollIntoView({ block: 'start' }));
  await shot('paradigm-ready');
  await click('garage-paradigm-shift');
  const confirm = await text('garage-paradigm-confirm');
  check(confirm.length > 40, `${tag}: the confirmation lists what is lost and kept`);
  await shot('paradigm-confirm');
  await click('garage-paradigm-yes');
  await sleep(500);
  const st = await g(() => window.__garage.state());
  check(st.generation === 0 && st.paradigm && st.paradigm.count === 1 && st.paradigm.points > 0, `${tag}: the shift resets to Model 1 and pays Moats (${st.paradigm && st.paradigm.points})`);
  await g(() => window.__garage.paradigm('shifted'));
  await g(() => window.__missions.fresh());
  await click('garage-tab-ship');
  await page.evaluate(() => document.querySelector('[data-testid="garage-paradigm-tree"]')?.scrollIntoView({ block: 'start' }));
  await shot('paradigm-tree');

  // ---- Start screen pill ----
  await page.goto(`http://127.0.0.1:${PORT}/?${q}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="missions-start"]', { timeout: 15000 });
  await shot('start-missions-pill');

  check(errors.length === 0, `${tag}: no page errors${errors.length ? ` (${errors.slice(0, 3).join(' | ')})` : ''}`);
  await page.close();
}

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/ missing: run npx expo export --platform web first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--lang=en-US'] });
  try {
    for (const size of SIZES) for (const locale of LOCALES) await run(browser, size, locale);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
