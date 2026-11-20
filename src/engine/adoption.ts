import type { EngineContext } from './context';
import { adoptionIn, freeShare } from './derived';
import { labModifierTable, statMultiplier } from './modifiers';
import { ENGINE_NEWS_KEYS, pushNews } from './news';
import type { GameState, LabState, RegionId } from './types';
import { markAdoptionChanged } from './usersCache';
import { max, min, round } from './natives';

/** Sets adoption, removing the entry when it falls below `minAdoption`. */
export function setAdoption(lab: LabState, regionId: RegionId, value: number, context: EngineContext): void {
  markAdoptionChanged(lab.adoption);
  if (value < context.balance.minAdoption) delete lab.adoption[regionId];
  else lab.adoption[regionId] = min(1, value);
}

/** Adds up to `amount` adoption, never beyond the region's free share. Returns the amount added. */
export function addAdoptionCapped(state: GameState, context: EngineContext, lab: LabState, regionId: RegionId, amount: number): number {
  const added = min(amount, freeShare(state, regionId));
  if (added <= 0) return 0;
  setAdoption(lab, regionId, adoptionIn(lab, regionId) + added, context);
  return added;
}

/**
 * Gives `lab` at least `amount` adoption in a region, shrinking other labs
 * proportionally when there is not enough free share (a paid launch).
 */
export function placeAdoption(state: GameState, context: EngineContext, lab: LabState, regionId: RegionId, amount: number): void {
  const shortfall = amount - freeShare(state, regionId);
  if (shortfall > 0) {
    let others = 0;
    for (const id of state.labOrder) if (id !== lab.id) others += adoptionIn(state.labs[id], regionId);
    if (others > 0) {
      const keep = max(0, 1 - shortfall / others);
      for (const id of state.labOrder) {
        if (id !== lab.id) setAdoption(state.labs[id], regionId, adoptionIn(state.labs[id], regionId) * keep, context);
      }
    }
  }
  addAdoptionCapped(state, context, lab, regionId, amount);
}

/** Bans a lab from a region. `durationTicks` -1 = permanent; otherwise scaled by the banDuration stat. */
export function banLab(state: GameState, context: EngineContext, lab: LabState, regionId: RegionId, durationTicks: number): void {
  const current = lab.bans[regionId];
  if (current === -1) return;
  let until = -1;
  if (durationTicks !== -1) {
    const region = context.regions.get(regionId);
    const scaled = durationTicks * statMultiplier(labModifierTable(lab, context, state.tick), 'banDuration', region);
    until = state.tick + max(1, round(scaled));
    if (current !== undefined && current > until) return;
  }
  lab.bans[regionId] = until;
  pushNews(state, context, { textKey: ENGINE_NEWS_KEYS.ban, kind: 'ban', tone: 'bad', params: { lab: lab.id, region: regionId }, regionId, labId: lab.id });
}
