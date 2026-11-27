/**
 * The idle economy: pure, deterministic, time-based. Every function takes the state, the
 * content and the caller's clock (`now`, ms) and returns a new state; inputs are never
 * mutated. Randomness comes from the seeded PRNG in `state.rng`.
 *
 * Time. `advance` moves the state to `now` in closed form: production is constant between
 * breakpoints (a boost or frenzy ending, an incident ending, a golden moment or incident
 * or headline due), so it walks breakpoint to breakpoint, never second by second. A gap
 * longer than `offline.thresholdMs` is time away: production at the offline rate, capped,
 * with events paused, and a report for the "While you were away" panel. A clock that went
 * backwards shifts every stored time by the same amount (no production, no lost timers);
 * an absurd jump forward is bounded by the offline cap.
 */
import { between, grant, pickWeighted, pushNews, random } from './core';
import { accrueTraining, autoBuyActive, evenStaff, expireHappening, runAutoBuy, spawnHappening, updateStage } from './lab';
import { factor, mechanicOn, modelEffects, staffEffects } from './labRates';
import { amount } from './num';
import { paradigmEffects } from './paradigmRates';
import {
  HOUR_MS,
  bulkCost,
  comboAfterTap,
  generatorDef,
  incidentDef,
  incidentFrequency,
  maxAffordable,
  multipliers,
  offerDef,
  offlineTerms,
  tapValue,
  totalRate,
  upgradeDef,
  withoutRaceBoost,
} from './rates';
import { seedFrom } from './rng';
import type { ActionResult, GarageContent, GarageFailure, GarageState, GarageStats, OfferId, Requirement, ShipChoiceDef, TapOutcome, UpgradeDef } from './types';
import { OFFER_IDS } from './types';

export const GARAGE_VERSION = 4;
export const DAY_MS = 24 * HOUR_MS;

export function emptyStats(): GarageStats {
  return {
    taps: 0,
    tokensAllTime: 0,
    modelsShipped: 0,
    bestCombo: 0,
    goldenCaught: 0,
    goldenMissed: 0,
    incidentsFixed: 0,
    incidentsSuffered: 0,
    offlineReturns: 0,
    offlineTokens: 0,
    generatorsBought: 0,
    upgradesBought: 0,
    cratesOpened: 0,
    boostsUsed: 0,
    offersClaimed: 0,
    playMs: 0,
    pureTaps: 0,
    genUpgrades: 0,
    fastestFixMs: 0,
    shippedClean: 0,
    happeningsCaught: 0,
    happeningsMissed: 0,
    trainingRuns: 0,
    modelsKept: 0,
    autoBought: 0,
  };
}

function emptyOffers(): Record<OfferId, number[]> {
  const out = {} as Record<OfferId, number[]>;
  for (const id of OFFER_IDS) out[id] = [];
  return out;
}

/** A fresh save at `now`. */
export function createGarage(content: GarageContent, now: number, seed: number = now): GarageState {
  return {
    version: GARAGE_VERSION,
    rng: seedFrom(seed),
    createdAt: now,
    now,
    tokens: 0,
    genLifetime: 0,
    generators: {},
    upgrades: [],
    generation: 0,
    hype: 0,
    labRep: 0,
    combo: { count: 0, lastAt: 0 },
    frenzy: null,
    boostUntil: 0,
    golden: null,
    nextGoldenAt: now + content.golden.firstAfterMs,
    incident: null,
    nextIncidentAt: now + content.incidents.firstAfterMs,
    nextHeadlineAt: now + 1500,
    news: [],
    offers: emptyOffers(),
    offline: null,
    achievements: [],
    stats: emptyStats(),
    lastShip: null,
    uidSeq: 1,
    stage: 0,
    happening: null,
    nextHappeningAt: now + (content.happenings?.firstAfterMs ?? 0),
    training: { charges: 0, nextChargeAt: 0, candidates: null },
    models: [],
    staff: evenStaff(content.staff?.total ?? 0),
    shipChoice: null,
    autoBuy: false,
    nextAutoBuyAt: 0,
    bonusOffer: null,
  };
}

/** Shallow copy with fresh nested objects that actions mutate (arrays are copied on write). */
function clone(s: GarageState): GarageState {
  const offers = {} as Record<OfferId, number[]>;
  for (const id of OFFER_IDS) offers[id] = s.offers[id] ? s.offers[id].slice() : [];
  return {
    ...s,
    generators: { ...s.generators },
    combo: { ...s.combo },
    frenzy: s.frenzy ? { ...s.frenzy } : null,
    golden: s.golden ? { ...s.golden } : null,
    incident: s.incident ? { ...s.incident } : null,
    offers,
    offline: s.offline ? { ...s.offline } : null,
    stats: { ...s.stats },
    lastShip: s.lastShip ? { ...s.lastShip } : null,
    happening: s.happening ? { ...s.happening } : null,
    training: { ...s.training },
    staff: { ...s.staff },
    bonusOffer: s.bonusOffer ? { ...s.bonusOffer } : null,
  };
}

