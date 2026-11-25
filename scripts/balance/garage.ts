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
 *
 * The lab layer: bots tap most lab happenings while they play, launch every training run
 * and keep the candidate that scores best for their style (replacing a weaker kept model
 * when the slots are full), split staff by a fixed policy once staff unlocks, pick a
 * launch-day choice, and switch the auto-buy helper on when it arrives.
 *
 *   npm run balance:garage -- --legacy     # the same bots on the content without the lab layer
 */
import {
  advance,
  availableUpgrades,
  baseRate,
  buy,
  buyParadigmNode,
  buyUpgrade,
  claimDailyReward,
  claimOffer,
  collectGolden,
  collectHappening,
  createGarage,
  dismissOffline,
  formatAmount,
  formatDuration,
  generatorRate,
  isGeneratorUnlocked,
  keepModel,
  launchTraining,
  mechanicOn,
  nextRandom,
  scrapCandidates,
  setAutoBuy,
  setStaff,
  traitDef,
  offerStatus,
  paradigmEffects,
  paradigmNodeBlock,
  paradigmShift,
  paradigmStatus,
  prestige,
  prestigePreview,
  tap,
  tapIncident,
  tapValue,
  unitCost,
  type GarageContent,
  type GarageState,
  type ModelCandidate,
  type ModelStat,
  type OfferId,
  type StaffSplit,
} from '@/idle';
import { aiLabGarage } from '@/content/packs/ai-lab/garage';

const LEGACY = process.argv.includes('--legacy');
/** `--legacy`: the content without the lab layer (what the game played like before it). */
const content: GarageContent = LEGACY
  ? { ...aiLabGarage, stages: undefined, milestones: undefined, training: undefined, staff: undefined, shipDay: undefined, happenings: undefined, automation: undefined }
  : withoutParts(aiLabGarage);

/** `--without milestones,training,...`: drop lab parts to see what each one adds. */
function withoutParts(c: GarageContent): GarageContent {
  const i = process.argv.indexOf('--without');
  if (i < 0) return c;
  const out: Record<string, unknown> = { ...c };
  for (const part of (process.argv[i + 1] ?? '').split(',')) out[part] = undefined;
  if (!out.training) out.stages = (c.stages ?? []).map((st) => (st.mechanic === 'training' ? { ...st, mechanic: 'none' as const } : st));
  if (!out.staff) out.stages = ((out.stages as GarageContent['stages']) ?? []).map((st) => (st.mechanic === 'staff' ? { ...st, mechanic: 'none' as const } : st));
  return out as unknown as GarageContent;
}
const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
/** `--no-paradigm`: bots never shift (the game before the long-game layer). */
const NO_PARADIGM = process.argv.includes('--no-paradigm');
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
  /** Chance to tap a lab happening while playing. */
  happeningSkill: number;
  /** How much the bot values each model stat (per unit of the trait's value). */
  modelTaste: Partial<Record<ModelStat, number>>;
  staff: StaffSplit;
  shipChoice: string;
  /** Daily missions claimed per day (at the last check-in); 3 also opens the daily crate. */
  missions: number;
}

const ACTIVE_TASTE: Partial<Record<ModelStat, number>> = { production: 3, tap: 1, offlineRate: 0.3, offlineCap: 0.02, shipHype: 2.5, happening: 0.4, incident: -0.6, trainingSpeed: 0.6 };
const CASUAL_TASTE: Partial<Record<ModelStat, number>> = { production: 2.5, tap: 0.3, offlineRate: 5, offlineCap: 0.25, shipHype: 2.5, happening: 0.2, incident: -0.2, trainingSpeed: 0.8 };

/**
 * Daily missions a casual bot claims each day: the Garage one and the stretch (2) by default;
 * `--missions 0` leaves them out, `--missions 3` plays a race a day too and opens the crate.
 */
const MISSIONS = (() => {
  const i = process.argv.indexOf('--missions');
  return i > 0 ? Number(process.argv[i + 1]) : 2;
})();

