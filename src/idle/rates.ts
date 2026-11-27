/**
 * Pure reads of the economy: multipliers, rates, tap value and prices. No state changes.
 */
import { factor, milestoneMult, modelEffects, staffEffects } from './labRates';
import { amount } from './num';
import { comboWindowMs, paradigmEffects, paradigmMultiplier } from './paradigmRates';
import type { GarageContent, GarageState, GeneratorDef, GeneratorId, OfferDef, OfferId, UpgradeDef, UpgradeEffect } from './types';

export const HOUR_MS = 3_600_000;

export interface Multipliers {
  tap: number;
  tapFromRate: number;
  global: number;
  generator: Record<GeneratorId, number>;
  /** Share of all generator output gained per unit owned, by tier (crew bonuses). */
  crew: Record<GeneratorId, number>;
  offlineCapMs: number;
  offlineRate: number;
  comboStacks: number;
  goldenMult: number;
  goldenInterval: number;
}

const upgradeIndex = new WeakMap<GarageContent, Map<string, UpgradeDef>>();
const generatorIndex = new WeakMap<GarageContent, Map<string, GeneratorDef>>();

export function upgradeDef(content: GarageContent, id: string): UpgradeDef | undefined {
  let map = upgradeIndex.get(content);
  if (!map) {
    map = new Map(content.upgrades.map((u) => [u.id, u]));
    upgradeIndex.set(content, map);
  }
  return map.get(id);
}

export function generatorDef(content: GarageContent, id: string): GeneratorDef | undefined {
  let map = generatorIndex.get(content);
  if (!map) {
    map = new Map(content.generators.map((g) => [g.id, g]));
    generatorIndex.set(content, map);
  }
  return map.get(id);
}

export function offerDef(content: GarageContent, id: OfferId): OfferDef | undefined {
  return content.offers.find((o) => o.id === id);
}

/** Every effect in force: owned upgrades plus the perks of each generation reached. */
export function activeEffects(state: Pick<GarageState, 'upgrades' | 'generation'>, content: GarageContent): UpgradeEffect[] {
  const out: UpgradeEffect[] = [];
  for (const id of state.upgrades) {
    const def = upgradeDef(content, id);
    if (def) out.push(...def.effects);
  }
  const reached = Math.min(state.generation, content.generations.length - 1);
  for (let g = 0; g <= reached; g++) out.push(...(content.generations[g]?.perks ?? []));
  return out;
}

const cache = new WeakMap<readonly string[], { generation: number; content: GarageContent; m: Multipliers }>();

export function multipliers(state: Pick<GarageState, 'upgrades' | 'generation'>, content: GarageContent): Multipliers {
  const hit = cache.get(state.upgrades);
  if (hit && hit.generation === state.generation && hit.content === content) return hit.m;
  const m: Multipliers = {
    tap: 1,
    tapFromRate: 0,
    global: 1,
    generator: {},
    crew: {},
    offlineCapMs: content.offline.capHours * HOUR_MS,
    offlineRate: content.offline.rate,
    comboStacks: content.tap.comboMaxStacks,
    goldenMult: 1,
    goldenInterval: 1,
  };
  for (const e of activeEffects(state, content)) {
    switch (e.kind) {
      case 'tapMult':
        m.tap *= e.mult;
        break;
      case 'tapFromRate':
        m.tapFromRate += e.share;
        break;
      case 'globalMult':
        m.global *= e.mult;
        break;
      case 'generatorMult':
        m.generator[e.generator] = (m.generator[e.generator] ?? 1) * e.mult;
        break;
      case 'crewBonus':
        m.crew[e.generator] = (m.crew[e.generator] ?? 0) + e.add;
        break;
      case 'offlineCap':
        m.offlineCapMs += e.hours * HOUR_MS;
        break;
      case 'offlineRate':
        m.offlineRate = Math.min(1, m.offlineRate + e.add);
        break;
      case 'comboStacks':
        m.comboStacks += e.add;
        break;
      case 'goldenMult':
        m.goldenMult *= e.mult;
        break;
      case 'goldenInterval':
        m.goldenInterval *= e.mult;
        break;
    }
  }
  cache.set(state.upgrades, { generation: state.generation, content, m });
  return m;
}

/** Production multiplier from Hype. */
export function hypeMultiplier(state: Pick<GarageState, 'hype'>, content: GarageContent): number {
  return 1 + Math.max(0, state.hype) * content.prestige.hypePerPoint;
}