// ---------------------------------------------------------------------------------------
// Events

function spawnGolden(s: GarageState, content: GarageContent, t: number): void {
  const cfg = content.golden;
  const interval = between(s, cfg.intervalMinMs, cfg.intervalMaxMs) * multipliers(s, content).goldenInterval;
  const def = pickWeighted(s, cfg.defs.filter((d) => (d.minGeneration ?? 0) <= s.generation));
  if (!def) {
    s.nextGoldenAt = t + interval;
    return;
  }
  const x = 0.12 + 0.76 * random(s);
  const y = 0.12 + 0.6 * random(s);
  s.golden = { uid: s.uidSeq++, id: def.id, spawnedAt: t, expiresAt: t + cfg.lifetimeMs, x, y };
  s.nextGoldenAt = t + cfg.lifetimeMs + interval;
}

function spawnIncident(s: GarageState, content: GarageContent, t: number): void {
  const cfg = content.incidents;
  const interval = between(s, cfg.intervalMinMs, cfg.intervalMaxMs) / incidentFrequency(s, content);
  const tiers = content.generators.filter((g) => (s.generators[g.id] ?? 0) >= cfg.minOwned);
  const defs = cfg.defs.filter((d) => (d.minGeneration ?? 0) <= s.generation);
  if (s.generation < cfg.minGeneration || tiers.length === 0 || defs.length === 0) {
    s.nextIncidentAt = t + interval;
    return;
  }
  const tier = tiers[Math.min(tiers.length - 1, Math.floor(random(s) * tiers.length))];
  const def = pickWeighted(s, defs)!;
  s.incident = { uid: s.uidSeq++, id: def.id, generator: tier.id, startedAt: t, until: t + def.durationMs, taps: 0 };
  s.stats.incidentsSuffered += 1;
  pushNews(s, content, def.textKey, 'incident', t, { tier: tier.nameKey });
  s.nextIncidentAt = t + def.durationMs + interval;
}

function spawnHeadline(s: GarageState, content: GarageContent, t: number): void {
  const cfg = content.news;
  s.nextHeadlineAt = t + between(s, cfg.intervalMinMs, cfg.intervalMaxMs);
  const last = s.news.filter((n) => n.kind === 'headline').slice(-3).map((n) => n.key);
  const pool = cfg.headlines.filter((h) => (h.minGeneration ?? 0) <= s.generation && !last.includes(h.key));
  const pick = pickWeighted(s, pool.length ? pool : cfg.headlines);
  if (pick) pushNews(s, content, pick.key, 'headline', t);
}

/** Everything due at exactly `t`: expiries first, then spawns. */
function processAt(s: GarageState, content: GarageContent, t: number): void {
  if (s.golden && t >= s.golden.expiresAt) {
    s.golden = null;
    s.stats.goldenMissed += 1;
  }
  if (s.incident && t >= s.incident.until) s.incident = null;
  if (s.frenzy && t >= s.frenzy.until) s.frenzy = null;
  if (s.bonusOffer && t >= s.bonusOffer.until) s.bonusOffer = null;
  if (s.happening && t >= s.happening.expiresAt) expireHappening(s, content);
  if (!s.golden && t >= s.nextGoldenAt) spawnGolden(s, content, t);
  if (!s.incident && t >= s.nextIncidentAt) spawnIncident(s, content, t);
  if (content.happenings && !s.happening && t >= s.nextHappeningAt) spawnHappening(s, content, t);
  if (t >= s.nextHeadlineAt) spawnHeadline(s, content, t);
  accrueTraining(s, content, t);
  if (autoBuyActive(s, content) && t >= s.nextAutoBuyAt) runAutoBuy(s, content, t);
}

/** The next time after `t` at which production or events change. */
function nextBreakpoint(s: GarageState, content: GarageContent, t: number): number {
  let next = Infinity;
  const consider = (v: number | undefined) => {
    if (v !== undefined && v > t && v < next) next = v;
  };
  consider(s.boostUntil);
  consider(s.race?.boostFrom);
  consider(s.race?.boostUntil);
  consider(s.frenzy?.until);
  consider(s.incident?.until);
  consider(s.golden ? s.golden.expiresAt : s.nextGoldenAt);
  if (!s.incident) consider(s.nextIncidentAt);
  consider(s.nextHeadlineAt);
  if (content.happenings) consider(s.happening ? s.happening.expiresAt : s.nextHappeningAt);
  if (s.training.nextChargeAt > 0) consider(s.training.nextChargeAt);
  if (autoBuyActive(s, content)) consider(s.nextAutoBuyAt);
  return next;
}

