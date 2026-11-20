import type { EngineContext } from './context';
import { computeOf, totalDataCentreLevels, usersOf } from './derived';
import { labModifierTable, statMultiplier, type ModifierTable } from './modifiers';
import type { DataCentre, LabState, NodeDef, RegionDef } from './types';

export interface Price {
  hype: number;
  cash: number;
}

export function nodePrice(lab: LabState, context: EngineContext, node: NodeDef, tick: number, mods?: ModifierTable): Price {
  const growth = 1 + context.balance.nodeCostGrowth * lab.ownedNodes.length;
  const mult = statMultiplier((mods ?? labModifierTable(lab, context, tick)), 'nodeCost') * growth;
  return { hype: node.cost * mult, cash: (node.cashCost ?? 0) * mult };
}

export function dataCentrePrice(lab: LabState, context: EngineContext, region: RegionDef, tick: number, mods?: ModifierTable): number {
  const { dataCentreBaseCost, dataCentreCountGrowth } = context.balance;
  const base = dataCentreBaseCost * (1 + dataCentreCountGrowth * lab.dataCentres.length);
  return base * statMultiplier((mods ?? labModifierTable(lab, context, tick)), 'dataCentreCost', region);
}

export function upgradePrice(lab: LabState, context: EngineContext, dataCentre: DataCentre, tick: number, mods?: ModifierTable): number {
  const { dataCentreUpgradeCost, dataCentreUpgradeGrowth } = context.balance;
  const base = dataCentreUpgradeCost * dataCentre.level * (1 + dataCentreUpgradeGrowth * totalDataCentreLevels(lab));
  return base * statMultiplier((mods ?? labModifierTable(lab, context, tick)), 'dataCentreCost', context.regions.get(dataCentre.regionId));
}

export function launchPrice(lab: LabState, context: EngineContext, region: RegionDef, tick: number, mods?: ModifierTable): number {
  const { launchBaseCost, launchCostPerMillion } = context.balance;
  const base = launchBaseCost + launchCostPerMillion * region.population * (0.5 + region.wealth);
  return base * statMultiplier((mods ?? labModifierTable(lab, context, tick)), 'launchCost', region);
}

export function acquirePrice(buyer: LabState, target: LabState, context: EngineContext, tick: number, mods?: ModifierTable): number {
  const { acquireBaseCost, acquirePerUser, acquirePerCompute, acquirePerAgi } = context.balance;
  const base =
    acquireBaseCost +
    acquirePerUser * usersOf(target, context) +
    acquirePerCompute * computeOf(target, context, tick) +
    acquirePerAgi * target.agiProgress;
  return base * statMultiplier((mods ?? labModifierTable(buyer, context, tick)), 'acquireCost');
}
