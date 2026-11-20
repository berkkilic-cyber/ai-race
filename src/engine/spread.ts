import type { EngineContext } from './context';
import { regionMultipliers, statMultiplier, type ModifierTable } from './modifiers';
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
  /** spreadRate multiplier per region index (shared, read-only). */
  spreadMult: Float64Array;
}

/** New users gained by a lab this tick. */
export interface GrowthTally {
  /** Millions of new users. */
  total: number;
  /** Σ new users × region strictness × regional regulationGain multiplier. */
  strictWeighted: number;
}

/** The spreadRate multiplier of every region (by index), cached per modifier table. */
export function spreadMultipliersOf(mods: ModifierTable, context: EngineContext): Float64Array {
  return regionMultipliers(mods, 'spreadRate', context.pack.regions);
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
  /** Other labs with arrays: their info (undefined when inactive, i.e. appeal 0). */
  others: { arrays: LabArrays; info: LabTickInfo | undefined }[];
  /** regulationGain and seedChance multipliers per region. */
  regulationMult: Float64Array;
  seedMult: Float64Array;
}

function tallyGrowth(run: SpreadRun, index: number, region: RegionDef, adoptionGained: number): void {
  if (adoptionGained <= 0) return;
  const users = adoptionGained * region.population;
  run.tally.total += users;
  run.tally.strictWeighted += users * region.strictness * run.regulationMult[index];
}

/** In a full region a more appealing lab slowly takes share from less appealing ones. Returns adoption gained. */
function stealShare(run: SpreadRun, index: number, appeal: number): number {
  const { context, ws, arrays } = run;
  if (appeal <= 0) return 0;
  let gained = 0;
  for (const { arrays: other, info: otherInfo } of run.others) {
    const otherAdoption = other.adoption[index];
    if (otherAdoption <= 0) continue;
    const otherAppeal = otherInfo ? otherInfo.baseAppeal * otherInfo.spreadMult[index] : 0;
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
  const appeal = run.info.baseAppeal * run.info.spreadMult[index];
  const free = freeShareAt(ws, index);
  const added = min(free, context.balance.baseSpread * appeal * region.openness * adoption * free);
  if (added > 0) setAdoptionAt(ws, arrays, index, adoption + added, context.balance.minAdoption);
  const stolen = free - added < context.balance.stealFreeThreshold ? stealShare(run, index, appeal) : 0;
  return added + stolen;
}

/** Each absent, unbanned neighbour of region `index` may be seeded. */
function seedFrom(run: SpreadRun, index: number): void {
  const { state, context, ws, arrays } = run;
  const { seedChance, seedAmount, minAdoption } = context.balance;
  for (const n of context.neighbourIndices[index]) {
    if (arrays.adoption[n] > 0 || arrays.banned[n]) continue;
    const neighbour = context.pack.regions[n];
    const chance = seedChance * neighbour.openness * run.seedMult[n];
    if (random(state) >= chance) continue;
    const added = min(seedAmount, freeShareAt(ws, n));
    if (added < minAdoption) continue;
    setAdoptionAt(ws, arrays, n, added, minAdoption);
    ws.fresh[n] = 1;
    tallyGrowth(run, n, neighbour, added);
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
  const regions = context.pack.regions;
  // Reuses the workspace's scratch list so the tick loop does not allocate.
  const others = ws.others as SpreadRun['others'];
  let count = 0;
  for (const otherId of state.labOrder) {
    const otherArrays = otherId === lab.id ? undefined : ws.labs.get(otherId);
    if (!otherArrays) continue;
    const info = state.labs[otherId].active ? infos.get(otherId) : undefined;
    const slot = others[count];
    if (slot) {
      slot.arrays = otherArrays;
      slot.info = info;
    } else {
      others.push({ arrays: otherArrays, info });
    }
    count++;
  }
  others.length = count;
  const run: SpreadRun = {
    state,
    context,
    ws,
    lab,
    arrays,
    info,
    infos,
    tally,
    others,
    regulationMult: regionMultipliers(info.mods, 'regulationGain', regions),
    seedMult: regionMultipliers(info.mods, 'seedChance', regions),
  };
  const { banDecayRate, seedThreshold, minAdoption } = context.balance;
  ws.fresh.fill(0);
  for (let i = 0; i < regions.length; i++) {
    if (arrays.adoption[i] <= 0 || ws.fresh[i]) continue;
    if (arrays.banned[i]) {
      setAdoptionAt(ws, arrays, i, arrays.adoption[i] * (1 - banDecayRate), minAdoption);
      continue;
    }
    tallyGrowth(run, i, regions[i], growIn(run, i, regions[i]));
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