function runOnline(s: GarageState, content: GarageContent, end: number): void {
  let t = s.now;
  processAt(s, content, t);
  // Bounded: every pass either reaches `end` or crosses a breakpoint, and breakpoints are seconds apart.
  for (let guard = 0; t < end && guard < 10_000; guard++) {
    const next = Math.min(end, nextBreakpoint(s, content, t));
    grant(s, (totalRate(s, content, t) * (next - t)) / 1000);
    s.stats.playMs += next - t;
    t = next;
    s.now = t;
    processAt(s, content, t);
  }
  s.now = end;
}

/**
 * Tokens earned while away for `creditedMs` from `state.now`, at the offline rate:
 * piecewise constant across a boost or frenzy ending (incidents are not counted, they
 * resolve themselves while the player is away).
 */
export function offlineEarnings(state: GarageState, content: GarageContent, creditedMs: number): number {
  const calm: GarageState = { ...state, incident: null };
  const start = state.now;
  const end = start + Math.max(0, creditedMs);
  const rate = offlineTerms(state, content).rate;
  const cuts = [state.boostUntil, state.frenzy?.until ?? 0, state.race?.boostFrom ?? 0, state.race?.boostUntil ?? 0].filter((v) => v > start && v < end).sort((a, b) => a - b);
  let total = 0;
  let a = start;
  for (const b of [...cuts, end]) {
    total += (totalRate(calm, content, a) * (b - a)) / 1000;
    a = b;
  }
  return amount(total * rate);
}

/** The offline cap in ms for this state. */
export function offlineCapMs(state: GarageState, content: GarageContent): number {
  return offlineTerms(state, content).capMs;
}

/** Offline earnings rate (0..1) for this state. */
export function offlineRate(state: GarageState, content: GarageContent): number {
  return offlineTerms(state, content).rate;
}

function awayCatchUp(s: GarageState, content: GarageContent, now: number): void {
  const away = now - s.now;
  s.golden = null;
  s.incident = null;
  s.happening = null;
  s.bonusOffer = null;
  const capMs = offlineCapMs(s, content);
  const credited = Math.min(away, capMs);
  const capped = away > capMs;
  const tokens = grant(s, offlineEarnings(s, content, credited));
  s.now = now;
  if (s.frenzy && now >= s.frenzy.until) s.frenzy = null;
  s.combo = { count: 0, lastAt: s.combo.lastAt };
  s.nextGoldenAt = now + between(s, content.golden.intervalMinMs, content.golden.intervalMaxMs) * multipliers(s, content).goldenInterval * 0.5;
  s.nextIncidentAt = now + between(s, content.incidents.intervalMinMs, content.incidents.intervalMaxMs) / incidentFrequency(s, content);
  s.nextHeadlineAt = now + 1500;
  if (content.happenings) s.nextHappeningAt = now + content.happenings.firstAfterMs;
  if (s.nextAutoBuyAt > 0) s.nextAutoBuyAt = now + (content.automation?.buyIntervalMs ?? 0);
  accrueTraining(s, content, now);
  s.stats.offlineReturns += 1;
  s.stats.offlineTokens = amount(s.stats.offlineTokens + tokens);
  if (away >= content.offline.reportMinMs) {
    const prev = s.offline;
    s.offline = prev
      ? { awayMs: prev.awayMs + away, creditedMs: prev.creditedMs + credited, tokens: amount(prev.tokens + tokens), doubled: false, capped: capped || prev.capped === true, capMs }
      : { awayMs: away, creditedMs: credited, tokens, doubled: false, capped, capMs };
  }
}