const CASUAL_SESSIONS: [number, number][] = [[8 * HOUR, 3 * MIN], [13 * HOUR, 3 * MIN], [21 * HOUR, 4 * MIN]];

const PROFILES: Profile[] = [
  { name: 'casual', sessions: CASUAL_SESSIONS, tapsPerSec: 3, tapSeconds: 40, goldenSkill: 0.6, ads: false, boostsPerSession: 0, happeningSkill: 0.6, modelTaste: CASUAL_TASTE, staff: { research: 4, product: 5, safety: 3 }, shipChoice: 'safe', missions: MISSIONS },
  { name: 'casual + ads', sessions: CASUAL_SESSIONS, tapsPerSec: 3, tapSeconds: 40, goldenSkill: 0.6, ads: true, boostsPerSession: 2, happeningSkill: 0.6, modelTaste: CASUAL_TASTE, staff: { research: 4, product: 5, safety: 3 }, shipChoice: 'safe', missions: MISSIONS },
  { name: 'active', sessions: null, tapsPerSec: 6, tapSeconds: Infinity, goldenSkill: 0.9, ads: false, boostsPerSession: 0, happeningSkill: 0.85, modelTaste: ACTIVE_TASTE, staff: { research: 3, product: 6, safety: 3 }, shipChoice: 'hype', missions: 0 },
  { name: 'active + ads', sessions: null, tapsPerSec: 6, tapSeconds: Infinity, goldenSkill: 0.9, ads: true, boostsPerSession: 1, happeningSkill: 0.85, modelTaste: ACTIVE_TASTE, staff: { research: 3, product: 6, safety: 3 }, shipChoice: 'hype', missions: 0 },
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
  stages: Record<number, number>;
  trainingRuns: number;
  modelsKept: number;
  happenings: number;
  /** Paradigm Shifts (ms from the start) and the currency each gave. */
  shifts: { at: number; gain: number; generation: number }[];
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
  const choice = content.shipDay?.choices.some((c) => c.id === p.shipChoice) ? p.shipChoice : undefined;
  const r = prestige(s, content, s.now, { bonus, choice });
  if (!r.ok) return s;
  if (bonus) log.ads.prestigeBonus = (log.ads.prestigeBonus ?? 0) + 1;
  log.ships.push({ at: s.now - t0, generation: r.state.generation, gain: r.state.hype - s.hype });
  return r.state;
}

/** The order bots buy Paradigm tree nodes in (each once its requirements are owned). */
const NODE_ORDER = ['compound', 'cloud-drive', 'intern-pipeline', 'low-bar', 'campus', 'second-crate', 'muscle-memory', 'compound-2', 'ship-friday', 'fourth-candidate', 'night-owls', 'gpu-reservations', 'open-plan', 'caffeine', 'lucky-seeds', 'model-archive'];
/** A bot shifts once it can and no model has shipped for this long (stalled). */
const STALL_CASUAL = arg('stall', 1.5) * DAY;
const STALL_ACTIVE = 40 * MIN;

/** Paradigm Shift when stalled, then spend the currency down the tree. */
function maybeParadigm(s: GarageState, p: Profile, log: Log, t0: number): GarageState {
  if (!content.paradigm || NO_PARADIGM) return s;
  const st = paradigmStatus(s, content);
  const lastShip = Math.max(log.ships[log.ships.length - 1]?.at ?? 0, log.shifts[log.shifts.length - 1]?.at ?? 0);
  const stall = p.sessions ? STALL_CASUAL : STALL_ACTIVE;
  if (st.available && s.now - t0 - lastShip >= stall) {
    const r = paradigmShift(s, content, s.now);
    if (r.ok) {
      log.shifts.push({ at: s.now - t0, gain: st.gain, generation: s.generation });
      s = r.state;
    }
  }
  for (let again = true; again; ) {
    again = false;
    for (const id of NODE_ORDER) {
      if (paradigmNodeBlock(s, content, id)) continue;
      s = buyParadigmNode(s, content, id, s.now).state;
      again = true;
      break;
    }
  }
  return s;
}

