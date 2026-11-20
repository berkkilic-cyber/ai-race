import type { EngineContext } from './context';
import { statMultiplier, type ModifierTable } from './modifiers';
import { random } from './rng';
import type { GameState, LabState, RegionDef } from './types';
import { freeShareAt, setAdoptionAt, type LabArrays, type Workspace } from './workspace';
import { max, min } from './natives';

/** Per-tick facts about a lab, computed once at the start of its update. */
export interface LabTickInfo {
  mods: ModifierTable;
  compute: number;
  capability: number;
  /** Appeal before the regional spreadRate multiplier. */
  baseAppeal: number;
}

/** New users gained by a lab this tick. */
export interface GrowthTally {
  /** Millions of new users. */
  total: number;
  /** Σ new users × region strictness × regional regulationGain multiplier. */
  strictWeighted: number;
}

/** (1 + appealPerCapability × capability) × (1 − backlash / backlashAppealDivisor), without the spreadRate stat. */
export function baseAppealOf(lab: LabState, capability: number, context: EngineContext): number {
  const { appealPerCapability, backlashAppealDivisor } = context.balance;
  const backlashFactor = backlashAppealDivisor > 0 ? max(0, 1 - lab.backlash / backlashAppealDivisor) : 1;
  return (1 + appealPerCapability * capability) * backlashFactor;
}

export function appealOf(info: LabTickInfo, region: RegionDef): number {
  return info.baseAppeal * statMultiplier(info.mods, 'spreadRate', region);
}

/** Everything one lab's spread step needs. */
interface SpreadRun {
  state: GameState;
  context: EngineContext;
  ws: Workspace;
  lab: LabState;
  arrays: LabArrays;
  info: LabTickInfo;
  infos: ReadonlyMap<string, LabTickInfo>;
  tally: GrowthTally;
}

function tallyGrowth(run: SpreadRun, region: RegionDef, adoptionGained: number): void {
  if (adoptionGained <= 0) return;
  const users = adoptionGained * region.population;
  run.tally.total += users;
  run.tally.strictWeighted += users * region.strictness * statMultiplier(run.info.mods, 'regulationGain', region);
}

/** In a full region a more appealing lab slowly takes share from less appealing ones. Returns adoption gained. */
function stealShare(run: SpreadRun, index: number, region: RegionDef, appeal: number): number {
  const { state, context, ws, arrays } = run;
  if (appeal <= 0) return 0;
  let gained = 0;
  for (const otherId of state.labOrder) {
    if (otherId === run.lab.id) continue;
    const other = ws.labs.get(otherId);
    const otherAdoption = other ? other.adoption[index] : 0;
    if (!other || otherAdoption <= 0) continue;
    const otherInfo = run.infos.get(otherId);
    const otherAppeal = otherInfo && state.labs[otherId].active ? appealOf(otherInfo, region) : 0;
    if (otherAppeal >= appeal) continue;
    const taken = min(otherAdoption, context.balance.stealRate * arrays.adoption[index] * otherAdoption * (1 - otherAppeal / appeal));
    setAdoptionAt(ws, other, index, otherAdoption - taken, context.balance.minAdoption);
    setAdoptionAt(ws, arrays, index, arrays.adoption[index] + taken, context.balance.minAdoption);
    gained += taken;
  }
  return gained;
}

/** Logistic growth in one region (plus stealing when it is nearly full). Returns adoption gained. */
function growIn(run: SpreadRun, index: number, region: RegionDef): number {
  const { context, ws, arrays } = run;
  const adoption = arrays.adoption[index];
  const appeal = appealOf(run.info, region);
  const free = freeShareAt(ws, index);
  const added = min(free, context.balance.baseSpread * appeal * region.openness * adoption * free);
  if (added > 0) setAdoptionAt(ws, arrays, index, adoption + added, context.balance.minAdoption);
  const stolen = free - added < context.balance.stealFreeThreshold ? stealShare(run, index, region, appeal) : 0;
  return added + stolen;
}

/** Each absent, unbanned neighbour of region `index` may be seeded. */
function seedFrom(run: SpreadRun, index: number): void {
  const { state, context, ws, arrays } = run;
  const { seedChance, seedAmount, minAdoption } = context.balance;
  for (const n of context.neighbourIndices[index]) {
    if (arrays.adoption[n] > 0 || arrays.banned[n]) continue;
    const neighbour = context.pack.regions[n];
    const chance = seedChance * neighbour.openness * statMultiplier(run.info.mods, 'seedChance', neighbour);
    if (random(state) >= chance) continue;
    const added = min(seedAmount, freeShareAt(ws, n));
    if (added < minAdoption) continue;
    setAdoptionAt(ws, arrays, n, added, minAdoption);
    ws.fresh[n] = 1;
    tallyGrowth(run, neighbour, added);
  }
}

/**
 * Spread and seeding for one lab. In every region where it is present: banned → adoption
 * decays; otherwise logistic growth, then a region at or above seedThreshold may seed its
 * neighbours. Regions seeded this tick start growing next tick.
 */
export function spreadLab(
  state: GameState,
  context: EngineContext,
  ws: Workspace,
  lab: LabState,
  info: LabTickInfo,
  infos: ReadonlyMap<string, LabTickInfo>,
): GrowthTally {
  const arrays = ws.labs.get(lab.id);
  const tally: GrowthTally = { total: 0, strictWeighted: 0 };
  if (!arrays) return tally;
  const run: SpreadRun = { state, context, ws, lab, arrays, info, infos, tally };
  const { banDecayRate, seedThreshold, minAdoption } = context.balance;
  const regions = context.pack.regions;
  ws.fresh.fill(0);
  for (let i = 0; i < regions.length; i++) {
    if (arrays.adoption[i] <= 0 || ws.fresh[i]) continue;
    if (arrays.banned[i]) {
      setAdoptionAt(ws, arrays, i, arrays.adoption[i] * (1 - banDecayRate), minAdoption);
      continue;
    }
    tallyGrowth(run, regions[i], growIn(run, i, regions[i]));
    if (arrays.adoption[i] >= seedThreshold) seedFrom(run, i);
  }
  return tally;
}

/** An eliminated lab's adoption fades away over a few ticks. */
export function decayEliminated(context: EngineContext, ws: Workspace, labId: string): void {
  const arrays = ws.labs.get(labId);
  if (!arrays) return;
  const { eliminatedDecayRate, minAdoption } = context.balance;
  for (let i = 0; i < arrays.adoption.length; i++) {
    if (arrays.adoption[i] > 0) setAdoptionAt(ws, arrays, i, arrays.adoption[i] * (1 - eliminatedDecayRate), minAdoption);
  }
}