/** Shifts every stored time by `delta` (the clock moved backwards). */
function rebase(s: GarageState, delta: number): void {
  s.boostUntil = s.boostUntil > 0 ? s.boostUntil + delta : 0;
  if (s.race && s.race.boostUntil > 0) s.race = { ...s.race, boostFrom: s.race.boostFrom + delta, boostUntil: s.race.boostUntil + delta };
  if (s.frenzy) s.frenzy.until += delta;
  if (s.golden) {
    s.golden.spawnedAt += delta;
    s.golden.expiresAt += delta;
  }
  if (s.incident) {
    s.incident.startedAt += delta;
    s.incident.until += delta;
  }
  s.nextGoldenAt += delta;
  s.nextIncidentAt += delta;
  s.nextHeadlineAt += delta;
  s.combo.lastAt += delta;
  if (s.happening) {
    s.happening.spawnedAt += delta;
    s.happening.expiresAt += delta;
  }
  s.nextHappeningAt += delta;
  if (s.training.nextChargeAt > 0) s.training.nextChargeAt += delta;
  if (s.nextAutoBuyAt > 0) s.nextAutoBuyAt += delta;
  if (s.bonusOffer) s.bonusOffer.until += delta;
  for (const id of OFFER_IDS) s.offers[id] = s.offers[id].map((v) => v + delta);
}

/**
 * Moves the state to `now`. Short gaps run in full (events included); a gap longer than
 * the offline threshold is time away. Returns the same object when nothing changes.
 */
export function advance(state: GarageState, content: GarageContent, now: number): GarageState {
  if (!Number.isFinite(now)) return state;
  const dt = now - state.now;
  if (dt === 0) return state;
  const s = clone(state);
  if (dt < 0) {
    rebase(s, dt);
    s.now = now;
    return s;
  }
  if (dt > content.offline.thresholdMs) awayCatchUp(s, content, now);
  else runOnline(s, content, now);
  checkAchievements(s, content);
  return s;
}

/** Advances and returns a private copy the caller may mutate. */
export function at(state: GarageState, content: GarageContent, now: number): GarageState {
  const s = advance(state, content, now);
  return s === state ? clone(state) : s;
}

// ---------------------------------------------------------------------------------------
// Actions

export function tap(state: GarageState, content: GarageContent, now: number): TapOutcome {
  const s = at(state, content, now);
  const count = comboAfterTap(s, content, s.now);
  const gained = grant(s, tapValue(s, content, s.now, count));
  s.combo = { count, lastAt: s.now };
  s.stats.taps += 1;
  if (count > s.stats.bestCombo) s.stats.bestCombo = count;
  if (!content.generators.some((g) => (s.generators[g.id] ?? 0) > 0)) s.stats.pureTaps += 1;
  checkAchievements(s, content);
  return { state: s, gained, combo: count };
}

export function isGeneratorUnlocked(state: GarageState, content: GarageContent, id: string): boolean {
  const def = generatorDef(content, id);
  return !!def && state.generation >= def.unlockGeneration;
}

export function requirementMet(state: GarageState, req: Requirement): boolean {
  switch (req.type) {
    case 'owned':
      return (state.generators[req.generator] ?? 0) >= req.count;
    case 'lifetime':
      return state.genLifetime >= req.tokens;
    case 'generation':
      return state.generation >= req.min;
    case 'taps':
      return state.stats.taps >= req.count;
    case 'upgrade':
      return state.upgrades.includes(req.id);
    case 'allTime':
      return state.stats.tokensAllTime >= req.tokens;
  }
}

/** Progress 0..1 towards a requirement. */
export function requirementProgress(state: GarageState, req: Requirement): number {
  const ratio = (have: number, need: number) => (need <= 0 ? 1 : Math.max(0, Math.min(1, have / need)));
  switch (req.type) {
    case 'owned':
      return ratio(state.generators[req.generator] ?? 0, req.count);
    case 'lifetime':
      return ratio(state.genLifetime, req.tokens);
    case 'generation':
      return state.generation >= req.min ? 1 : 0;
    case 'taps':
      return ratio(state.stats.taps, req.count);
    case 'upgrade':
      return state.upgrades.includes(req.id) ? 1 : 0;
    case 'allTime':
      return ratio(state.stats.tokensAllTime, req.tokens);
  }
}

export function isUpgradeAvailable(state: GarageState, def: UpgradeDef): boolean {
  return !state.upgrades.includes(def.id) && def.requires.every((r) => requirementMet(state, r));
}

/** Cost of `count` of a generator, or of an upgrade (count ignored). */
export function costOf(state: GarageState, content: GarageContent, id: string, count = 1): number {
  const g = generatorDef(content, id);
  if (g) return bulkCost(g, state.generators[id] ?? 0, count);
  return upgradeDef(content, id)?.cost ?? Infinity;
}

export function canAfford(state: GarageState, content: GarageContent, id: string, count = 1): boolean {
  return state.tokens >= costOf(state, content, id, count);
}

