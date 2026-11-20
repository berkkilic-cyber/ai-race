import type { EngineContext } from './context';
import { isBannedAt, isOnline } from './derived';
import { statMultiplier, type ModifierTable } from './modifiers';
import { ENGINE_NEWS_KEYS, pushNews } from './news';
import type { GrowthTally, LabTickInfo } from './spread';
import type { DataCentre, GameState, LabState, RegionDef } from './types';
import type { LabArrays } from './workspace';
import { max } from './natives';

function regionCashIncome(region: RegionDef, adoption: number, mods: ModifierTable, context: EngineContext): number {
  return adoption * region.population * region.wealth * context.balance.cashPerUser * statMultiplier(mods, 'cashIncome', region);
}

/** Gross cash income per tick from users in unbanned regions. */
export function cashIncomeOf(state: GameState, context: EngineContext, lab: LabState, mods: ModifierTable): number {
  let income = 0;
  for (const regionId in lab.adoption) {
    const region = context.regions.get(regionId);
    if (region && !isBannedAt(lab, regionId, state.tick)) income += regionCashIncome(region, lab.adoption[regionId], mods, context);
  }
  return income;
}

/** cashIncomeOf from the tick's adoption arrays. */
function cashIncomeFromArrays(arrays: LabArrays, context: EngineContext, mods: ModifierTable): number {
  const regions = context.pack.regions;
  let income = 0;
  for (let i = 0; i < regions.length; i++) {
    if (arrays.adoption[i] > 0 && !arrays.banned[i]) income += regionCashIncome(regions[i], arrays.adoption[i], mods, context);
  }
  return income;
}

export function dataCentreUpkeepOf(dataCentre: DataCentre, context: EngineContext, mods: ModifierTable): number {
  const region = context.regions.get(dataCentre.regionId);
  if (!region) return 0;
  return dataCentre.level * region.powerCost * context.balance.dataCentreUpkeep * statMultiplier(mods, 'dataCentreUpkeep', region);
}

export function upkeepOf(state: GameState, context: EngineContext, lab: LabState, mods: ModifierTable): number {
  let upkeep = 0;
  for (const dc of lab.dataCentres) if (isOnline(dc, state.tick)) upkeep += dataCentreUpkeepOf(dc, context, mods);
  return upkeep;
}

export function hypeIncomeOf(context: EngineContext, mods: ModifierTable, newUsersTotal: number): number {
  const { hypeBase, hypePerNewUser } = context.balance;
  return (hypeBase + hypePerNewUser * newUsersTotal) * statMultiplier(mods, 'hypeIncome');
}

function costliestOnline(state: GameState, context: EngineContext, lab: LabState, mods: ModifierTable): DataCentre | undefined {
  let worst: DataCentre | undefined;
  let worstUpkeep = -1;
  for (const dc of lab.dataCentres) {
    if (!isOnline(dc, state.tick)) continue;
    const upkeep = dataCentreUpkeepOf(dc, context, mods);
    if (upkeep > worstUpkeep) {
      worst = dc;
      worstUpkeep = upkeep;
    }
  }
  return worst;
}

/** Applies income and upkeep. Cash never goes negative: unpaid data centres go offline instead. */
export function applyIncome(
  state: GameState,
  context: EngineContext,
  lab: LabState,
  arrays: LabArrays,
  info: LabTickInfo,
  growth: GrowthTally,
): void {
  const income = cashIncomeFromArrays(arrays, context, info.mods);
  let upkeep = upkeepOf(state, context, lab, info.mods);
  while (lab.cash + income - upkeep < 0) {
    const dc = costliestOnline(state, context, lab, info.mods);
    if (!dc) break;
    dc.disabledUntilTick = state.tick + max(1, context.balance.unpaidOfflineTicks);
    upkeep -= dataCentreUpkeepOf(dc, context, info.mods);
    pushNews(state, context, {
      textKey: ENGINE_NEWS_KEYS.dataCentreUnpaid,
      tone: 'bad',
      params: { lab: lab.id, region: dc.regionId },
      regionId: dc.regionId,
      labId: lab.id,
    });
  }
  lab.cash = max(0, lab.cash + income - max(0, upkeep));
  lab.stats.cashEarned += income;

  const hype = hypeIncomeOf(context, info.mods, growth.total);
  lab.hype += hype;
  lab.stats.hypeEarned += hype;
}