/** Generator output multiplier from crew bonuses: 1 + the sum over tiers of (share per unit × units owned). */
export function crewMultiplier(state: Pick<GarageState, 'upgrades' | 'generation' | 'generators'>, content: GarageContent): number {
  const crew = multipliers(state, content).crew;
  let add = 0;
  for (const id in crew) add += (crew[id] ?? 0) * Math.max(0, state.generators[id] ?? 0);
  return Number.isFinite(add) ? 1 + add : 1;
}

/** The state without the race's blueprints boost (for "calm" rates that leave timed effects out). */
export function withoutRaceBoost(state: GarageState): GarageState {
  return state.race && state.race.boostUntil > 0 ? { ...state, race: { ...state.race, boostFrom: 0, boostUntil: 0 } } : state;
}

/** Multiplier from timed effects (ad boost, golden frenzy, race blueprints) at time `at`. */
export function timedMultiplier(state: GarageState, content: GarageContent, at: number): number {
  let m = 1;
  if (at < state.boostUntil) m *= offerDef(content, 'boost')?.boostMult ?? 1;
  if (state.race && at >= state.race.boostFrom && at < state.race.boostUntil) m *= content.raceReward?.boostMult ?? 1;
  if (state.frenzy && at < state.frenzy.until) m *= state.frenzy.mult;
  return m;
}

/** Tokens per second of one generator tier at time `at` (incidents included). */
export function generatorRate(state: GarageState, content: GarageContent, id: GeneratorId, at: number = state.now): number {
  const def = generatorDef(content, id);
  const count = state.generators[id] ?? 0;
  if (!def || count <= 0) return 0;
  const m = multipliers(state, content);
  let r = count * def.baseRate * (m.generator[id] ?? 1) * m.global * hypeMultiplier(state, content) * timedMultiplier(state, content, at);
  r *= milestoneMult(content, count) * labProductionMult(state, content) * paradigmMultiplier(state, content) * crewMultiplier(state, content);
  const inc = state.incident;
  if (inc && inc.generator === id && at < inc.until) {
    const idef = incidentDef(content, inc.id);
    if (idef) r *= incidentSeverityMult(state, content, idef.mult);
  }
  return amount(r);
}

/** Generator output multiplier from kept models and Product staff. */
export function labProductionMult(state: Pick<GarageState, 'models' | 'staff' | 'stage'>, content: GarageContent): number {
  return factor(modelEffects(state, content).production) * staffEffects(state, content).production;
}

/** A hit tier's rate multiplier during an incident, after Safety staff (base `mult` in 0..1). */
export function incidentSeverityMult(state: Pick<GarageState, 'staff' | 'stage'>, content: GarageContent, mult: number): number {
  const loss = (1 - mult) * staffEffects(state, content).severity;
  return Math.max(0, Math.min(1, 1 - loss));
}

/** Incident frequency multiplier: Safety staff, kept models and the last launch choice. */
export function incidentFrequency(state: Pick<GarageState, 'models' | 'staff' | 'stage' | 'shipChoice'>, content: GarageContent): number {
  const choice = state.shipChoice ? content.shipDay?.choices.find((c) => c.id === state.shipChoice) : undefined;
  return Math.max(0.1, staffEffects(state, content).incidentFreq * factor(modelEffects(state, content).incident, 0.2) * (choice?.incidentMult ?? 1));
}

/** Hours of away storage from Lab Rep perks (`awayHours`) at this Lab Rep. */
export function perkAwayHours(state: Pick<GarageState, 'labRep'>, content: GarageContent): number {
  let h = 0;
  const rep = Number.isFinite(state.labRep) ? state.labRep : 0;
  for (const p of content.labRep.perks) if (p.effect.kind === 'awayHours' && rep >= p.rep && Number.isFinite(p.effect.amount)) h += p.effect.amount;
  return h;
}

type OfflineInputs = Pick<GarageState, 'upgrades' | 'generation' | 'models'> & Partial<Pick<GarageState, 'labRep' | 'paidStorage' | 'paradigm'>>;

/**
 * Offline cap ("away storage", ms) and rate: the base, upgrades and generation perks, kept
 * models, Lab Rep perks, and the reserved paid extension (a floor at offline.paidCapHours).
 */