/** Buys `count` of a generator. */
export function buy(state: GarageState, content: GarageContent, id: string, count: number, now: number): ActionResult {
  const def = generatorDef(content, id);
  if (!def) return { state, ok: false, reason: 'unknownId' };
  const n = Math.floor(count);
  if (!(n >= 1)) return { state, ok: false, reason: 'none' };
  const s = at(state, content, now);
  if (!isGeneratorUnlocked(s, content, id)) return { state: s, ok: false, reason: 'locked' };
  const cost = bulkCost(def, s.generators[id] ?? 0, n);
  if (s.tokens < cost) return { state: s, ok: false, reason: 'cantAfford' };
  s.tokens = amount(s.tokens - cost);
  s.generators[id] = (s.generators[id] ?? 0) + n;
  s.stats.generatorsBought += n;
  checkAchievements(s, content);
  return { state: s, ok: true };
}

/** Buys as many of a generator as the tokens allow. */
export function buyMax(state: GarageState, content: GarageContent, id: string, now: number): ActionResult {
  const def = generatorDef(content, id);
  if (!def) return { state, ok: false, reason: 'unknownId' };
  const s = advance(state, content, now);
  const n = maxAffordable(def, s.generators[id] ?? 0, s.tokens);
  if (n < 1) return { state: s, ok: false, reason: isGeneratorUnlocked(s, content, id) ? 'cantAfford' : 'locked' };
  return buy(s, content, id, n, now);
}

export function buyUpgrade(state: GarageState, content: GarageContent, id: string, now: number): ActionResult {
  const def = upgradeDef(content, id);
  if (!def) return { state, ok: false, reason: 'unknownId' };
  const s = at(state, content, now);
  if (s.upgrades.includes(id)) return { state: s, ok: false, reason: 'owned' };
  if (!isUpgradeAvailable(s, def)) return { state: s, ok: false, reason: 'locked' };
  if (s.tokens < def.cost) return { state: s, ok: false, reason: 'cantAfford' };
  s.tokens = amount(s.tokens - def.cost);
  s.upgrades = [...s.upgrades, id];
  s.stats.upgradesBought += 1;
  s.stats.genUpgrades += 1;
  checkAchievements(s, content);
  return { state: s, ok: true };
}

// ---------------------------------------------------------------------------------------
// Prestige

/** Tokens to earn in the current generation before generation `n` can ship. */
export function shipThreshold(content: GarageContent, n: number): number {
  const gens = content.generations;
  if (n < gens.length) return gens[Math.max(0, n)].shipAt;
  const last = gens[gens.length - 1].shipAt;
  return amount(last * Math.pow(content.prestige.endlessGrowth, n - (gens.length - 1)));
}

/** Hype a ship with `lifetime` tokens earned would give. */
export function hypeForLifetime(content: GarageContent, lifetime: number): number {
  const p = content.prestige;
  return Math.floor(amount(Math.pow(Math.max(0, lifetime) / p.scale, p.exponent)));
}

export interface ShipChoiceQuote {
  id: string;
  def: ShipChoiceDef;
  gain: number;
  bonusGain: number;
}

export interface PrestigePreview {
  canShip: boolean;
  /** Hype gained by shipping now (kept models and Safety staff included, no launch choice). */
  gain: number;
  /** The formula's Hype before the lab's modifiers. */
  baseGain: number;
  /** Gain with the prestige bonus offer. */
  bonusGain: number;
  /** Tokens needed this generation to ship. */
  needed: number;
  /** 0..1 towards `needed`. */
  progress: number;
  nextGeneration: number;
  /** Production multiplier from Hype now and after shipping. */
  multNow: number;
  multAfter: number;
  /** Each launch choice's gain (empty without ship-day content). */
  choices: ShipChoiceQuote[];
}

/** The lab's multiplier on ship Hype: kept models' shipHype and Safety staff's trust. */
export function shipHypeMult(state: GarageState, content: GarageContent): number {
  return factor(modelEffects(state, content).shipHype) * staffEffects(state, content).trust;
}

/** Hype for a ship: the base formula times the lab's modifiers, a launch choice and the ad bonus. */
export function shipGain(state: GarageState, content: GarageContent, base: number, choice?: ShipChoiceDef, bonus = false): number {
  if (base < 1) return 0;
  const raw = base * shipHypeMult(state, content) * (choice?.hypeMult ?? 1);
  const extra = bonus ? 1 + (offerDef(content, 'prestigeBonus')?.prestigeBonus ?? 0) : 1;
  return Math.max(1, bonus ? Math.ceil(raw * extra) : Math.floor(raw));
}

/** Tokens to earn in the current generation before the next model can ship, for this save (the Paradigm tree may lower it). */
export function shipNeeded(state: Pick<GarageState, 'generation' | 'paradigm'>, content: GarageContent): number {
  return amount(shipThreshold(content, state.generation + 1) * paradigmEffects(state, content).shipThreshold);
}