function modelScore(m: ModelCandidate, p: Profile): number {
  let v = 0;
  for (const b of [...m.boons, ...(m.drawback ? [m.drawback] : [])]) {
    const def = traitDef(content, b.trait);
    if (def) v += (p.modelTaste[def.stat] ?? 0) * b.value;
  }
  return v;
}

/** Training runs, kept models, staff and the auto-buy switch. */
function runLab(s: GarageState, p: Profile, log: Log): GarageState {
  if (log.stages[s.stage] === undefined) log.stages[s.stage] = s.now - START;
  if (mechanicOn(s, content, 'staff') && content.staff && s.staff.product !== p.staff.product) s = setStaff(s, content, p.staff, s.now).state;
  if (mechanicOn(s, content, 'autoBuy') && !s.autoBuy) s = setAutoBuy(s, content, true, s.now).state;
  for (let i = 0; i < 6 && mechanicOn(s, content, 'training'); i++) {
    if (!s.training.candidates) {
      if (s.training.charges < 1) break;
      const r = launchTraining(s, content, s.now);
      if (!r.ok) break;
      s = r.state;
      log.trainingRuns++;
    }
    const cands = [...(s.training.candidates ?? [])].sort((a, b) => modelScore(b, p) - modelScore(a, p));
    const best = cands[0];
    const slots = content.stages?.slice(0, s.stage + 1).reduce((m, st) => Math.max(m, st.modelSlots), 0) ?? 0;
    const worst = [...s.models].sort((a, b) => modelScore(a, p) - modelScore(b, p))[0];
    if (best && modelScore(best, p) > 0 && s.models.length < slots) s = keepModel(s, content, best.uid, s.now).state;
    else if (best && worst && modelScore(best, p) > modelScore(worst, p)) s = keepModel(s, content, best.uid, s.now, worst.uid).state;
    else s = scrapCandidates(s, content, s.now).state;
    if (s.stats.modelsKept > log.modelsKept) log.modelsKept = s.stats.modelsKept;
  }
  return s;
}

/** One second of play: taps, golden moments, incidents, happenings, ads, the lab, shopping, shipping. */
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
    if (catchIt && p.ads) s = watchAd(s, 'bonusMultiply', log);
    if (p.ads) s = watchAd(s, 'frenzyExtend', log);
  }
  if (s.incident && s.now - s.incident.startedAt >= 3 * SEC) {
    if (p.ads) s = watchAd(s, 'incidentFix', log);
    for (let i = 0; i < 6 && s.incident; i++) s = tapIncident(s, content, s.now).state;
  }
  if (s.happening && s.now - s.happening.spawnedAt >= 2 * SEC && s.happening.expiresAt - s.now > SEC) {
    if (roll() < p.happeningSkill / 6) {
      const r = collectHappening(s, content, s.now);
      if (r.ok) log.happenings++;
      s = r.state;
      if (p.ads) s = watchAd(s, 'bonusMultiply', log);
    }
  }
  if (p.ads) s = watchAd(s, 'crate', log);
  s = runLab(s, p, log);
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
  dayRows: { day: number; generation: number; tokens: number; rate: number; hype: number; best: number; shifts: number; moats: number }[];
}

