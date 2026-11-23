#!/usr/bin/env node
/**
 * Screenshots of the Lab Rep link between the modes (task 25) into docs/screenshots/meta:
 * the start screen's Lab Rep 0 pointer, the perks chip, the perks sheet, the end screen with the
 * Garage reward line, and the Garage with the "From your last race" note. Each size gets a fresh
 * browser context (empty storage).
 *
 *   npx expo export --platform web && node scripts/screens/meta.js [outDir]
 *
 * Env: CHROME (default /usr/bin/google-chrome), SIZES (default "926x428,844x390"),
 *      INSETS (default "0,47,21,47"), REP (Lab Rep for the chip shots, default 14).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots', 'meta'));
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SIZES = (process.env.SIZES || '926x428,844x390').split(',').map((s) => s.split('x').map(Number));
const INSETS = process.env.INSETS || '0,47,21,47';
const REP = Number(process.env.REP || 14);
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

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const errors = [];
  try {
    for (const [W, H] of SIZES) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      const q = `debug=1&insets=${INSETS}`;
      const shot = async (name) => {
        const file = path.join(OUT, `${W}x${H}-${name}.png`);
        await page.screenshot({ path: file });
        console.log(`saved ${file}`);
      };
      const click = async (id) => {
        await page.waitForSelector(`[data-testid="${id}"]`, { timeout: 8000 });
        await page.click(`[data-testid="${id}"]`);
        await sleep(500);
      };
      const toFounderStep = async () => {
        await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle0' });
        await sleep(800);
        await page.type('[data-testid="start-name"]', 'Probably Safe Labs');
        await click('start-next');
        await sleep(600);
      };

      // 1. A first-time player: Lab Rep 0, the pointer instead of a chip.
      await toFounderStep();
      await page.waitForSelector('[data-testid="perks-pointer"]', { timeout: 8000 });
      await shot('01-start-labrep0-pointer');
      await click('perks-pointer');
      await sleep(500);
      await shot('02-perks-sheet-labrep0');
      await click('perks-done');

      // 2. Lab Rep set through the debug handle: the chip and the sheet.
      await page.evaluate((rep) => window.__meta.setLabRep(rep), REP);
      await sleep(600);
      await page.waitForSelector('[data-testid="perks-chip"]', { timeout: 8000 });
      await shot('03-start-perks-chip');
      await click('perks-chip');
      await sleep(500);
      await shot('04-perks-sheet');
      await click('perks-switch');
      await sleep(300);
      await shot('05-perks-sheet-off');
      await click('perks-switch');
      await click('perks-done');

      // 3. A run to its ending with perks: the end screen's Garage line.
      await page.goto(`${base}/?autostart=1&${q}&seed=3&runLength=sprint`, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 10000 });
      await page.evaluate(() => window.__game.store.getState().setSpeed(0));
      for (let i = 0; i < 40; i++) {
        await page.evaluate(() => window.__game.advance(300, { bot: true }));
        if (await page.evaluate(() => window.__game.store.getState().state.status === 'ended')) break;
      }
      await page.waitForFunction(() => location.pathname === '/end', { timeout: 10000 });
      await page.waitForFunction(() => /Lab Rep/.test(document.querySelector('[data-testid="end-reward-line"]')?.textContent ?? ''), { timeout: 8000 });
      await sleep(1800);
      console.log(`end reward: ${await page.$eval('[data-testid="end-reward-line"]', (el) => el.textContent)}`);
      await shot('06-end-garage-reward');

      // 4. To the Garage: the "From your last race" note.
      await click('end-garage');
      await page.waitForFunction(() => location.pathname === '/garage', { timeout: 10000 });
      await page.waitForSelector('[data-testid="garage-race-note"]', { timeout: 10000 });
      await sleep(1500);
      await shot('07-garage-race-note');
      await click('garage-race-note-ok');
      await sleep(300);
      const gone = await page.$('[data-testid="garage-race-note"]');
      console.log(`note dismissed: ${!gone}`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const real = errors.filter((e) => !/favicon|DevTools|Download the React DevTools/.test(e));
  if (real.length) {
    console.log(`page errors:\n${real.join('\n')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