export function prestigePreview(state: GarageState, content: GarageContent): PrestigePreview {
  const needed = shipNeeded(state, content);
  const baseGain = hypeForLifetime(content, state.genLifetime);
  const gain = shipGain(state, content, baseGain);
  const per = content.prestige.hypePerPoint;
  const choices = (content.shipDay?.choices ?? []).map((def) => ({ id: def.id, def, gain: shipGain(state, content, baseGain, def), bonusGain: shipGain(state, content, baseGain, def, true) }));
  return {
    canShip: state.genLifetime >= needed && baseGain >= 1,
    gain,
    baseGain,
    choices,
    bonusGain: shipGain(state, content, baseGain, undefined, true),
    needed,
    progress: needed > 0 ? Math.min(1, state.genLifetime / needed) : 1,
    nextGeneration: state.generation + 1,
    multNow: 1 + state.hype * per,
    multAfter: 1 + (state.hype + gain) * per,
  };
}

/**
 * Ships the next model: tokens, generators and the upgrades without `keep` reset; Hype
 * and Lab Rep are gained. With `bonus`, the prestigeBonus offer is claimed as well (it
 * must be available).
 */
export function prestige(state: GarageState, content: GarageContent, now: number, opts: { bonus?: boolean; choice?: string } = {}): ActionResult {
  const s = at(state, content, now);
  const preview = prestigePreview(s, content);
  if (!preview.canShip) return { state: s, ok: false, reason: 'notReady' };
  const choice = opts.choice ? content.shipDay?.choices.find((c) => c.id === opts.choice) : undefined;
  if (opts.choice && !choice) return { state: s, ok: false, reason: 'unknownId' };
  if (opts.bonus) {
    const status = offerStatus(s, content, 'prestigeBonus', s.now);
    if (!status.available) return { state: s, ok: false, reason: status.reason };
    recordOffer(s, 'prestigeBonus');
  }
  const gain = shipGain(s, content, preview.baseGain, choice, !!opts.bonus);
  const next = s.generation + 1;
  if (s.stats.genUpgrades === 0) s.stats.shippedClean += 1;
  s.hype = amount(s.hype + gain);
  s.labRep += content.labRep.perShip + content.labRep.perGeneration * next + (choice?.labRep ?? 0);
  s.shipChoice = choice ? choice.id : null;
  if (choice?.trainingRuns && content.training && mechanicOn(s, content, 'training')) {
    s.training = { ...s.training, charges: s.training.charges + choice.trainingRuns };
    accrueTraining(s, content, s.now);
  }
  s.generation = next;
  s.tokens = 0;
  s.genLifetime = 0;
  s.generators = { ...paradigmEffects(s, content).startGenerators };
  s.upgrades = s.upgrades.filter((id) => upgradeDef(content, id)?.keep);
  s.incident = null;
  s.frenzy = null;
  s.combo = { count: 0, lastAt: s.combo.lastAt };
  s.stats.modelsShipped += 1;
  s.stats.genUpgrades = 0;
  s.stats.pureTaps = 0;
  s.lastShip = { generation: next, hypeGained: gain, at: s.now, ...(choice ? { choice: choice.id } : {}) };
  if (s.paradigm && next > s.paradigm.bestGeneration) s.paradigm = { ...s.paradigm, bestGeneration: next };
  const named = content.generations[next];
  pushNews(s, content, named ? named.headlineKey : content.endlessHeadlineKey, 'launch', s.now, { n: next + 1 });
  checkAchievements(s, content);
  return { state: s, ok: true };
}

/** The name key and params of a generation. */
export function generationName(content: GarageContent, n: number): { key: string; params: { n: number } } {
  const named = content.generations[n];
  return { key: named ? named.nameKey : content.endlessNameKey, params: { n: n + 1 } };
}

// ---------------------------------------------------------------------------------------
// Golden moments and incidents