export function offlineTerms(state: OfflineInputs, content: GarageContent): { capMs: number; rate: number } {
  const m = multipliers(state, content);
  const e = modelEffects(state, content);
  const perks = perkAwayHours({ labRep: state.labRep ?? 0 }, content);
  const pe = paradigmEffects({ paradigm: state.paradigm }, content);
  let capMs = Math.max(HOUR_MS / 2, m.offlineCapMs + (e.offlineCap + perks + pe.awayHours) * HOUR_MS);
  if (state.paidStorage && content.offline.paidCapHours) capMs = Math.max(capMs, content.offline.paidCapHours * HOUR_MS);
  return { capMs, rate: Math.max(0.05, Math.min(1, m.offlineRate + e.offlineRate + pe.offlineRate)) };
}

/** Training speed multiplier: Research staff and kept models. */
export function trainingSpeed(state: Pick<GarageState, 'models' | 'staff' | 'stage'>, content: GarageContent): number {
  return Math.max(0.1, staffEffects(state, content).trainingSpeed * factor(modelEffects(state, content).trainingSpeed, 0.2));
}

export function incidentDef(content: GarageContent, id: string) {
  return content.incidents.defs.find((d) => d.id === id);
}

/** Tokens per second, all tiers, at time `at`. */
export function totalRate(state: GarageState, content: GarageContent, at: number = state.now): number {
  let r = 0;
  for (const g of content.generators) r += generatorRate(state, content, g.id, at);
  return amount(r);
}

/** Tokens per second without timed effects or incidents (what the economy is "worth"). */
export function baseRate(state: GarageState, content: GarageContent): number {
  const calm: GarageState = { ...withoutRaceBoost(state), boostUntil: 0, frenzy: null, incident: null };
  return totalRate(calm, content, state.now);
}

/** Combo multiplier for a combo count. */
export function comboMultiplier(state: Pick<GarageState, 'upgrades' | 'generation'>, content: GarageContent, count: number): number {
  const m = multipliers(state, content);
  const stacks = Math.min(Math.floor(Math.max(0, count) / content.tap.comboStep), m.comboStacks);
  return 1 + stacks * content.tap.comboStackBonus;
}

/** The combo count a tap at `at` would reach. */
export function comboAfterTap(state: GarageState, content: GarageContent, at: number): number {
  return at - state.combo.lastAt <= comboWindowMs(state, content) && state.combo.count > 0 ? state.combo.count + 1 : 1;
}

/** The combo count as it stands at `at` (0 once the window has passed). */
export function comboAt(state: GarageState, content: GarageContent, at: number): number {
  return at - state.combo.lastAt <= comboWindowMs(state, content) ? state.combo.count : 0;
}

/** Tokens a tap at `at` with combo `count` produces. */
export function tapValue(state: GarageState, content: GarageContent, at: number = state.now, count: number = comboAfterTap(state, content, at)): number {
  const m = multipliers(state, content);
  const base = content.tap.base * m.tap * m.global * hypeMultiplier(state, content) * timedMultiplier(state, content, at) * factor(modelEffects(state, content).tap) * paradigmMultiplier(state, content) * paradigmEffects(state, content).tapMult;
  const fromRate = m.tapFromRate * totalRate(state, content, at);
  const frenzyTap = state.frenzy && at < state.frenzy.until ? state.frenzy.tapMult : 1;
  return amount((base + fromRate) * comboMultiplier(state, content, count) * frenzyTap);
}

// ---------------------------------------------------------------------------------------
// Prices

/** Price of the next one when `owned` are owned. */
export function unitCost(def: GeneratorDef, owned: number): number {
  return amount(def.baseCost * Math.pow(def.costGrowth, owned));
}

/** Price of `n` more when `owned` are owned (closed-form geometric sum). */
export function bulkCost(def: GeneratorDef, owned: number, n: number): number {
  if (n <= 0) return 0;
  const g = def.costGrowth;
  return amount((def.baseCost * Math.pow(g, owned) * (Math.pow(g, n) - 1)) / (g - 1));
}

/** How many more can be bought with `tokens`. */
export function maxAffordable(def: GeneratorDef, owned: number, tokens: number): number {
  const first = unitCost(def, owned);
  if (!(tokens >= first) || first <= 0) return 0;
  const g = def.costGrowth;
  let n = Math.floor(Math.log((tokens * (g - 1)) / first + 1) / Math.log(g));
  if (!Number.isFinite(n) || n < 0) n = 0;
  // Correct a rounding step either way.
  while (n > 0 && bulkCost(def, owned, n) > tokens) n--;
  while (bulkCost(def, owned, n + 1) <= tokens && n < 1e6) n++;
  return n;
}
