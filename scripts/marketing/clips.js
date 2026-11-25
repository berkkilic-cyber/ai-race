#!/usr/bin/env node
/**
 * Three short screen recordings of the full game for social posts, as MP4 (H.264, yuv420p,
 * 1920x1080, 30 fps, no audio), each 15-25 s and under 8 MB:
 *   1. garage-fill.mp4  the Garage lab filling up from empty to full, then the Office
 *   2. sprint-run.mp4   a Sprint run in fast forward, ending on the end screen
 *   3. event-cards.mp4  a run of event cards, choices and their results, with the ticker
 *
 *   npm run marketing:clips          # builds dist/ if missing; CLIPS=garage,sprint,events
 *
 * How: headless Chrome at 960x540 CSS px and 2x (1920x1080 frames). Each clip is a list of
 * frames with durations: time-lapse parts advance the game by a fixed step per frame through
 * the `?debug=1` handles (window.__game, window.__garage) and give each frame a fixed duration;
 * real-time parts (cards dropping in, the end screen counting up) keep the time each frame
 * really took. ffmpeg assembles the list at a constant 30 fps. Then three frames of each clip
 * are extracted beside it (docs/marketing/clips/frames/) for a look, and ffprobe prints its
 * duration, size and frame rate.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ROOT, FFMPEG, sleep, ensureBuild, serve, launch, newPage, startRun, openGarage } = require('./lib');

const OUT = path.join(ROOT, 'docs', 'marketing', 'clips');
const FFPROBE = process.env.FFPROBE || (fs.existsSync(path.join(path.dirname(FFMPEG), 'ffprobe')) ? path.join(path.dirname(FFMPEG), 'ffprobe') : 'ffprobe');
const CLIPS = (process.env.CLIPS || 'garage,sprint,events').split(',');
const VIEW = { width: 960, height: 540, scale: 2 };
const MAX_BYTES = 8 * 1024 * 1024;
const LANG = process.env.LANG_CLIP || 'en';

class Recorder {
  constructor(page, name) {
    this.page = page;
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), `clip-${name}-`));
    this.frames = [];
    this.last = Date.now();
  }
  /** One frame shown for `ms` (time-lapse). */
  async snap(ms) {
    const file = path.join(this.dir, `${String(this.frames.length).padStart(5, '0')}.jpg`);
    await this.page.screenshot({ path: file, type: 'jpeg', quality: 92 });
    this.frames.push({ file, ms });
    this.last = Date.now();
  }
  /** Frames for `ms` of real time, each lasting as long as it took. */
  async hold(ms) {
    const end = Date.now() + ms;
    let prev = Date.now();
    while (Date.now() < end) {
      const file = path.join(this.dir, `${String(this.frames.length).padStart(5, '0')}.jpg`);
      await this.page.screenshot({ path: file, type: 'jpeg', quality: 92 });
      const now = Date.now();
      this.frames.push({ file, ms: Math.max(15, now - prev) });
      prev = now;
    }
  }
  total() {
    return this.frames.reduce((a, f) => a + f.ms, 0);
  }
  encode(out, crf = 23) {
    const list = path.join(this.dir, 'list.txt');
    const lines = [];
    for (const f of this.frames) lines.push(`file '${f.file}'`, `duration ${(f.ms / 1000).toFixed(4)}`);
    lines.push(`file '${this.frames[this.frames.length - 1].file}'`);
    fs.writeFileSync(list, lines.join('\n'));
    const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30,scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high', '-movflags', '+faststart', '-an', out];
    const r = spawnSync(FFMPEG, args, { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${out}`);
  }
  dispose() {
    fs.rmSync(this.dir, { recursive: true, force: true });
  }
}

function probe(file) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,pix_fmt,nb_frames:format=duration,size', '-of', 'json', file], { encoding: 'utf8' });
  const j = JSON.parse(r.stdout);
  const s = j.streams[0];
  return { codec: s.codec_name, width: s.width, height: s.height, fps: s.r_frame_rate, pix: s.pix_fmt, frames: Number(s.nb_frames), duration: Number(j.format.duration), bytes: Number(j.format.size) };
}

function extractFrames(file, name, duration) {
  const dir = path.join(OUT, 'frames');
  fs.mkdirSync(dir, { recursive: true });
  [0.1, 0.5, 0.95].forEach((f, i) => {
    const at = (duration * f).toFixed(2);
    spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-ss', at, '-i', file, '-frames:v', '1', '-vf', 'scale=960:-2', path.join(dir, `${name}-${i + 1}.jpg`)], { stdio: 'inherit' });
  });
}

/** Encodes, keeps it under 8 MB (raising the CRF), prints ffprobe's view and pulls three frames. */
function finish(rec, name) {
  const out = path.join(OUT, `${name}.mp4`);
  let crf = 23;
  rec.encode(out, crf);
  while (fs.statSync(out).size > MAX_BYTES && crf < 35) {
    crf += 3;
    rec.encode(out, crf);
  }
  const p = probe(out);
  console.log(`${name}.mp4: ${p.codec} ${p.pix} ${p.width}x${p.height} @ ${p.fps} fps, ${p.duration.toFixed(2)} s, ${p.frames} frames, ${(p.bytes / 1024 / 1024).toFixed(2)} MB (crf ${crf})`);
  extractFrames(out, name, p.duration);
  rec.dispose();
  return p;
}

const NONE = { intern: 0, gpu: 0, closet: 0, scraper: 0, hall: 0, chips: 0, power: 0, robotics: 0, orbital: 0, universe: 0 };
const lerp = (a, b, k) => Math.round(a + (b - a) * k);

async function garageClip(page, base) {
  await openGarage(page, base, LANG);
  await page.evaluate((none) => {
    window.__garage.scene('fresh');
    window.__garage.freeze(true);
    window.__garage.owned(none);
  }, NONE);
  await sleep(1200);
  const rec = new Recorder(page, 'garage');
  await rec.hold(900);
  // The garage fills (about 8 s), the lab moves to the Office, the Office fills (about 8 s).
  const garageFull = { intern: 24, gpu: 14, closet: 8, scraper: 5 };
  const officeFull = { intern: 120, gpu: 110, closet: 100, scraper: 100, hall: 60, chips: 4, power: 2, robotics: 1 };
  const steps = 64;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const counts = Object.fromEntries(Object.entries(garageFull).map(([id, n]) => [id, lerp(0, n, Math.min(1, k * (1 + Object.keys(garageFull).indexOf(id) * 0.15)))]));
    await page.evaluate((c) => window.__garage.owned(c), counts);
    await sleep(40);
    await rec.snap(125);
  }
  await rec.hold(800);
  await page.evaluate((none) => {
    window.__garage.freeze(false);
    window.__garage.scene('office');
    window.__garage.freeze(true);
    window.__garage.owned(none);
  }, NONE);
  await sleep(400);
  await rec.hold(700);
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const counts = Object.fromEntries(Object.entries(officeFull).map(([id, n]) => [id, lerp(0, n, Math.pow(k, 1.3))]));
    await page.evaluate((c) => window.__garage.owned(c), counts);
    await sleep(40);
    await rec.snap(125);
  }
  await page.evaluate(() => window.__garage.happening('pizza'));
  await rec.hold(2200);
  await page.evaluate(() => window.__garage.freeze(false));
  return finish(rec, 'garage-fill');
}

async function sprintClip(page, base) {
  // Find a Sprint seed the bot wins (cheap: the run is played without screenshots first).
  let seed = null;
  for (const s of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
    await startRun(page, base, { seed: s, lang: LANG, runLength: 'sprint', difficulty: 'sandbox' });
    for (let i = 0; i < 40; i++) {
      await page.evaluate(() => window.__game.advance(100, { bot: true, collectMoments: true }));
      if (await page.evaluate(() => window.__game.store.getState().state.status === 'ended')) break;
    }
    const e = await page.evaluate(() => window.__game.store.getState().state.ending);
    console.log(`sprint seed ${s}: ${e ? `${e.kind} ${e.endingId} day ${e.tick + 1}` : 'none'}`);
    if (e && e.kind === 'win') {
      seed = { s, ticks: e.tick };
      break;
    }
  }
  if (!seed) throw new Error('no Sprint seed won');
  await startRun(page, base, { seed: seed.s, lang: LANG, runLength: 'sprint', difficulty: 'sandbox' });
  // Launch banners are part of the show here.
  await page.addStyleTag({ content: '[data-testid^="launch-banner"]{display:flex !important}' });
  await sleep(800);
  const rec = new Recorder(page, 'sprint');
  await rec.hold(800);
  // About 15 s of play for the whole run, whatever its length.
  const frames = 150;
  const per = Math.max(1, Math.ceil(seed.ticks / frames));
  for (let i = 0; i < frames + 20; i++) {
    await page.evaluate((n) => window.__game.advance(n, { bot: true, collectMoments: true }), per);
    await sleep(30);
    await rec.snap(100);
    if (await page.evaluate(() => window.__game.store.getState().state.status === 'ended')) break;
  }
  await page.waitForFunction(() => location.pathname === '/end', { timeout: 15000 });
  await page.addStyleTag({ content: '[data-testid="build-stamp"],[data-testid="achievement-toast"]{display:none !important}' });
  await rec.hold(4500);
  return finish(rec, 'sprint-run');
}

async function eventsClip(page, base) {
  await startRun(page, base, { seed: 2, lang: LANG });
  await page.evaluate(() => {
    for (let i = 0; i < 1600; i += 400) window.__game.advance(400, { bot: true });
  });
  await page.evaluate(() => window.__game.store.getState().dismissEventResult());
  await sleep(1500);
  const rec = new Recorder(page, 'events');
  await rec.hold(1200);
  const cards = [
    { id: 'parking-lot-gpus', choice: 'buy' },
    { id: 'sandbox-escape', choice: 'spin' },
    { id: 'squirrel-blackout', choice: 'diesel' },
    { id: 'rare-toaster', choice: 'lawyer' },
  ];
  for (const card of cards) {
    const choice = await page.evaluate((card) => {
      const store = window.__game.store;
      const s = store.getState().state;
      const me = s.labs[s.playerLabId];
      const labs = { ...s.labs, [me.id]: { ...me, cash: Math.max(me.cash, 150), hype: Math.max(me.hype, 60) } };
      store.setState({ eventResult: null, state: { ...s, labs, pendingEvent: { eventId: card.id, labId: s.playerLabId } } });
      return card.choice;
    }, card);
    await rec.hold(2600);
    const sel = (await page.$(`[data-testid="event-choice-${choice}"]`)) ? `[data-testid="event-choice-${choice}"]` : '[data-testid^="event-choice-"]';
    await page.click(sel);
    await rec.hold(2000);
    if (await page.$('[data-testid="event-continue"]')) await page.click('[data-testid="event-continue"]');
    // A few days pass: the ticker moves on, the map changes a little.
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.__game.advance(6, { bot: true, autoResolve: false }));
      await rec.snap(120);
    }
  }
  return finish(rec, 'event-cards');
}

async function main() {
  ensureBuild();
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launch();
  const results = {};
  try {
    for (const name of CLIPS) {
      const page = await newPage(browser, VIEW);
      if (name === 'garage') results.garage = await garageClip(page, base);
      else if (name === 'sprint') results.sprint = await sprintClip(page, base);
      else if (name === 'events') results.events = await eventsClip(page, base);
      else throw new Error(`unknown clip ${name}`);
      if (page.errors.length) console.log(`${name}: page errors:\n  ${page.errors.join('\n  ')}`);
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
  const bad = Object.entries(results).filter(([, p]) => p.duration < 15 || p.duration > 25 || p.bytes > MAX_BYTES || p.width !== 1920 || p.height !== 1080);
  if (bad.length) {
    console.log(`out of spec: ${bad.map(([n]) => n).join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
