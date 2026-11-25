#!/usr/bin/env node
/**
 * Checks the demo zip the way itch.io will serve it.
 *
 *   npm run demo && npm run demo:check
 *
 * Unzips dist-demo/ai-race-demo.zip into a temp folder, serves it from a sub-path
 * (/html/1234567/, like itch's CDN) with a plain static server (no fallback to index.html:
 * an unknown path is a 404, as on itch), loads it in headless Chrome inside an outer page
 * that embeds it in an <iframe> (as itch does), and:
 *  - checks the letterbox at a desktop size (the game frame keeps a landscape phone shape);
 *  - checks the start screen's "Join the waitlist" button and that locked choices (the harder
 *    levels, the long run) open the "In the full game" card instead of being selected;
 *  - founds a lab through the start flow (Sprint) and plays the run to its end with the
 *    `?debug=1` bot, then checks the end screen and its button (a new tab to the waitlist);
 *  - opens the Garage, pushes it far past the second stage and checks it stays there with
 *    the "In the full game" note;
 *  - fails on any console error, page error or failed request.
 * Env: CHROME (default /usr/bin/google-chrome), SHOTS (dir: also save screenshots).
 */
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const ZIP = path.join(ROOT, 'dist-demo', 'ai-race-demo.zip');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : null;
const SUB = '/html/1234567/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.wav': 'audio/wav' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(dir) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    if (url === '/embed.html') {
      // The outer page, standing in for itch's game page: the zip's index.html in an iframe.
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body style="margin:0;background:#fff"><iframe id="game" src="${SUB}index.html${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}" style="border:0;width:100vw;height:100vh" allowfullscreen></iframe></body></html>`);
      return;
    }
    if (url.startsWith(SUB)) {
      let file = path.join(dir, url.slice(SUB.length));
      if (url.endsWith('/')) file = path.join(file, 'index.html');
      if (file.startsWith(dir) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
        return;
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function check(cond, msg) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`ok  ${msg}`);
}

async function main() {
  if (!fs.existsSync(ZIP)) throw new Error('dist-demo/ai-race-demo.zip not found: run `npm run demo` first');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-race-demo-'));
  const unzip = spawnSync('unzip', ['-q', ZIP, '-d', dir], { stdio: 'inherit' });
  if (unzip.status !== 0) throw new Error('unzip failed');
  check(fs.existsSync(path.join(dir, 'index.html')), 'the zip has index.html at its root');
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

  const server = await serve(dir);
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required'] });
  const problems = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => problems.push(`pageerror: ${e}`));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console: ${m.text()}`);
    });
    page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} ${r.failure()?.errorText}`));
    page.on('response', (r) => {
      if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
    });
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    const t0 = Date.now();
    await page.goto(`${base}/embed.html?debug=1`, { waitUntil: 'load' });
    const gameFrame = async () => {
      for (let i = 0; i < 100; i++) {
        const f = page.frames().find((fr) => fr.url().includes('/game/index.html') || (fr.parentFrame() && fr.parentFrame().url().includes(SUB) && fr !== fr.parentFrame()));
        const inner = page.frames().find((fr) => fr.parentFrame() && fr.parentFrame().url().includes(`${SUB}index.html`));
        if (inner || f) return inner || f;
        await sleep(100);
      }
      throw new Error('game frame not found');
    };
    let frame = await gameFrame();
    await frame.waitForSelector('[data-testid="start-next"]', { timeout: 20000 });
    const firstFrameMs = Date.now() - t0;
    console.log(`start screen interactive after ${firstFrameMs} ms (local server, no throttling)`);
    await sleep(1200);
    const box = await page.evaluate(() => {
      const outer = document.getElementById('game').contentDocument;
      const f = outer.getElementById('frame');
      const r = f.getBoundingClientRect();
      return { w: r.width, h: r.height, x: r.x, y: r.y, inner: { w: f.offsetWidth, h: f.offsetHeight }, path: f.contentWindow.location.pathname, base: f.contentWindow.__DEMO_BASE__ };
    });
    console.log(`letterbox at 1280x720: frame ${Math.round(box.w)}x${Math.round(box.h)} at (${Math.round(box.x)}, ${Math.round(box.y)}), logical ${box.inner.w}x${box.inner.h}; router path ${box.path}, base ${box.base}`);
    check(box.w <= 1280 && box.h <= 720 && box.w / box.h >= 16 / 9 - 0.01 && box.w / box.h <= 2.18, 'the game frame keeps a landscape phone shape, centred');
    check(box.base === `${SUB}game/`, 'the game resolves its files from its own folder');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'demo-start-1280x720.png') });

    const click = async (id) => {
      await frame.waitForSelector(`[data-testid="${id}"]`, { timeout: 8000 });
      await frame.click(`[data-testid="${id}"]`);
      await sleep(400);
    };
    check(!!(await frame.$('[data-testid="demo-cta-start-button"]')), 'start screen shows the waitlist button');

    // Start flow: name, founder (locked choices), home region, found.
    await click('start-dice');
    await click('start-next');
    await click('difficulty-arms-race');
    check(!!(await frame.$('[data-testid="demo-gate"]')), 'a harder level opens the "In the full game" card');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'demo-gate.png') });
    await click('demo-gate-close');
    check(!(await frame.$('[data-testid="demo-gate"]')), 'the card closes');
    await click('runlength-full');
    check(!!(await frame.$('[data-testid="demo-gate"]')), 'the long run opens the card too');
    await click('demo-gate-close');
    const picked = await frame.evaluate(() => ({
      sprint: document.querySelector('[data-testid="runlength-sprint"]')?.getAttribute('aria-checked'),
      full: document.querySelector('[data-testid="runlength-full"]')?.getAttribute('aria-checked'),
    }));
    check(picked.sprint === 'true' && picked.full !== 'true', 'Sprint stays selected');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'demo-founder.png') });
    await click('start-next');
    await click('start-region-list');
    await frame.type('[data-testid="start-region-search"]', 'can');
    await sleep(300);
    await click('region-row-canada');
    await sleep(600);
    await click('start-found');
    await frame.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 15000 });
    const setup = await frame.evaluate(() => {
      const s = window.__game.store.getState().state;
      return { runLength: s.runLength, difficulty: s.difficulty };
    });
    console.log(`run: ${JSON.stringify(setup)}`);
    check(setup.runLength === 'sprint', 'the run is a Sprint');

    // Keyboard: space pauses, 3 is fast.
    await frame.focus('body').catch(() => undefined);
    await page.keyboard.press('3');
    await sleep(200);
    const s3 = await frame.evaluate(() => window.__game.store.getState().speed);
    await page.keyboard.press('Space');
    await sleep(200);
    const s0 = await frame.evaluate(() => window.__game.store.getState().speed);
    await page.keyboard.press('Space');
    await sleep(200);
    const sBack = await frame.evaluate(() => window.__game.store.getState().speed);
    check(s3 === 3 && s0 === 0 && sBack === 3, `keyboard shortcuts: 3 -> ${s3}, space -> ${s0}, space -> ${sBack}`);

    // Play to the end with the bot.
    await frame.evaluate(() => window.__game.store.getState().setSpeed(0));
    for (let i = 0; i < 120; i++) {
      await frame.evaluate(() => window.__game.advance(100, { bot: true, collectMoments: true }));
      if (await frame.evaluate(() => window.__game.store.getState().state.status === 'ended')) break;
    }
    const ending = await frame.evaluate(() => window.__game.store.getState().state.ending);
    check(!!ending, `the Sprint ends (${ending ? `${ending.kind} ${ending.endingId} day ${ending.tick + 1}` : 'no ending'})`);
    await frame.waitForFunction(() => location.pathname === '/end', { timeout: 15000 });
    await frame.waitForSelector('[data-testid="end-title"]', { timeout: 15000 });
    await sleep(1500);
    check(!!(await frame.$('[data-testid="demo-cta-end-button"]')), 'end screen shows the waitlist button');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'demo-end.png') });
    const newTab = new Promise((resolve) => browser.once('targetcreated', (tg) => resolve(tg.url())));
    await click('demo-cta-end-button');
    const opened = await Promise.race([newTab, sleep(3000).then(() => null)]);
    console.log(`waitlist button opened: ${opened}`);
    check(typeof opened === 'string', 'the waitlist button opens a new tab');
    const events = await frame.evaluate(() => (window.__analytics ? window.__analytics.events() : []).filter((e) => e.name.startsWith('demo_')).map((e) => `${e.name} ${JSON.stringify(e.params)}`));
    console.log(`demo events: ${events.join(', ')}`);
    check(events.some((e) => e.startsWith('demo_gate_seen')) && events.some((e) => e.startsWith('demo_cta_tap')), 'analytics recorded demo_gate_seen and demo_cta_tap');

    // Garage: fresh page, open it from the start screen, push it far past the second stage.
    await page.goto(`${base}/embed.html?debug=1`, { waitUntil: 'load' });
    frame = await gameFrame();
    await frame.waitForSelector('[data-testid="mode-garage"]', { timeout: 20000 });
    await frame.click('[data-testid="mode-garage"]');
    await frame.waitForFunction(() => location.pathname === '/garage' && !!window.__garage && !!window.__garage.state(), { timeout: 15000 });
    await frame.evaluate(() => {
      window.__garage.scene('late');
      window.__garage.grant(1e15);
    });
    await sleep(1500);
    const stage = await frame.evaluate(() => window.__garage.state().stage);
    console.log(`garage stage after a big grant: ${stage}`);
    check(stage <= 1, 'the Garage stays within its first two stages');
    check(!!(await frame.$('[data-testid="demo-next-stage"]')), 'the next stage shows "In the full game"');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'demo-garage.png') });
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const real = problems.filter((p) => !/favicon/.test(p));
  if (real.length) {
    console.log('Problems:');
    for (const p of real) console.log(`  ${p}`);
    throw new Error(`${real.length} console errors or failed requests`);
  }
  console.log('ok  no console errors, page errors or failed requests');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
