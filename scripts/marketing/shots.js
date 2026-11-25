#!/usr/bin/env node
/**
 * Marketing screenshots of the full game at the App Store's iPhone landscape sizes, in English
 * and Turkish, with no debug UI (build stamp, toasts, ad offers and debug overlays hidden).
 *
 *   npm run marketing:shots            # builds dist/ if missing; REBUILD=1 rebuilds it
 *   LANGS=en SIZES=2622x1206 npm run marketing:shots
 *
 * Sizes (App Store Connect screenshot specifications, iPhone, landscape):
 *   2622x1206  iPhone with Dynamic Island, medium display  (874x402 CSS px at 3x): required
 *   2688x1242  iPhone with Face ID, large display          (896x414 CSS px at 3x): required when
 *              no Dynamic Island (large) set is given, which covers the large phones
 * (2868x1320, Dynamic Island large, is optional and was dropped: at 956 CSS px with no insets the
 * Turkish top strip overflows its right edge, a layout issue reported to the orchestrator.)
 * Scenes: the world map mid-run, an event card, the upgrade trees, a won end screen, the Garage
 * at its first stage and the Office stage, and the founder step of the start flow. Output:
 * docs/marketing/screenshots/<lang>/<size>/NN-scene.jpg (opaque, no alpha). Garage art is being
 * redrawn by another task: rerun after it lands.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, sleep, ensureBuild, serve, launch, newPage, clean, startRun, openGarage, FFMPEG } = require('./lib');
const { spawnSync } = require('node:child_process');

const OUT = path.join(ROOT, 'docs', 'marketing', 'screenshots');
const ALL_SIZES = {
  '2688x1242': { width: 896, height: 414, scale: 3 },
  '2622x1206': { width: 874, height: 402, scale: 3 },
};
const SIZES = (process.env.SIZES || Object.keys(ALL_SIZES).join(',')).split(',');
const LANGS = (process.env.LANGS || 'en,tr').split(',');
const MAP_SEEDS = [2, 3, 4, 5];
const MAP_TICKS = Number(process.env.MAP_TICKS || 2200);
const END_SEEDS = [2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const EVENT_ID = process.env.EVENT || 'parking-lot-gpus';

function saveJpeg(tmpPng, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', tmpPng, '-pix_fmt', 'yuvj444p', '-q:v', '2', dest], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${dest}`);
}

async function main() {
  ensureBuild();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'));
  const problems = [];
  try {
    for (const lang of LANGS) {
      for (const sizeName of SIZES) {
        const size = ALL_SIZES[sizeName];
        if (!size) throw new Error(`unknown size ${sizeName}`);
        const page = await newPage(browser, size);
        const dir = path.join(OUT, lang, sizeName);
        const shot = async (name) => {
          await sleep(300);
          const png = path.join(tmp, `${lang}-${sizeName}-${name}.png`);
          await page.screenshot({ path: png });
          saveJpeg(png, path.join(dir, `${name}.jpg`));
          console.log(`saved ${path.relative(ROOT, path.join(dir, `${name}.jpg`))}`);
        };

        // 1. The map mid-run: the seed where the player leads the rivals by the most regions at
        // day ~MAP_TICKS (a lived-in map where the player's green is the story).
        let best = { seed: MAP_SEEDS[0], lead: -Infinity };
        for (const seed of MAP_SEEDS) {
          await startRun(page, base, { seed, lang });
          await page.evaluate((n) => { for (let i = 0; i < n; i += 500) window.__game.advance(Math.min(500, n - i), { bot: true }); }, MAP_TICKS);
          const r = await page.evaluate(() => {
            const s = window.__game.store.getState().state;
            const count = (id) => Object.values(s.labs[id].adoption || {}).filter((v) => v > 0.02).length;
            const rivals = s.labOrder.filter((id) => id !== s.playerLabId).map(count);
            return { status: s.status, lead: count(s.playerLabId) - Math.max(0, ...rivals) };
          });
          if (r.status === 'running' && r.lead > best.lead) best = { seed, lead: r.lead };
        }
        console.log(`${lang} ${sizeName}: map seed ${best.seed} (lead ${best.lead} regions)`);
        await startRun(page, base, { seed: best.seed, lang });
        await page.evaluate((n) => { for (let i = 0; i < n; i += 500) window.__game.advance(Math.min(500, n - i), { bot: true }); }, MAP_TICKS);
        await page.evaluate(() => window.__game.store.getState().dismissEventResult());
        // Let launch banners and toasts finish before the picture.
        await sleep(2500);
        await shot('01-map');

        // 2. An event card (a light one), on the same run, with the cash to afford either choice.
        await page.evaluate((eventId) => {
          const store = window.__game.store;
          const s = store.getState().state;
          const me = s.labs[s.playerLabId];
          const labs = { ...s.labs, [me.id]: { ...me, cash: Math.max(me.cash, 120) } };
          store.setState({ eventResult: null, state: { ...s, labs, pendingEvent: { eventId, labId: s.playerLabId } } });
        }, EVENT_ID);
        await sleep(1800);
        await shot('02-event');
        await page.evaluate(() => {
          const store = window.__game.store;
          const s = store.getState().state;
          store.setState({ eventResult: null, state: { ...s, pendingEvent: null } });
        });
        await sleep(500);

        // 3. The upgrade trees.
        const tabs = await page.$$('[role="tab"]');
        if (tabs[1]) await tabs[1].click();
        await sleep(1500);
        await shot('03-trees');

        // 4. A won end screen: the first seed whose bot run wins (full run, default level).
        let ending = null;
        for (const seed of END_SEEDS) {
          await page.goto(`${base}/?autostart=1&debug=1&seed=${seed}&lang=${lang}&runLength=full`, { waitUntil: 'networkidle0' });
          await page.waitForFunction(() => location.pathname === '/game' && !!window.__game, { timeout: 20000 });
          await page.evaluate(() => window.__game.store.getState().setSpeed(0));
          for (let i = 0; i < 80; i++) {
            await page.evaluate(() => window.__game.advance(500, { bot: true }));
            if (await page.evaluate(() => window.__game.store.getState().state.status === 'ended')) break;
          }
          ending = await page.evaluate(() => window.__game.store.getState().state.ending);
          console.log(`${lang} ${sizeName}: end seed ${seed}: ${ending ? `${ending.kind} ${ending.endingId}` : 'none'}`);
          if (ending && ending.kind === 'win') break;
        }
        if (!ending || ending.kind !== 'win') problems.push(`${lang} ${sizeName}: no seed won`);
        await page.waitForFunction(() => location.pathname === '/end', { timeout: 15000 });
        await clean(page);
        await sleep(3500);
        await shot('04-end');

        // 5-6. The Garage: the first stage part-filled, then the Office stage full.
        await openGarage(page, base, lang);
        await page.evaluate(() => {
          window.__garage.scene('mid');
          window.__garage.freeze(true);
          window.__garage.owned({ intern: 14, gpu: 8, closet: 4, scraper: 2 });
        });
        await sleep(1500);
        await shot('05-garage');
        await page.evaluate(() => {
          window.__garage.freeze(false);
          window.__garage.scene('office');
          window.__garage.freeze(true);
          window.__garage.owned({ intern: 120, gpu: 110, closet: 100, scraper: 100, hall: 60, chips: 4, power: 2, robotics: 1, orbital: 0, universe: 0 });
        });
        await sleep(1500);
        await shot('06-office');
        await page.evaluate(() => window.__garage.freeze(false));

        // 7. The founder step of the start flow.
        await page.goto(`${base}/?lang=${lang}`, { waitUntil: 'networkidle0' });
        await page.evaluate(() => localStorage.removeItem('ai-race.run.v1'));
        await clean(page);
        await sleep(1000);
        const has = async (id) => !!(await page.$(`[data-testid="${id}"]`));
        if (await has('continue-new')) await page.click('[data-testid="continue-new"]');
        await page.click('[data-testid="start-dice"]');
        await sleep(300);
        await page.click('[data-testid="start-next"]');
        await sleep(600);
        if (await has('founder-hustler')) await page.click('[data-testid="founder-hustler"]');
        await sleep(600);
        await shot('07-founder');

        for (const e of page.errors) problems.push(`${lang} ${sizeName}: ${e}`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (problems.length) {
    console.log('Problems:');
    for (const p of problems) console.log(`  ${p}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
