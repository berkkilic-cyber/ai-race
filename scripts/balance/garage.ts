/**
 * Garage pacing simulator: plays the idle economy headless with bot profiles and prints
 * the pacing tables for docs/GARAGE.md.
 *
 *   npm run balance:garage                 # all profiles
 *   npm run balance:garage -- --days 14    # longer casual runs
 *
 * Profiles: casual (three short check-ins a day, a little tapping), active (plays
 * continuously, taps a lot), each with and without ad boosts. Bots buy greedily by payback
 * time, catch most golden moments, fix incidents and ship a model when the Hype gained is
 * worth it. Time is simulated through the engine's own advance (closed form while away).
 */
import {
  advance,
  availableUpgrades,
  baseRate,
  buy,
  buyUpgrade,
  claimOffer,
  collectGolden,
  createGarage,
  dismissOffline,
  formatAmount,
  formatDuration,
  generatorRate,
  isGeneratorUnlocked,
  nextRandom,
  offerStatus,
  prestige,
  prestigePreview,
  tap,
  tapIncident,
  tapValue,
  unitCost,
  type GarageContent,
  type GarageState,
  type OfferId,
} from '@/idle';
import { aiLabGarage } from '@/content/packs/ai-lab/garage';

const content: GarageContent = aiLabGarage;
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const START = Date.UTC(2026, 0, 5, 0, 0, 0);

interface Profile {
  name: string;
  /** Sessions as [start offset in a day, length] (casual), or null = plays non-stop. */
  sessions: [number, number][] | null;
  /** Taps per second while tapping. */
  tapsPerSec: number;
  /** Seconds of tapping at the start of each session (Infinity = always). */
  tapSeconds: number;
  /** Chance to catch a golden moment. */
  goldenSkill: number;
  ads: boolean;
  /** Boost ads watched per session (ad profiles). */
  boostsPerSession: number;
}

const PROFILES: Profile[] = [
  { name: 'casual', sessions: [[8 * HOUR, 3 * MIN], [13 * HOUR, 3 * MIN], [21 * HOUR, 4 * MIN]], tapsPerSec: 3, tapSeconds: 40, goldenSkill: 0.6, ads: false, boostsPerSession: 0 },
  { name: 'casual + ads', sessions: [[8 * HOUR, 3 * MIN], [13 * HOUR, 3 * MIN], [21 * HOUR, 4 * MIN]], tapsPerSec: 3, tapSeconds: 40, goldenSkill: 0.6, ads: true, boostsPerSession: 2 },
  { name: 'active', sessions: null, tapsPerSec: 6, tapSeconds: Infinity, goldenSkill: 0.9, ads: false, boostsPerSession: 0 },
  { name: 'active + ads', sessions: null, tapsPerSec: 6, tapSeconds: Infinity, goldenSkill: 0.9, ads: true, boostsPerSession: 1 },
];

/** Bot randomness, separate from the game's PRNG. */
let botSeed = 12345;
function roll(): number {
  const r = nextRandom(botSeed);
  botSeed = r.seed;
  return r.value;
}

interface Log {
  firstGenerator: number | null;
  /** Times (ms from start) something new became buyable (first affordable generator tier or upgrade). */
  news: number[];
  ships: { at: number; generation: number; gain: number }[];
  ads: Record<string, number>;
}

const seenAffordable = new Set<string>();
const TRACE = process.argv.includes('--trace');
let tracing = false;

function noteNew(s: GarageState, log: Log, t: number): void {
  for (const g of content.generators) {
    const key = `g:${g.id}:${s.generation}`;
    if (!seenAffordable.has(key) && isGeneratorUnlocked(s, content, g.id) && s.tokens >= unitCost(g, s.generators[g.id] ?? 0)) {
      seenAffordable.add(key);
      log.news.push(t);
      if (TRACE && tracing && t < 12 * MIN) console.log(`  ${formatDuration(t)} ${g.id}`);
    }
  }
  for (const u of availableUpgrades(s, content)) {
    const key = `u:${u.id}:${s.generation}`;
    if (!seenAffordable.has(key) && s.tokens >= u.cost) {
      seenAffordable.add(key);
      log.news.push(t);
      if (TRACE && tracing && t < 12 * MIN) console.log(`  ${formatDuration(t)} ${u.id}`);
    }
  }
}

