#!/usr/bin/env node
/**
 * Screenshots of the Trees screen in the exported web build at 844x390 (landscape), plus one portrait check.
 *
 *   npx expo export --platform web && node scripts/screens/trees.js [outDir]
 *
 * Serves dist/ inside this process, drives headless Chrome with puppeteer-core and
 * uses the `?debug=1` handle (window.__game) to fast-forward the run. The server
 * and browser are closed before exiting.
 * Env: CHROME (default /usr/bin/google-chrome), PORT (default 8766), SEED (default 7),
 * EMULATE (default 1): until the landscape shell (task 9) is merged, hide the portrait
 * shell's header and tab bar and pad the page by the rail (56) and top strip (40) so the
 * Trees tab gets the main area docs/UI.md describes, and show the Sheet as a 360-wide right
 * panel. Set EMULATE=0 to shoot the shell as it is.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots'));
const PORT = Number(process.env.PORT || 8766);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const EMULATE = process.env.EMULATE !== '0';

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

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=844,390'],
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 });
    const shot = async (name, clip) => {
      await page.screenshot({ path: path.join(OUT, name), clip });
      console.log(`saved ${name}`);
    };
    const advance = (n, opts) => page.evaluate((n, opts) => window.__game.advance(n, opts), n, opts);
    const store = (fn, arg) => page.evaluate(fn, arg);
    const clickTab = async (label) => {
      await page.evaluate((label) => {
        const tab = [...document.querySelectorAll('[role="tab"]')].find((el) => el.textContent.trim().startsWith(label));
        if (!tab) throw new Error(`tab ${label} not found`);
        tab.click();
      }, label);
      await sleep(600);
    };
    const click = async (selector) => {
      const el = await page.$(selector);
      if (!el) throw new Error(`not found: ${selector}`);
      await el.click();
      await sleep(500);
    };
    /** Clicks the first node tile whose label mentions the state text. */
    const clickTileWithState = async (state) => {
      const id = await page.evaluate((state) => {
        const tile = [...document.querySelectorAll('[data-testid^="node-"]')].find((el) => (el.getAttribute('aria-label') || '').includes(`, ${state},`));
        return tile ? tile.getAttribute('data-testid') : null;
      }, state);
      if (!id) throw new Error(`no tile in state ${state}`);
      await click(`[data-testid="${id}"]`);
      return id;
    };
    /** See EMULATE above. Idempotent; call after anything that may re-create the sheet. */
    const emulateWideShell = () =>
      EMULATE &&
      page.evaluate(() => {
        const meter = document.querySelector('[data-testid="meter-regulation"]');
        const header = meter && meter.parentElement && meter.parentElement.parentElement;
        if (header) header.style.display = 'none';
        const tab = document.querySelector('[role="tab"]');
        if (tab && tab.parentElement) tab.parentElement.style.display = 'none';
        const root = document.getElementById('root');
        if (root) Object.assign(root.style, { boxSizing: 'border-box', paddingLeft: '56px', paddingTop: '40px' });
        document.body.style.background = root ? getComputedStyle(root.firstElementChild || root).backgroundColor : '';
        const sheet = document.querySelector('[data-testid="node-sheet"]');
        if (sheet) Object.assign(sheet.style, { left: 'auto', width: '360px', top: '0px', maxHeight: 'none', borderTopRightRadius: '0px', borderBottomLeftRadius: '16px' });
      });
    const closeSheet = () => click('[data-testid="node-sheet-close"]');
    const resolvePending = () =>
      store(() => {
        // Resolve any pending event so the screen is not covered by it.
        window.__game.advance(1, { autoResolve: true });
      });

    await page.goto(`http://127.0.0.1:${PORT}/?autostart=1&debug=1&seed=${SEED}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
    await store(() => window.__game.store.getState().setSpeed(0));
    await sleep(800);

    // 1. Start of a run: Capability tree.
    await clickTab('Trees');
    await emulateWideShell();
    await sleep(600);
    await shot('trees-capability-early.png');

    // 2. Detail sheet of a buyable node (a root), then of a locked node.
    await clickTileWithState('Ready to buy').catch(async () => {
      // Not enough Hype yet: let a few days pass.
      await advance(40);
      await sleep(400);
      return clickTileWithState('Ready to buy');
    });
    await emulateWideShell();
    await sleep(400);
    await shot('trees-node-sheet-buyable.png');
    // Buy it from the sheet: the sheet shows the owned state for a moment, then closes and the tile lights up.
    await click('[data-testid="node-buy"]');
    await emulateWideShell();
    await shot('trees-node-bought.png');
    await sleep(1100);
    await shot('trees-node-bought-flash.png');
    await sleep(800);
    await clickTileWithState('Locked');
    await emulateWideShell();
    await sleep(300);
    await shot('trees-node-sheet-locked.png');
    await closeSheet();

    // 3. Mid run: the bot plays for a while (buying nodes), then a few more purchases.
    await advance(700, { bot: true });
    await resolvePending();
    await store(() => {
      const { state, dispatch } = window.__game.store.getState();
      const lab = state.labs[state.playerLabId];
      window.__game.store.setState({ state: { ...state, labs: { ...state.labs, [lab.id]: { ...lab, hype: lab.hype + 150, cash: lab.cash + 300 } } } });
      for (const id of ['reach-app', 'reach-social', 'reach-api', 'reach-media', 'shadow-benchmarks', 'shadow-astroturf', 'shadow-lobbying']) {
        const s = window.__game.store.getState().state;
        dispatch({ type: 'buyNode', labId: s.playerLabId, nodeId: id });
      }
    });
    await sleep(400);
    await click('[data-testid="tree-tab-reach"]');
    await sleep(800);
    await shot('trees-reach-mid.png');
    await click('[data-testid="tree-tab-shadow"]');
    await sleep(800);
    await shot('trees-shadow-mid.png');
    await click('[data-testid="tree-tab-capability"]');
    await sleep(800);
    await shot('trees-capability-mid.png');

    // 4. Tab bar badge, seen from the Map tab, in the shell as it is.
    await page.evaluate(() => {
      const meter = document.querySelector('[data-testid="meter-regulation"]');
      const header = meter && meter.parentElement && meter.parentElement.parentElement;
      if (header) header.style.display = '';
      const tab = document.querySelector('[role="tab"]');
      if (tab && tab.parentElement) tab.parentElement.style.display = '';
      const root = document.getElementById('root');
      if (root) Object.assign(root.style, { paddingLeft: '0px', paddingTop: '0px' });
    });
    await sleep(400);
    await shot('trees-current-shell.png');
    await clickTab('Map');
    await page.waitForSelector('[data-testid="trees-badge"]', { timeout: 5000 });
    await sleep(800);
    await shot('trees-tab-badge.png');
    await shot('trees-tab-badge-zoom.png', { x: 0, y: 290, width: 844, height: 100 });

    // 5. Narrow portrait window: must stay usable.
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await clickTab('Trees');
    await sleep(800);
    await shot('trees-portrait.png');
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (errors.length) {
    console.log('Page errors:');
    for (const e of errors) console.log(`  ${e}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