export function collectGolden(state: GarageState, content: GarageContent, now: number): ActionResult {
  const s = at(state, content, now);
  const golden = s.golden;
  const def = golden ? content.golden.defs.find((d) => d.id === golden.id) : undefined;
  if (!golden || !def) return { state: s, ok: false, reason: 'none' };
  const m = multipliers(s, content);
  let gained = 0;
  const r = def.reward;
  if (r.kind === 'burst') {
    gained = grant(s, Math.max(totalRate(s, content, s.now) * r.seconds, tapValue(s, content, s.now, 1) * r.minTaps) * m.goldenMult);
  } else {
    const until = s.now + r.seconds * 1000 * m.goldenMult;
    const prev = s.frenzy && s.frenzy.until > s.now ? s.frenzy : null;
    s.frenzy = r.kind === 'frenzy' ? { mult: r.mult, tapMult: prev?.tapMult ?? 1, until: Math.max(until, prev?.until ?? 0) } : { mult: prev?.mult ?? 1, tapMult: r.mult, until: Math.max(until, prev?.until ?? 0) };
  }
  if (gained > 0) maybeOfferMultiply(s, content, gained, 'golden', golden.id, golden.x, golden.y);
  s.golden = null;
  s.stats.goldenCaught += 1;
  pushNews(s, content, def.textKey, 'golden', s.now);
  checkAchievements(s, content);
  return { state: s, ok: true, gained };
}

export function tapIncident(state: GarageState, content: GarageContent, now: number): ActionResult {
  const s = at(state, content, now);
  const inc = s.incident;
  const def = inc ? incidentDef(content, inc.id) : undefined;
  if (!inc || !def) return { state: s, ok: false, reason: 'none' };
  inc.taps += 1;
  if (inc.taps >= def.tapsToFix) fixIncident(s, content);
  checkAchievements(s, content);
  return { state: s, ok: true };
}

function fixIncident(s: GarageState, content: GarageContent): void {
  const inc = s.incident;
  if (!inc) return;
  const def = incidentDef(content, inc.id);
  const took = s.now - inc.startedAt;
  s.stats.incidentsFixed += 1;
  if (s.stats.fastestFixMs === 0 || took < s.stats.fastestFixMs) s.stats.fastestFixMs = Math.max(1, took);
  if (def) pushNews(s, content, def.fixKey, 'fixed', s.now, { tier: generatorDef(content, inc.generator)?.nameKey ?? inc.generator });
  s.incident = null;
}

// ---------------------------------------------------------------------------------------
// Offers (each backed by an opt-in rewarded ad in the UI)

export interface OfferStatus {
  available: boolean;
  reason?: GarageFailure;
  /** When a cooldown or the daily cap lifts (ms timestamp). */
  readyAt?: number;
  /** Uses left in the rolling 24 hours. */
  usesLeft: number;
}

function recentUses(s: GarageState, id: OfferId, now: number): number[] {
  return (s.offers[id] ?? []).filter((v) => v > now - DAY_MS && v <= now + 1);
}

function recordOffer(s: GarageState, id: OfferId): void {
  s.offers[id] = [...recentUses(s, id, s.now), s.now];
  s.stats.offersClaimed += 1;
}

export function offerStatus(state: GarageState, content: GarageContent, id: OfferId, now: number = state.now): OfferStatus {
  const def = offerDef(content, id);
  if (!def) return { available: false, reason: 'unknownId', usesLeft: 0 };
  const uses = recentUses(state, id, now);
  const usesLeft = Math.max(0, def.dailyCap - uses.length);
  if (usesLeft <= 0) return { available: false, reason: 'dailyCap', readyAt: Math.min(...uses) + DAY_MS, usesLeft };
  const last = uses.length ? Math.max(...uses) : -Infinity;
  if (last + def.cooldownMs > now) return { available: false, reason: 'cooldown', readyAt: last + def.cooldownMs, usesLeft };
  const applicable = (() => {
    switch (id) {
      case 'offlineDouble':
        return !!state.offline && !state.offline.doubled && state.offline.tokens > 0;
      case 'boost':
        return state.boostUntil - now < (def.boostCapMs ?? 0) - 60_000;
      case 'frenzyExtend':
        return !!state.frenzy && state.frenzy.until > now;
      case 'incidentFix':
        return !!state.incident && state.incident.until > now;
      case 'crate':
        return true;
      case 'prestigeBonus':
        return prestigePreview(state, content).canShip;
      case 'bonusMultiply':
        return !!state.bonusOffer && state.bonusOffer.until > now && state.bonusOffer.reward > 0;
    }
  })();
  return applicable ? { available: true, usesLeft } : { available: false, reason: 'notApplicable', usesLeft };
}

/** Tokens a crate opened now would give. */
export function crateValue(state: GarageState, content: GarageContent): number {
  const def = offerDef(content, 'crate');
  if (!def) return 0;
  return amount(Math.max(steadyRate(state, content) * (def.crateSeconds ?? 0), tapValue(state, content, state.now, 1) * (def.crateMinTaps ?? 0)));
}

/** Production per second with no frenzy, boost or incident: what offer rewards are measured in. */
function steadyRate(state: GarageState, content: GarageContent): number {
  return totalRate({ ...withoutRaceBoost(state), frenzy: null, boostUntil: 0, incident: null }, content, state.now);
}