function run(p: Profile, days: number, activeHours: number): RunResult {
  botSeed = 12345;
  tracing = p.name === 'active';
  seenAffordable.clear();
  let s = createGarage(content, START, 42);
  const log: Log = { firstGenerator: null, news: [], ships: [], ads: {}, stages: {}, trainingRuns: 0, modelsKept: 0, happenings: 0, shifts: [] };
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
      if ((s.now - START) % MIN === 0) s = maybeParadigm(s, p, log, START);
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
      s = maybeParadigm(s, p, log, START);
      s = runLab(s, p, log);
      if (p.ads) for (let b = 0; b < p.boostsPerSession; b++) s = watchAd(s, 'boost', log);
      const end = begin + length;
      while (s.now < end) {
        const tapping = s.now - begin < p.tapSeconds * SEC;
        s = playSecond(s, p, tapping, log, START);
        note();
      }
      if (offset === p.sessions[p.sessions.length - 1][0] && p.missions > 0 && content.missions) {
        for (let m = 0; m < Math.min(3, p.missions); m++) s = claimDailyReward(s, content, 'mission', s.now).state;
        if (p.missions >= 3) s = claimDailyReward(s, content, 'crate', s.now, { streak: d + 1, crateMult: paradigmEffects(s, content).crateMult }).state;
        s = shop(s, p, false, log, START);
      }
    }
    s = advance(s, content, START + (d + 1) * DAY);
    dayRows.push({ day: d + 1, generation: s.generation, tokens: s.stats.tokensAllTime, rate: baseRate(s, content), hype: s.hype, best: Math.max(s.generation, s.paradigm?.bestGeneration ?? 0), shifts: s.paradigm?.count ?? 0, moats: s.paradigm?.earned ?? 0 });
  }
  return { profile: p, log, state: s, reached, dayRows };
}

// ---------------------------------------------------------------------------------------
// Report

const DAYS = arg('days', 10);
const ACTIVE_HOURS = arg('hours', 3);
const lastNamed = content.paradigm?.minGeneration ?? content.generations.length - 1;

const t0 = Date.now();
const results = PROFILES.map((p) => run(p, DAYS, ACTIVE_HOURS));

