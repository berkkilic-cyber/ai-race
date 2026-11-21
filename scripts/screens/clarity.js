#!/usr/bin/env node
/**
 * Clarity screenshots: does the game explain itself? Captures the top strip (calm and
 * critical, with the AGI race bar), the Race tab early and late in a run, a rival's detail
 * panel, the model readout when the player owns more than they can run and its explanation,
 * the Trees screen with icons and compute needs, the buy confirmation, the nudge, the Hype and
 * Cash breakdowns, and an event card with a locked choice and its info panel.
 *
 *   npx expo export --platform web && node scripts/screens/clarity.js
 *   EXPO_PUBLIC_THEME=hazard npx expo export --platform web && THEME=hazard SUBSET=1 node scripts/screens/clarity.js
 *
 * Two sizes per screen: 844x390 with no insets, and 926x428 with `?insets=0,47,21,47` (an
 * iPhone with a notch, in landscape). Writes docs/screenshots/clarity/<theme>-<size>-<name>.png.
 * THEME only names the files (the palette is baked into dist/ at export time). SUBSET=1 takes
 * the spot-check set only (strip, race, trees, event info). Serves dist/ in-process and drives
 * headless Chrome through the `?debug=1` handle (window.__game); everything is closed before
 * exiting. Env: CHROME (default /usr/bin/google-chrome), PORT (default 8768), SEED (default 7).
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { scanText, textScanSummary } = require('./textScan');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'screenshots', 'clarity'));
const THEME = process.env.THEME || 'blueprint';
const SUBSET = process.env.SUBSET === '1';
const PORT = Number(process.env.PORT || 8768);
const SEED = Number(process.env.SEED || 7);
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SIZES = [
  { id: '844', width: 844, height: 390, insets: '' },
  { id: '926', width: 926, height: 428, insets: '0,47,21,47' },
];

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

async function captureSize(browser, size, errors) {
  const page = await browser.newPage();
  let after = `${size.id}:(load)`;
  page.on('pageerror', (e) => errors.push(`after ${after}: ${String(e).split('\n')[0]}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`after ${after}: ${m.text().split('\n')[0]}`);
  });
  await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
  const base = `http://127.0.0.1:${PORT}`;
  const query = `debug=1&seed=${SEED}${size.insets ? `&insets=${size.insets}` : ''}`;
  // The top strip fits: no text clipped (the lab name may truncate), outside the strip or overlapping other text.
  const checkStrip = async (name) => {
    const problems = await page.evaluate(() => {
      const hype = document.querySelector('[data-testid="res-hype"]');
      if (!hype) return ['no strip'];
      let strip = hype;
      while (strip && strip.getBoundingClientRect().width < 500) strip = strip.parentElement;
      if (!strip) return ['no strip'];
      const s = window.__game.store.getState().state;
      const labName = s.labs[s.playerLabId].name;
      const sr = strip.getBoundingClientRect();
      const out = [];
      const leaves = [];
      for (const el of strip.querySelectorAll('div,span')) {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || el.closest('[aria-hidden="true"]')) continue;
        let hidden = false;
        for (let a = el; a && a !== strip; a = a.parentElement) if (getComputedStyle(a).opacity === '0' || getComputedStyle(a).visibility === 'hidden') hidden = true;
        if (hidden) continue;
        const text = el.textContent.trim();
        if (r.right > sr.right + 0.5 || r.left < sr.left - 0.5) out.push(`outside the strip: "${text}"`);
        if (text !== labName && el.scrollWidth > el.clientWidth + 1) out.push(`clipped: "${text}" (${el.scrollWidth} > ${el.clientWidth})`);
        leaves.push({ text, r, el });
      }
      // One-line texts made of nested spans ("1 vs 20%") ellipsize on the outer element; a group whose
      // children need more room than it has overflows (FitLabel's hidden measuring texts excluded).
      for (const el of strip.querySelectorAll('div,span')) {
        if (el.closest('[aria-hidden="true"]') || el.querySelector('[aria-hidden="true"]') || !el.textContent.trim()) continue;
        if (el.getBoundingClientRect().width === 0) continue;
        const text = el.textContent.trim();
        if (text === labName || text.startsWith(labName)) continue;
        const cs = getComputedStyle(el);
        if (el.scrollWidth > el.clientWidth + 1 && (cs.textOverflow === 'ellipsis' || el.children.length > 0)) out.push(`${cs.textOverflow === 'ellipsis' ? 'clipped' : 'overflows'}: "${text.slice(0, 60)}" (${el.scrollWidth} > ${el.clientWidth})`);
      }
      // Every visible text sits inside the strip group it belongs to (brand, stats, meters, speed).
      for (const group of strip.children) {
        const gr = group.getBoundingClientRect();
        for (const leaf of leaves) {
          if (!group.contains(leaf.el)) continue;
          if (leaf.r.right > gr.right + 1 || leaf.r.left < gr.left - 1) out.push(`outside its group: "${leaf.text}"`);
        }
      }
      for (let i = 0; i < leaves.length; i++)
        for (let j = i + 1; j < leaves.length; j++) {
          const a = leaves[i].r;
          const b = leaves[j].r;
          const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ix > 1.5 && iy > 1.5) out.push(`overlap: "${leaves[i].text}" / "${leaves[j].text}"`);
        }
      return out;
    });
    for (const p of problems) errors.push(`strip ${size.id} ${name}: ${p}`);
    if (problems.length) console.log(`strip ${size.id} ${name}: ${problems.length} problem(s)`);
  };
  const shot = async (name) => {
    if (name.startsWith('strip') || name === 'model-stuck-strip') await checkStrip(name);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await sleep(250);
    const file = path.join(OUT, `${THEME}-${size.id}-${name}.png`);
    await page.screenshot({ path: file });
    await scanText(page, path.basename(String(file)));
    console.log(`saved ${path.relative(ROOT, file)}`);
    after = `${size.id}:${name}`;
  };
  const game = (fn, arg) => page.evaluate(fn, arg);
  const advance = (n, opts) => page.evaluate((n, opts) => window.__game.advance(n, opts), n, opts);
  const setSpeed = (s) => game((s) => window.__game.store.getState().setSpeed(s), s);
  const click = async (testId) => {
    const el = await page.$(`[data-testid="${testId}"]`);
    if (!el) throw new Error(`no element ${testId}`);
    await el.click();
    await sleep(500);
  };
  const tab = async (i) => {
    const tabs = await page.$$('[role="tab"]');
    await tabs[i].click();
    await sleep(800);
  };
  const closeSheet = async () => {
    const outside = await page.$('[data-testid="sheet-outside"]');
    if (outside) await page.mouse.click(size.width * 0.3, size.height * 0.6);
    await sleep(400);
  };
  const forceEvent = (eventId) =>
    game((eventId) => {
      const store = window.__game.store;
      const s = store.getState().state;
      store.setState({ eventResult: null, state: { ...s, pendingEvent: { eventId, labId: s.playerLabId } } });
    }, eventId);
  const clearEvent = () =>
    game(() => {
      const store = window.__game.store;
      const s = store.getState().state;
      store.setState({ eventResult: null, state: { ...s, pendingEvent: null } });
    });
  /** Edits the player's lab in place (debug only). */
  const patchPlayer = (patch) =>
    game((patch) => {
      const store = window.__game.store;
      const s = store.getState().state;
      const me = s.labs[s.playerLabId];
      const next = { ...me };
      if (patch.addNodes) next.ownedNodes = [...new Set([...me.ownedNodes, ...patch.addNodes])];
      if (patch.setNodes) next.ownedNodes = patch.setNodes;
      if (patch.oneDataCentre) next.dataCentres = [{ id: 'dbg-dc', regionId: me.homeRegion, level: 1 }];
      for (const k of ['hype', 'cash', 'computeBonus']) if (patch[k] !== undefined) next[k] = patch[k];
      store.setState({ state: { ...s, labs: { ...s.labs, [me.id]: next } } });
    }, patch);
  // Achievement toasts earned while fast-forwarding would cover what is being shown.
  const hideToasts = (hide = true) =>
    game((hide) => {
      let el = document.getElementById('hide-toasts');
      if (!el) {
        el = document.createElement('style');
        el.id = 'hide-toasts';
        el.textContent = '[data-testid="achievement-toast"]{display:none !important}';
        document.head.appendChild(el);
      }
      el.disabled = !hide;
    }, hide);

  await page.goto(`${base}/?autostart=1&${query}`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => location.pathname === '/game' && !!window.__game);
  await hideToasts();
  await setSpeed(0);
  await advance(260, { bot: true });
  await sleep(800);

  // Top strip, calm and critical (the race bar carries the composure tag when the rival drives it).
  await game(() => window.__game.forceComposure(0));
  await shot('strip-calm');
  await game(() => window.__game.forceComposure(null));
  await game(() => window.__game.setMeters({ rival: 88, regulation: 52, backlash: 47 }));
  await sleep(900);
  await shot('strip-critical');
  await game(() => window.__game.setMeters({ rival: 20, regulation: 10, backlash: 10 }));
  await sleep(600);

  if (!SUBSET) {
    // An achievement toast sits under the strip, never over its numbers.
    await hideToasts(false);
    await game(() => {
      const store = window.__game.store;
      const s = store.getState().state;
      const id = store.getState().pack.achievements.find((a) => !a.secret && !s.achievements.includes(a.id)).id;
      store.setState({ state: { ...s, achievements: [...s.achievements, id] } });
    });
    await sleep(900);
    await shot('toast');
    await hideToasts(true);
  }

  // Race tab, early.
  await tab(3);
  await shot('race-early');
  await tab(0);

  if (!SUBSET) {
    // Hype and Cash breakdowns.
    await click('res-hype');
    await shot('hype-panel');
    await closeSheet();
    await click('res-cash');
    await shot('cash-panel');
    await closeSheet();
  }

  // Owning more models than the compute can run: the readout, its explanation, the Trees nudge.
  await patchPlayer({ addNodes: ['cap-model-1', 'cap-model-2', 'cap-model-3', 'cap-model-4', 'cap-model-5'], oneDataCentre: true, computeBonus: 2 });
  await sleep(600);
  if (!SUBSET) await shot('model-stuck-strip');
  // Everything in the strip at once: the "owns N" badge and a danger tag (on every theme).
  await game(() => window.__game.setMeters({ rival: 20, regulation: 90, backlash: 40 }));
  await sleep(900);
  await shot('strip-owns-critical');
  await game(() => window.__game.setMeters({ rival: 88, regulation: 10, backlash: 10 }));
  await sleep(900);
  await shot('strip-owns-race-critical');
  await game(() => window.__game.setMeters({ rival: 20, regulation: 10, backlash: 10 }));
  await sleep(600);
  await click('res-tier');
  await shot('model-panel');
  await closeSheet();
  await tab(1);
  await shot('trees-nudge');
  if (!SUBSET) {
    await click('model-nudge-dismiss');
    await shot('trees-icons');

    // Buying a model that cannot run yet asks first.
    await patchPlayer({ setNodes: ['cap-model-1', 'cap-model-2', 'cap-gpu-lease', 'cap-safety-team'], hype: 400 });
    await sleep(500);
    await click('node-cap-model-3');
    await shot('node-sheet-model');
    await click('node-buy');
    await shot('buy-confirm');
    await click('node-buy-cancel');
    await closeSheet();
  }
  await tab(0);

  // An event with a locked choice (needs Safety Team and $30M) and its info panel.
  await patchPlayer({ setNodes: ['cap-model-1'], cash: 12 });
  await forceEvent('sandbox-escape');
  await sleep(1300);
  await shot('event-locked');
  await click('event-choice-info-patch');
  await shot('event-info-locked');
  await closeSheet();
  if (!SUBSET) {
    // A gamble's info panel, and the open-source choice's chips.
    await clearEvent();
    await forceEvent('whistleblower');
    await sleep(1000);
    await click('event-choice-info-nda');
    await shot('event-info-gamble');
    await closeSheet();
    await clearEvent();
    await forceEvent('weights-leak');
    await sleep(1000);
    await shot('event-open-source');
  }
  await clearEvent();
  await sleep(400);

  // Late in the run: the Race tab and a rival's detail panel.
  await setSpeed(0);
  for (let i = 0; i < 6; i++) {
    await advance(250, { bot: true });
    if (await game(() => window.__game.store.getState().state.status === 'ended')) break;
  }
  const status = await game(() => window.__game.store.getState().state.status);
  if (status !== 'ended') {
    await game(() => window.__game.setMeters({ regulation: 20, backlash: 20 }));
    await tab(3);
    await shot('race-late');
    const rival = await page.$('[data-testid^="race-row-"]:not([data-testid="race-row-player"])');
    if (rival) {
      await rival.click();
      await sleep(600);
      await shot('rival-detail');
    }
  } else {
    console.log(`(${size.id}) run ended before the late shots`);
  }
  await page.close();
}

async function main() {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found: run `npx expo export --platform web` first');
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const errors = [];
  try {
    for (const size of SIZES) await captureSize(browser, size, errors);
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  if (errors.length) {
    console.log('Page errors:');
    for (const e of [...new Set(errors)]) console.log(`  ${e}`);
  }
}

main()
  .then(() => textScanSummary())
  .catch((err) => {
  console.error(err);
  process.exit(1);
});