/** Income per second a state earns, counting this profile's tapping. */
function income(s: GarageState, p: Profile, tapping: boolean): number {
  return baseRate(s, content) + (tapping ? tapValue(s, content, s.now, 20) * p.tapsPerSec : 0);
}

/** Greedy buyer: the item with the best payback, bought while affordable. */
function shop(s: GarageState, p: Profile, tapping: boolean, log: Log, t0: number): GarageState {
  for (let i = 0; i < 200; i++) {
    const now = s.now;
    const inc = Math.max(1e-9, income(s, p, tapping));
    let best: { id: string; kind: 'gen' | 'up'; cost: number; score: number } | null = null;
    for (const g of content.generators) {
      if (!isGeneratorUnlocked(s, content, g.id)) continue;
      const owned = s.generators[g.id] ?? 0;
      const cost = unitCost(g, owned);
      const delta = owned > 0 ? generatorRate({ ...s, boostUntil: 0, frenzy: null, incident: null }, content, g.id) / owned : g.baseRate;
      const score = cost / Math.max(1e-12, delta) + cost / inc;
      if (!best || score < best.score) best = { id: g.id, kind: 'gen', cost, score };
    }
    for (const u of availableUpgrades(s, content)) {
      const after: GarageState = { ...s, upgrades: [...s.upgrades, u.id] };
      const delta = income(after, p, tapping) - inc;
      // Upgrades with no direct income (offline, golden, combo) are bought once they are cheap.
      const score = delta > inc * 1e-6 ? u.cost / delta + u.cost / inc : u.cost <= s.tokens * 0.15 ? 0 : Infinity;
      if (!best || score < best.score) best = { id: u.id, kind: 'up', cost: u.cost, score };
    }
    if (!best || best.cost > s.tokens) break;
    const r = best.kind === 'gen' ? buy(s, content, best.id, 1, now) : buyUpgrade(s, content, best.id, now);
    if (!r.ok) break;
    if (best.kind === 'gen' && log.firstGenerator === null) log.firstGenerator = now - t0;
    s = r.state;
  }
  return s;
}

function watchAd(s: GarageState, id: OfferId, log: Log): GarageState {
  if (!offerStatus(s, content, id, s.now).available) return s;
  const r = claimOffer(s, content, id, s.now);
  if (r.ok) log.ads[id] = (log.ads[id] ?? 0) + 1;
  return r.ok ? r.state : s;
}

function maybeShip(s: GarageState, p: Profile, log: Log, t0: number): GarageState {
  const pv = prestigePreview(s, content);
  if (!pv.canShip) return s;
  // Ship when the Hype gained adds at least half again to the multiplier (or the first time).
  const worth = s.hype === 0 || pv.multAfter / pv.multNow >= 1.5;
  if (!worth) return s;
  const bonus = p.ads && offerStatus(s, content, 'prestigeBonus', s.now).available;
  const r = prestige(s, content, s.now, { bonus });
  if (!r.ok) return s;
  if (bonus) log.ads.prestigeBonus = (log.ads.prestigeBonus ?? 0) + 1;
  log.ships.push({ at: s.now - t0, generation: r.state.generation, gain: r.state.hype - s.hype });
  return r.state;
}

/** One second of play: taps, golden moments, incidents, ads, shopping, shipping. */
function playSecond(s: GarageState, p: Profile, tapping: boolean, log: Log, t0: number): GarageState {
  const t = s.now;
  if (tapping) {
    const n = Math.max(1, Math.round(p.tapsPerSec));
    for (let i = 0; i < n; i++) s = tap(s, content, t + (i * SEC) / n).state;
  }
  s = advance(s, content, t + SEC);
  if (s.golden && s.now - s.golden.spawnedAt >= 2 * SEC) {
    const catchIt = roll() < p.goldenSkill;
    if (catchIt) s = collectGolden(s, content, s.now).state;
    if (p.ads) s = watchAd(s, 'frenzyExtend', log);
  }
  if (s.incident && s.now - s.incident.startedAt >= 3 * SEC) {
    if (p.ads) s = watchAd(s, 'incidentFix', log);
    for (let i = 0; i < 6 && s.incident; i++) s = tapIncident(s, content, s.now).state;
  }
  if (p.ads) s = watchAd(s, 'crate', log);
  noteNew(s, log, s.now - t0);
  s = shop(s, p, tapping, log, t0);
  s = maybeShip(s, p, log, t0);
  noteNew(s, log, s.now - t0);
  return s;
}