const fmt = (ms: number) => formatDuration(ms);
console.log(`# Garage pacing (${DAYS} days casual, ${ACTIVE_HOURS} h active)${LEGACY ? ' — legacy content (no lab layer)' : ''}\n`);

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
const ids: OfferId[] = ['offlineDouble', 'boost', 'frenzyExtend', 'incidentFix', 'crate', 'prestigeBonus', 'bonusMultiply'];
for (const id of ids) console.log(`| ${id} | ${((casualAds.log.ads[id] ?? 0) / DAYS).toFixed(1)} | ${((activeAds.log.ads[id] ?? 0) / ACTIVE_HOURS).toFixed(1)} |`);
if (!LEGACY) {
  console.log('\n## The lab\n');
  console.log('| Profile | Office | Data centre | Company town | Latent space | training runs | models kept | happenings tapped |\n| --- | --- | --- | --- | --- | --- | --- | --- |');
  const when = (r: RunResult, i: number) => {
    const t = r.log.stages[i];
    return t === undefined ? '-' : t < DAY ? fmt(t) : `day ${(t / DAY).toFixed(1)}`;
  };
  for (const r of results) {
    const span = r.profile.sessions ? `${DAYS} d` : `${ACTIVE_HOURS} h`;
    console.log(`| ${r.profile.name} | ${when(r, 1)} | ${when(r, 2)} | ${when(r, 3)} | ${when(r, 4)} | ${r.log.trainingRuns} / ${span} | ${r.log.modelsKept} | ${r.log.happenings} |`);
  }
}
// ---------------------------------------------------------------------------------------
// Check-in frequency: the same 10 minutes of play (and 2 minutes of tapping) a day, split into
// 1, 2, 3 or 6 check-ins. Away storage caps each gap, so checking in more often earns more.
if (!process.argv.includes('--no-checkins')) {
  const casualP = PROFILES[0];
  const plans: [string, [number, number][]][] = [
    ['once a day (20:00)', [[20 * HOUR, 10 * MIN]]],
    ['twice (08:00, 20:00)', [[8 * HOUR, 5 * MIN], [20 * HOUR, 5 * MIN]]],
    ['three times (08, 13, 21)', [[8 * HOUR, 3 * MIN + 20 * SEC], [13 * HOUR, 3 * MIN + 20 * SEC], [21 * HOUR, 3 * MIN + 20 * SEC]]],
    ['six times (every 3 h from 08)', [8, 11, 14, 17, 20, 23].map((h) => [h * HOUR, 100 * SEC] as [number, number])],
  ];
  const span = Math.min(DAYS, 14);
  console.log(`\n## Check-in frequency (casual, no ads, 10 min of play a day, ${span} days)\n`);
  console.log('| Check-ins | model day 3 | model day 7 | model day 14 | tokens day 3 | tokens day 7 | vs once a day (day 7 tokens) |\n| --- | --- | --- | --- | --- | --- | --- |');
  let base = 0;
  for (const [label, sessions] of plans) {
    const prof: Profile = { ...casualP, name: label, sessions, tapSeconds: 120 / sessions.length };
    const r = run(prof, span, ACTIVE_HOURS);
    const row = (d: number) => r.dayRows[Math.min(r.dayRows.length, d) - 1];
    if (!base) base = row(7).tokens;
    console.log(`| ${label} | ${row(3).generation + 1} | ${row(7).generation + 1} | ${row(14).generation + 1} | ${formatAmount(row(3).tokens)} | ${formatAmount(row(7).tokens)} | ${(row(7).tokens / base).toFixed(1)}x |`);
  }
}
// ---------------------------------------------------------------------------------------
// The long game (`--long 40`): Paradigm Shifts and the extended model ladder.
const LONG = arg('long', 0);
if (LONG > 0 && content.paradigm) {
  const endGen = content.generations.length - 1;
  const firstNamedEnd = content.paradigm.minGeneration;
  const activeDaily: Profile = { ...PROFILES[2], name: 'active (2 h a day)', sessions: [[11 * HOUR, HOUR], [20 * HOUR, HOUR]], tapSeconds: Infinity, missions: 3 };
  const longRuns = [PROFILES[0], PROFILES[1], activeDaily].map((p) => run(p, LONG, ACTIVE_HOURS));
  const dayOf = (r: RunResult, g: number) => {
    const row = r.dayRows.find((x) => x.best >= g);
    return row ? `day ${row.day}` : '-';
  };
  const dayAt = (ms: number | undefined) => (ms === undefined ? '-' : `day ${(ms / DAY).toFixed(1)}`);
  console.log(`\n## The long game (${LONG} days)${NO_PARADIGM ? ' — no Paradigm Shift' : ''}\n`);
  console.log(`| Profile | Model ${firstNamedEnd + 1} first | first Paradigm Shift | shifts | Model 18 | end of content (Model ${endGen + 1}) | currency earned |\n| --- | --- | --- | --- | --- | --- | --- |`);
  for (const r of longRuns) {
    const last = r.dayRows[r.dayRows.length - 1];
    console.log(`| ${r.profile.name} | ${dayOf(r, firstNamedEnd)} | ${dayAt(r.log.shifts[0]?.at)} | ${r.log.shifts.length} | ${dayOf(r, 17)} | ${dayOf(r, endGen)} | ${last.moats} |`);
  }
  console.log('\nShifts (day, model it was made at, currency):\n');
  for (const r of longRuns) console.log(`- ${r.profile.name}: ${r.log.shifts.map((x) => `day ${(x.at / DAY).toFixed(1)} at Model ${x.generation + 1} (+${x.gain})`).join(', ') || 'none'}`);
  console.log(`\n| Day | ${longRuns.map((r) => `${r.profile.name}: model now / best`).join(' | ')} |\n| --- | ${longRuns.map(() => '---').join(' | ')} |`);
  for (const d of [1, 2, 3, 5, 7, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40, 45, 50, 60].filter((x) => x <= LONG)) {
    console.log(`| ${d} | ${longRuns.map((r) => { const row = r.dayRows[d - 1]; return `${row.generation + 1} / ${row.best + 1}${row.shifts ? ` (${row.shifts} shifts)` : ''}`; }).join(' | ')} |`);
  }
}
console.log(`\n(simulated in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
