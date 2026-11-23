#!/usr/bin/env node
/**
 * Analytics check on the web build: plays one bot run through the `?debug=1` handle
 * (window.__game) and prints the events the analytics layer captured (window.__analytics),
 * then opens the debug overlay (two-second long press on the mascot) and screenshots its
 * Analytics section.
 *
 *   npx expo export --platform web && node scripts/screens/analytics.js [outDir]
 *
 * Env: CHROME (default /usr/bin/google-chrome), WIDTH/HEIGHT (default 926x428), SEED (default 3).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots'));
const WIDTH = Number(process.env.WIDTH || 926);
const HEIGHT = Number(process.env.HEIGHT || 428);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SEED = Number(process.env.SEED || 3);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };

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

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', `--window-size=${WIDTH},${HEIGHT}`] });
  const errors = [];
  let code = 0;
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/?debug=1&autostart=1&seed=${SEED}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__game && window.__analytics && window.__game.store.getState().state && location.pathname.startsWith('/game'), { timeout: 30000 });
    await page.waitForFunction(() => window.__analytics.report() !== null, { timeout: 10000 });
    await sleep(500);

    // Open the debug overlay: two-second long press on the mascot.
    const mascot = await page.$('[data-testid="mascot"]');
    if (!mascot) throw new Error('mascot not found');
    const box = await mascot.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await sleep(2300);
    await page.mouse.up();
    await page.waitForSelector('[data-testid="analytics-debug"]', { timeout: 5000 });

    // A bot run, a few hundred ticks at a time so the page can render between chunks.
    let ticks = 0;
    for (let i = 0; i < 40; i++) {
      const done = await page.evaluate(() => {
        window.__game.advance(150, { bot: true, collectMoments: true });
        return window.__game.store.getState().state?.status === 'ended';
      });
      if (done) break;
    }
    ticks = await page.evaluate(() => window.__game.store.getState().state?.tick ?? 0);
    await page.waitForFunction(() => location.pathname === '/end', { timeout: 15000 }).catch(() => undefined);
    await sleep(1500);
    await page.evaluate(() => window.__analytics.flush());
    await sleep(300);

    await page.waitForFunction(() => document.querySelector('[data-testid="analytics-debug"]')?.innerText.includes('run_end'), { timeout: 5000 }).catch(async () => {
      console.log('debug section did not refresh:', await page.evaluate(() => document.querySelector('[data-testid="analytics-debug"]')?.innerText.slice(0, 300)));
      code = 1;
    });
    const shot = path.join(OUT, `analytics-debug-${WIDTH}x${HEIGHT}.png`);
    await page.screenshot({ path: shot });

    const { events, report, writes, stored } = await page.evaluate(() => ({ events: window.__analytics.events(), report: window.__analytics.report(), writes: window.__analytics.writes(), stored: window.__analytics.log().length }));
    const counts = {};
    for (const e of events) counts[e.name] = (counts[e.name] || 0) + 1;
    console.log(`bot run: ${ticks} ticks, ${events.length} events captured, ${stored} in the stored log, ${writes} storage writes`);
    console.log('counts:', JSON.stringify(counts));
    console.log('events:');
    for (const e of events) console.log(`  s${e.s} +${String(e.t - events[0].t).padStart(6)}ms ${e.name} ${JSON.stringify(e.params)}`);
    console.log('report:', JSON.stringify({ day: report.dayIndex, sessions: report.sessions, today: report.sessionsToday, returned: report.returned, funnel: report.funnel.map((f) => [f.step, f.sinceInstall]) }));
    console.log(`screenshot: ${shot}`);
    if (!counts.run_start || !counts.run_end) {
      console.log('FAIL: run_start or run_end missing');
      code = 1;
    }
    if (errors.length) {
      console.log(`page errors (${errors.length}):\n  ${errors.slice(0, 10).join('\n  ')}`);
      code = 1;
    }
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