interface RunResult {
  profile: Profile;
  log: Log;
  state: GarageState;
  /** Day (from the start) each generation was first reached. */
  reached: Record<number, number>;
  dayRows: { day: number; generation: number; tokens: number; rate: number; hype: number }[];
}

function run(p: Profile, days: number, activeHours: number): RunResult {
  botSeed = 12345;
  tracing = p.name === 'active';
  seenAffordable.clear();
  let s = createGarage(content, START, 42);
  const log: Log = { firstGenerator: null, news: [], ships: [], ads: {} };
  const reached: Record<number, number> = { 0: 0 };
  const dayRows: RunResult['dayRows'] = [];
  const note = () => {
    if (reached[s.generation] === undefined) reached[s.generation] = (s.now - START) / DAY;
  };
  if (!p.sessions) {
    const end = START + activeHours * HOUR;
    let boosted = 0;
    while (s.now < end) {
      if (p.ads && boosted < p.boostsPerSession * Math.ceil((s.now - START + 1) / HOUR) && offerStatus(s, content, 'boost', s.now).available) {
        s = watchAd(s, 'boost', log);
        boosted++;
      }
      s = playSecond(s, p, true, log, START);
      note();
    }
    return { profile: p, log, state: s, reached, dayRows };
  }
  for (let d = 0; d < days; d++) {
    for (const [offset, length] of p.sessions) {
      const begin = START + d * DAY + offset;
      if (begin > s.now) s = advance(s, content, begin);
      if (s.offline) {
        if (p.ads) s = watchAd(s, 'offlineDouble', log);
        s = dismissOffline(s);
      }
      if (p.ads) for (let b = 0; b < p.boostsPerSession; b++) s = watchAd(s, 'boost', log);
      const end = begin + length;
      while (s.now < end) {
        const tapping = s.now - begin < p.tapSeconds * SEC;
        s = playSecond(s, p, tapping, log, START);
        note();
      }
    }
    s = advance(s, content, START + (d + 1) * DAY);
    dayRows.push({ day: d + 1, generation: s.generation, tokens: s.stats.tokensAllTime, rate: baseRate(s, content), hype: s.hype });
  }
  return { profile: p, log, state: s, reached, dayRows };
}

// ---------------------------------------------------------------------------------------
// Report

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const DAYS = arg('days', 10);
const ACTIVE_HOURS = arg('hours', 3);
const lastNamed = content.generations.length - 1;

const t0 = Date.now();
const results = PROFILES.map((p) => run(p, DAYS, ACTIVE_HOURS));

const fmt = (ms: number) => formatDuration(ms);
console.log(`# Garage pacing (${DAYS} days casual, ${ACTIVE_HOURS} h active)\n`);

console.log('## Early game (active, no ads)\n');
const active = results.find((r) => r.profile.name === 'active')!;
const early = active.log.news.filter((t) => t <= 10 * MIN);
const gaps = [...early, 10 * MIN].map((t, i) => t - (i === 0 ? 0 : early[i - 1]));
console.log(`| Metric | Value |\n| --- | --- |`);
console.log(`| First generator bought | ${fmt(active.log.firstGenerator ?? NaN)} |`);
console.log(`| New things to buy in the first 10 min | ${early.length} |`);
console.log(`| Longest gap between new things (first 10 min) | ${fmt(Math.max(...gaps))} |`);
console.log(`| Median gap (first 10 min) | ${fmt([...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? NaN)} |`);
const late = early.filter((t) => t >= 60 * SEC);
const lateGaps = [...late, 10 * MIN].map((t, i) => t - (i === 0 ? 60 * SEC : late[i - 1]));
console.log(`| Longest gap from minute 1 to 10 | ${fmt(Math.max(0, ...lateGaps))} |\n`);

