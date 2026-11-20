/** Internal derived values shared by the simulation, actions and selectors. */
import type { BalanceConfig } from './balance';
import type { EngineContext } from './context';
import { labModifierTable, statMultiplier, type ModifierTable } from './modifiers';
import type { DataCentre, GameState, LabState, RegionId } from './types';
import { INFINITY, floor, max, min, pow } from './natives';

export function isOnline(dataCentre: DataCentre, tick: number): boolean {
  return dataCentre.disabledUntilTick === undefined || dataCentre.disabledUntilTick <= tick;
}

export function isBannedAt(lab: LabState, regionId: RegionId, tick: number): boolean {
  const until = lab.bans[regionId];
  return until !== undefined && (until === -1 || until > tick);
}

export function adoptionIn(lab: LabState, regionId: RegionId): number {
  return lab.adoption[regionId] ?? 0;
}

export function isPresent(lab: LabState, regionId: RegionId): boolean {
  return adoptionIn(lab, regionId) > 0;
}

/** Sum of every lab's adoption in a region (≤ 1). */
export function totalAdoption(state: GameState, regionId: RegionId): number {
  let total = 0;
  for (const id of state.labOrder) total += adoptionIn(state.labs[id], regionId);
  return total;
}

export function freeShare(state: GameState, regionId: RegionId): number {
  return max(0, 1 - totalAdoption(state, regionId));
}

export function computeOf(lab: LabState, context: EngineContext, tick: number, table?: ModifierTable): number {
  const mods = table ?? labModifierTable(lab, context, tick);
  let compute = 0;
  for (const dc of lab.dataCentres) {
    if (!isOnline(dc, tick)) continue;
    compute += dc.level * context.balance.computePerLevel * statMultiplier(mods, 'computeCapacity', context.regions.get(dc.regionId));
  }
  return max(0, compute + lab.computeBonus);
}

/** Highest capability level that `compute` supports. */
export function capabilityCapFor(compute: number, balance: BalanceConfig): number {
  const { computePerCapabilityLevel, capabilityComputeExponent } = balance;
  if (computePerCapabilityLevel <= 0) return INFINITY;
  if (compute < computePerCapabilityLevel || capabilityComputeExponent <= 0) return compute < computePerCapabilityLevel ? 0 : INFINITY;
  let level = floor(pow(compute / computePerCapabilityLevel, 1 / capabilityComputeExponent));
  // Correct floating-point drift at exact boundaries.
  while (computeForCapability(level + 1, balance) <= compute + 1e-9) level++;
  while (level > 0 && computeForCapability(level, balance) > compute + 1e-9) level--;
  return level;
}

/** capabilityCapFor memoised per pack (compute takes few distinct values). */
export function cachedCapabilityCap(compute: number, context: EngineContext): number {
  const memo = context.capabilityCapMemo;
  let level = memo.get(compute);
  if (level === undefined) {
    if (memo.size > 4096) memo.clear();
    level = capabilityCapFor(compute, context.balance);
    memo.set(compute, level);
  }
  return level;
}

/** Compute needed to run capability `level`. */
export function computeForCapability(level: number, balance: BalanceConfig): number {
  return level <= 0 ? 0 : balance.computePerCapabilityLevel * pow(level, balance.capabilityComputeExponent);
}

const ownedCapabilityCache = new WeakMap<LabState['ownedNodes'], { context: EngineContext; count: number; level: number }>();

/** Highest capabilityLevel among owned nodes (cached: the engine only appends to ownedNodes). */
export function ownedCapability(lab: LabState, context: EngineContext): number {
  const cached = ownedCapabilityCache.get(lab.ownedNodes);
  if (cached && cached.context === context && cached.count === lab.ownedNodes.length) return cached.level;
  let level = 0;
  for (const nodeId of lab.ownedNodes) level = max(level, context.nodes.get(nodeId)?.capabilityLevel ?? 0);
  ownedCapabilityCache.set(lab.ownedNodes, { context, count: lab.ownedNodes.length, level });
  return level;
}

export function capabilityOf(lab: LabState, context: EngineContext, tick: number, table?: ModifierTable): number {
  return min(ownedCapability(lab, context), cachedCapabilityCap(computeOf(lab, context, tick, table), context));
}

/** Users in millions. */
export function usersOf(lab: LabState, context: EngineContext): number {
  let users = 0;
  for (const regionId in lab.adoption) users += lab.adoption[regionId] * (context.regions.get(regionId)?.population ?? 0);
  return users;
}

export function worldShareOf(lab: LabState, context: EngineContext): number {
  return context.worldPopulation > 0 ? usersOf(lab, context) / context.worldPopulation : 0;
}

export function hasLabFlag(lab: LabState, context: EngineContext, flag: string): boolean {
  if (lab.flags.includes(flag)) return true;
  return lab.ownedNodes.some((nodeId) => context.nodes.get(nodeId)?.grantsFlags?.includes(flag) ?? false);
}

export function totalDataCentreLevels(lab: LabState, onlineAt?: number): number {
  let levels = 0;
  for (const dc of lab.dataCentres) if (onlineAt === undefined || isOnline(dc, onlineAt)) levels += dc.level;
  return levels;
}

/** Active labs other than `labId`, in lab order. */
export function otherActiveLabs(state: GameState, labId: string): LabState[] {
  return state.labOrder.filter((id) => id !== labId && state.labs[id].active).map((id) => state.labs[id]);
}

/** The strongest other active lab: highest AGI progress, then users, then lab order. */
export function leadRivalOf(state: GameState, context: EngineContext, labId: string): LabState | undefined {
  let best: LabState | undefined;
  let bestUsers = -1;
  for (const lab of otherActiveLabs(state, labId)) {
    const users = usersOf(lab, context);
    if (!best || lab.agiProgress > best.agiProgress || (lab.agiProgress === best.agiProgress && users > bestUsers)) {
      best = lab;
      bestUsers = users;
    }
  }
  return best;
}

export function clamp(value: number, low: number, high: number): number {
  return value < low ? low : value > high ? high : value;
}
