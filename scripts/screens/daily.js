#!/usr/bin/env node
/**
 * Screenshots of the daily challenge and the front page (task 31) into docs/screenshots/daily.
 * For each language (en, tr) and size, in a fresh browser context (empty storage), it plays
 * five dailies on five consecutive debug "todays" (`window.__daily.setToday`), so the streak
 * and the history fill up, and steers the endings so the front page shows several families:
 * the bot plays day 1 and day 5, day 2 is pushed into a ban (Regulation 100), day 3 into a
 * revolt (Backlash 100), day 4 is left idle (a rival usually reaches AGI). It captures the
 * start screen card before and after playing, the run menu's daily warning, the end screen,
 * every front page, the "Copied" confirmation and the Daily history sheet, then prints the
 * daily analytics events (and checks the lab name never reached them).
 *
 *   npx expo export --platform web && node scripts/screens/daily.js [outDir]
 *
 * Env: CHROME (default /usr/bin/google-chrome), SIZES (default "926x428,844x390"),
 *      INSETS (default "0,47,21,47"), LANGS (default "en,tr").
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots', 'daily'));
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SIZES = (process.env.SIZES || '926x428,844x390').split(',').map((s) => s.split('x').map(Number));
const INSETS = process.env.INSETS || '0,47,21,47';
const LANGS = (process.env.LANGS || 'en,tr').split(',');
const DAYS = (process.env.DAYS || '2026-11-21,2026-11-22,2026-11-23,2026-11-24,2026-11-25').split(',');
const LAB = 'Probably Safe Labs';
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
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--lang=en-US'] });
  const errors = [];
  let failures = 0;
  const check = (ok, what) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
    if (!ok) failures++;
  };
  try {
    for (const lang of LANGS) {
      for (const [W, H] of SIZES) {
        const context = await browser.createBrowserContext();
        await context.overridePermissions(base, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
        });
        await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
        const q = `debug=1&insets=${INSETS}&lang=${lang}&today=${DAYS[0]}`;
        const shot = async (name) => {
          const file = path.join(OUT, `${lang}-${W}x${H}-${name}.png`);
          await page.screenshot({ path: file });
          console.log(`saved ${file}`);
        };
        const click = async (id) => {
          await page.waitForSelector(`[data-testid="${id}"]`, { timeout: 10000 }).catch(async (e) => {
            await page.screenshot({ path: path.join(OUT, `${lang}-${W}x${H}-error-${id}.png`) });
            throw e;
          });
          await page.click(`[data-testid="${id}"]`);
          await sleep(500);
        };
        const text = (id) => page.$eval(`[data-testid="${id}"]`, (el) => el.textContent).catch(() => '');

        await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('[data-testid="daily-card"]', { timeout: 10000 });
        await page.type('[data-testid="start-name"]', LAB);
        await sleep(600);
        await shot('01-start-daily-fresh');

        const endings = [];
        for (let d = 0; d < DAYS.length; d++) {
          await page.evaluate((key) => window.__daily.setToday(key), DAYS[d]);
          await sleep(400);
          if (d === DAYS.length - 1) await shot('02-start-daily-before');
          await click('daily-play');
          await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 15000 });
          await page.evaluate(() => window.__game.store.getState().setSpeed(0));
          if (d === 1) {
            // The run menu's warning for a scored daily.
            await page.evaluate(() => window.__game.advance(60, { bot: true }));
            await click('run-menu-button');
            await click('run-menu-abandon');
            await page.waitForSelector('[data-testid="run-menu-daily-warning"]', { timeout: 5000 });
            await shot('03-run-menu-daily-warning');
            await click('run-menu-cancel');
            await page.keyboard.press('Escape').catch(() => undefined);
            await page.evaluate(() => window.__game.store.getState().setSpeed(0));
          }
          const plan = ['bot', 'banned', 'revolt', 'idle', 'bot'][d];
          for (let i = 0; i < 80; i++) {
            if (plan === 'banned' && i === 2) await page.evaluate(() => window.__game.setMeters({ regulation: 100 }));
            if (plan === 'revolt' && i === 3) await page.evaluate(() => window.__game.setMeters({ backlash: 100, regulation: 0 }));
            await page.evaluate((bot) => window.__game.advance(150, { bot, collectMoments: bot }), plan !== 'idle');
            if (await page.evaluate(() => window.__game.store.getState().state?.status === 'ended')) break;
          }
          await page.waitForFunction(() => location.pathname === '/end', { timeout: 15000 });
          await page.waitForSelector('[data-testid="end-share"]', { timeout: 10000 });
          await sleep(1800);
          const trigger = await page.evaluate(() => window.__game.store.getState().state.ending.trigger);
          endings.push(trigger);
          if (d === 0) await shot('04-end-daily');
          await click('end-frontpage');
          await page.waitForSelector('[data-testid="frontpage-paper"]', { timeout: 8000 });
          await sleep(700);
          await shot(`05-frontpage-day${d + 1}-${trigger}`);
          const headline = await text('frontpage-headline');
          check(headline && !/\{[a-z]+\}/i.test(headline), `front page headline (${trigger}): ${headline}`);
          if (d === 0) {
            await click('frontpage-share');
            await sleep(600);
            await shot('06-frontpage-share-copied');
          }
          await click('frontpage-close');
          if (d === DAYS.length - 1) {
            await click('end-share-button');
            await sleep(600);
            const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
            if (clip) console.log(`share text (${lang}):\n${clip}\n`);
            await shot('07-end-share-copied');
          }
          await click('end-new-lab');
          await page.waitForSelector('[data-testid="daily-card"]', { timeout: 10000 });
          await sleep(500);
        }
        console.log(`endings (${lang} ${W}x${H}): ${endings.join(', ')}`);
        check(new Set(endings).size >= 4, `at least four different endings (${new Set(endings).size})`);
        await sleep(400);
        await shot('08-start-daily-after');
        const streak = await text('daily-streak');
        check(/5/.test(streak), `streak after five days: ${streak}`);
        await click('daily-history');
        await sleep(600);
        await shot('09-daily-history');
        const events = await page.evaluate(() => window.__analytics.log().filter((e) => /^(daily_|share_tap|frontpage_open|run_start|run_end)/.test(e.name)));
        const daily = events.filter((e) => e.name.startsWith('daily_'));
        console.log(`daily events: ${daily.map((e) => `${e.name}${JSON.stringify(e.params)}`).join(' ')}`);
        check(daily.filter((e) => e.name === 'daily_end').length === DAYS.length, 'one daily_end per day');
        check(events.some((e) => e.name === 'run_start' && e.params.daily === true), 'run_start carries daily: true');
        check(!JSON.stringify(await page.evaluate(() => window.__analytics.log())).includes(LAB), 'the lab name never reaches analytics');
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  const real = errors.filter((e) => !/favicon|DevTools|Download the React DevTools/.test(e));
  if (real.length) {
    console.log(`page errors:\n${[...new Set(real)].join('\n')}`);
    process.exitCode = 1;
  }
  if (failures) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