console.log('## Model ships (active play)\n');
console.log('| Ship | active: time | since last | Hype gained | active + ads: time | since last |\n| --- | --- | --- | --- | --- | --- |');
const activeAds = results.find((r) => r.profile.name === 'active + ads')!;
for (let i = 0; i < Math.max(active.log.ships.length, activeAds.log.ships.length) && i < 12; i++) {
  const a = active.log.ships[i];
  const b = activeAds.log.ships[i];
  const prevA = i > 0 ? active.log.ships[i - 1]?.at ?? 0 : 0;
  const prevB = i > 0 ? activeAds.log.ships[i - 1]?.at ?? 0 : 0;
  console.log(`| ${i + 1} | ${a ? fmt(a.at) : '-'} | ${a ? fmt(a.at - prevA) : '-'} | ${a ? a.gain : '-'} | ${b ? fmt(b.at) : '-'} | ${b ? fmt(b.at - prevB) : '-'} |`);
}

console.log('\n## Casual check-ins (3 a day): generation reached by day\n');
const casual = results.find((r) => r.profile.name === 'casual')!;
const casualAds = results.find((r) => r.profile.name === 'casual + ads')!;
console.log('| Day | casual: model | tokens (all time) | rate /s | casual + ads: model | tokens (all time) |\n| --- | --- | --- | --- | --- | --- |');
for (let d = 0; d < DAYS; d++) {
  const a = casual.dayRows[d];
  const b = casualAds.dayRows[d];
  console.log(`| ${d + 1} | ${a.generation + 1} | ${formatAmount(a.tokens)} | ${formatAmount(a.rate)} | ${b.generation + 1} | ${formatAmount(b.tokens)} |`);
}
const dry = (r: RunResult) => (r.reached[lastNamed] !== undefined ? `day ${r.reached[lastNamed].toFixed(1)}` : `not within ${DAYS} days`);
console.log(`\nLast named model (${lastNamed + 1}) reached: casual ${dry(casual)}, casual + ads ${dry(casualAds)}.`);

console.log('\n## Ad speed-up\n');
const genDay = (r: RunResult, g: number) => r.reached[g];
const ratios: string[] = [];
for (const g of [2, 4, 6, 8]) {
  const a = genDay(casual, g);
  const b = genDay(casualAds, g);
  if (a !== undefined && b !== undefined && b > 0) ratios.push(`model ${g + 1}: ${(a / b).toFixed(2)}x faster (day ${a.toFixed(1)} vs ${b.toFixed(1)})`);
}
const shipsAt = (r: RunResult, n: number) => r.log.ships[n - 1]?.at;
for (const n of [1, 3, 5]) {
  const a = shipsAt(active, n);
  const b = shipsAt(activeAds, n);
  if (a && b) ratios.push(`active, ship ${n}: ${(a / b).toFixed(2)}x faster (${fmt(a)} vs ${fmt(b)})`);
}
console.log(ratios.map((r) => `- ${r}`).join('\n'));
const tokRatio = casualAds.state.stats.tokensAllTime / Math.max(1, casual.state.stats.tokensAllTime);
console.log(`- casual, all-time tokens after ${DAYS} days: ${tokRatio >= 100 ? formatAmount(tokRatio) : tokRatio.toFixed(1)}x`);

console.log('\n## Ads watched per day (ad profiles)\n');
console.log('| Placement | casual + ads | active + ads (per hour) |\n| --- | --- | --- |');
const ids: OfferId[] = ['offlineDouble', 'boost', 'frenzyExtend', 'incidentFix', 'crate', 'prestigeBonus'];
for (const id of ids) console.log(`| ${id} | ${((casualAds.log.ads[id] ?? 0) / DAYS).toFixed(1)} | ${((activeAds.log.ads[id] ?? 0) / ACTIVE_HOURS).toFixed(1)} |`);
console.log(`\n(simulated in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
