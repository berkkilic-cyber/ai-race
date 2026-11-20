/** Public pure reads over a GameState. Screens use these instead of computing rules themselves. */
import { checkAll } from './conditions';
import { getContext } from './context';
import { acquirePrice, dataCentrePrice, launchPrice, nodePrice, upgradePrice, type Price } from './costs';
import { capabilityOf, computeOf, isBannedAt, leadRivalOf, usersOf, worldShareOf } from './derived';
import { cashIncomeOf, hypeIncomeOf, upkeepOf } from './economy';
import { labModifierTable, statMultiplier } from './modifiers';
import type { Condition, ContentPack, GameState, LabState, Meters, Stat } from './types';
import { max } from './natives';

function labOrThrow(state: GameState, labId: string): LabState {
  const lab = state.labs[labId];
  if (!lab) throw new Error(`Unknown lab: ${labId}`);
  return lab;
}

export function getMeters(state: GameState, labId: string): Meters {
  const lab = labOrThrow(state, labId);
  let rival = 0;
  for (const id of state.labOrder) if (id !== labId && state.labs[id].active) rival = max(rival, state.labs[id].agiProgress);
  return { regulation: lab.regulation, backlash: lab.backlash, rival };
}

export function getCompute(state: GameState, pack: ContentPack, labId: string): number {
  return computeOf(labOrThrow(state, labId), getContext(pack), state.tick);
}

/** Effective model tier: highest owned capability level, capped by compute. */
export function getCapabilityLevel(state: GameState, pack: ContentPack, labId: string): number {
  return capabilityOf(labOrThrow(state, labId), getContext(pack), state.tick);
}

/** Users in millions. */
export function getUsers(state: GameState, pack: ContentPack, labId: string): number {
  return usersOf(labOrThrow(state, labId), getContext(pack));
}

/** Share of world population using the lab, 0..1. */
export function getWorldShare(state: GameState, pack: ContentPack, labId: string): number {
  return worldShareOf(labOrThrow(state, labId), getContext(pack));
}

/**
 * Expected income per tick at the current state: cash is net of upkeep, hype
 * counts only the base rate (new-user hype depends on next tick's growth).
 */
export function getIncome(state: GameState, pack: ContentPack, labId: string): { cash: number; hype: number } {
  const context = getContext(pack);
  const lab = labOrThrow(state, labId);
  const mods = labModifierTable(lab, context, state.tick);
  return {
    cash: cashIncomeOf(state, context, lab, mods) - upkeepOf(state, context, lab, mods),
    hype: hypeIncomeOf(context, mods, 0),
  };
}

export function getNodeCost(state: GameState, pack: ContentPack, labId: string, nodeId: string): Price {
  const context = getContext(pack);
  const node = context.nodes.get(nodeId);
  if (!node) throw new Error(`Unknown node: ${nodeId}`);
  return nodePrice(labOrThrow(state, labId), context, node, state.tick);
}

export function getDataCentreCost(state: GameState, pack: ContentPack, labId: string, regionId: string): number {
  const context = getContext(pack);
  const region = context.regions.get(regionId);
  if (!region) throw new Error(`Unknown region: ${regionId}`);
  return dataCentrePrice(labOrThrow(state, labId), context, region, state.tick);
}

export function getUpgradeCost(state: GameState, pack: ContentPack, labId: string, dataCentreId: string): number {
  const lab = labOrThrow(state, labId);
  const dc = lab.dataCentres.find((d) => d.id === dataCentreId);
  if (!dc) throw new Error(`Unknown data centre: ${dataCentreId}`);
  return upgradePrice(lab, getContext(pack), dc, state.tick);
}

export function getLaunchCost(state: GameState, pack: ContentPack, labId: string, regionId: string): number {
  const context = getContext(pack);
  const region = context.regions.get(regionId);
  if (!region) throw new Error(`Unknown region: ${regionId}`);
  return launchPrice(labOrThrow(state, labId), context, region, state.tick);
}

export function getAcquirePrice(state: GameState, pack: ContentPack, labId: string, targetLabId: string): number {
  return acquirePrice(labOrThrow(state, labId), labOrThrow(state, targetLabId), getContext(pack), state.tick);
}

/** Multiplier for a stat, (1 + Σadd) × Πmul; with a region, its tagged modifiers count too. */
export function getModifierTotal(state: GameState, pack: ContentPack, labId: string, stat: Stat, regionId?: string): number {
  const context = getContext(pack);
  const region = regionId === undefined ? undefined : context.regions.get(regionId);
  return statMultiplier(labModifierTable(labOrThrow(state, labId), context, state.tick), stat, region);
}

export function isBanned(state: GameState, labId: string, regionId: string): boolean {
  return isBannedAt(labOrThrow(state, labId), regionId, state.tick);
}

export function checkConditions(state: GameState, pack: ContentPack, labId: string, conditions: readonly Condition[]): boolean {
  return checkAll(state, getContext(pack), labOrThrow(state, labId), conditions);
}

/** The strongest other active lab (highest AGI progress), if any. */
export function getLeadRival(state: GameState, pack: ContentPack, labId: string): string | undefined {
  return leadRivalOf(state, getContext(pack), labId)?.id;
}