/** Extra tokens the bonusMultiply offer would add to the bonus just tapped (0 without one). */
export function bonusMultiplyValue(state: GarageState, content: GarageContent): number {
  const def = offerDef(content, 'bonusMultiply');
  if (!def || !state.bonusOffer) return 0;
  return amount(Math.max(state.bonusOffer.reward * Math.max(0, (def.multiplyMult ?? 2) - 1), steadyRate(state, content) * (def.multiplyMinSeconds ?? 0)));
}

/** Tokens the incidentFix offer pays on top of the fix. */
export function incidentFixValue(state: GarageState, content: GarageContent): number {
  const def = offerDef(content, 'incidentFix');
  return def ? amount(steadyRate(state, content) * (def.fixSeconds ?? 0)) : 0;
}

/** Claims an offer's reward (the UI calls this after the ad, or straight away with ads removed). */
export function claimOffer(state: GarageState, content: GarageContent, id: OfferId, now: number, opts: { choice?: string } = {}): ActionResult {
  if (id === 'prestigeBonus') return prestige(state, content, now, { bonus: true, choice: opts.choice });
  const s = at(state, content, now);
  const def = offerDef(content, id);
  const status = offerStatus(s, content, id, s.now);
  if (!def || !status.available) return { state: s, ok: false, reason: status.reason };
  let gained = 0;
  switch (id) {
    case 'offlineDouble': {
      const report = s.offline!;
      gained = grant(s, report.tokens * ((def.offlineMult ?? 2) - 1));
      s.offline = { ...report, tokens: amount(report.tokens + gained), doubled: true };
      break;
    }
    case 'boost':
      s.boostUntil = Math.min(Math.max(s.now, s.boostUntil) + (def.boostMs ?? 0), s.now + (def.boostCapMs ?? 0));
      s.stats.boostsUsed += 1;
      break;
    case 'frenzyExtend':
      s.frenzy = { ...s.frenzy!, until: s.frenzy!.until + (def.extendMs ?? 0) };
      break;
    case 'incidentFix':
      gained = grant(s, incidentFixValue(s, content));
      fixIncident(s, content);
      break;
    case 'crate':
      gained = grant(s, crateValue(s, content));
      s.stats.cratesOpened += 1;
      break;
    case 'bonusMultiply':
      gained = grant(s, bonusMultiplyValue(s, content));
      s.bonusOffer = null;
      break;
  }
  recordOffer(s, id);
  checkAchievements(s, content);
  return { state: s, ok: true, gained };
}

/**
 * After a free bonus tap: with the offer's chance (and not in the first minutes of a save),
 * the reward can be multiplied by the bonusMultiply offer for a few seconds.
 */
export function maybeOfferMultiply(s: GarageState, content: GarageContent, reward: number, source: 'golden' | 'happening', id: string, x: number, y: number): void {
  const def = offerDef(content, 'bonusMultiply');
  s.bonusOffer = null;
  if (!def || !(reward > 0) || s.stats.playMs < (def.multiplyAfterMs ?? 0)) return;
  if (random(s) >= (def.multiplyChance ?? 0)) return;
  s.bonusOffer = { reward, until: s.now + (def.multiplyWindowMs ?? 6000), source, id, x, y };
}

/** Closes the "While you were away" report. */
export function dismissOffline(state: GarageState): GarageState {
  return state.offline ? { ...state, offline: null } : state;
}

// ---------------------------------------------------------------------------------------
// Achievements

function achieved(s: GarageState, content: GarageContent, rule: GarageContent['achievements'][number]['rule']): boolean {
  switch (rule.type) {
    case 'stat':
      return (s.stats[rule.stat] ?? 0) >= rule.gte;
    case 'owned':
      return (s.generators[rule.generator] ?? 0) >= rule.gte;
    case 'pureTaps':
      return s.stats.pureTaps >= rule.gte;
    case 'shipNoUpgrades':
      return s.stats.shippedClean > 0;
    case 'fastFix':
      return s.stats.fastestFixMs > 0 && s.stats.fastestFixMs <= rule.ms;
    case 'exactOwned':
      return content.generators.some((g) => s.generators[g.id] === rule.count);
  }
}

function checkAchievements(s: GarageState, content: GarageContent): void {
  updateStage(s, content);
  for (const a of content.achievements) {
    if (s.achievements.includes(a.id) || !achieved(s, content, a.rule)) continue;
    s.achievements = [...s.achievements, a.id];
    pushNews(s, content, content.news.achievementKey, 'achievement', s.now, { name: a.nameKey });
  }
}
