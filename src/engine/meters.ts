import { banLab } from './adoption';
import type { EngineContext } from './context';
import { clamp, isBannedAt, isPresent, totalDataCentreLevels } from './derived';
import { statMultiplier } from './modifiers';
import { ENGINE_NEWS_KEYS, pushNews } from './news';
import type { GrowthTally, LabTickInfo } from './spread';
import type { GameState, LabState, RegionDef } from './types';
import type { LabArrays } from './workspace';
import { max, pow } from './natives';

/** Prefix of internal flags the engine keeps on a lab (never set by content). */
export const INTERNAL_FLAG_PREFIX = '$';

const banFlagNames = new Map<number, string>();

/** Internal flag recording that a regulation ban threshold has fired. */
export function banThresholdFlag(threshold: number): string {
  let flag = banFlagNames.get(threshold);
  if (flag === undefined) {
    flag = `${INTERNAL_FLAG_PREFIX}banThreshold:${threshold}`;
    banFlagNames.set(threshold, flag);
  }
  return flag;
}

export function agiGainOf(context: EngineContext, info: LabTickInfo): number {
  const { agiBase, agiExponent, agiComputeFactor, agiComputeExponent } = context.balance;
  if (info.capability <= 0) return 0;
  const computeBoost = 1 + agiComputeFactor * (agiComputeExponent === 1 ? info.compute : pow(info.compute, agiComputeExponent));
  return agiBase * pow(info.capability, agiExponent) * computeBoost * statMultiplier(info.mods, 'agiRate');
}

export function regulationGainOf(context: EngineContext, share: number, info: LabTickInfo, growth: GrowthTally): number {
  const { regulationPerGrowth, regulationPerShare } = context.balance;
  return regulationPerShare * share * statMultiplier(info.mods, 'regulationGain') + regulationPerGrowth * growth.strictWeighted;
}

export function backlashGainOf(context: EngineContext, lab: LabState, share: number, info: LabTickInfo): number {
  const { backlashPerCapability, backlashPerDataCentreLevel } = context.balance;
  const raw = backlashPerCapability * info.capability * share + backlashPerDataCentreLevel * totalDataCentreLevels(lab);
  return raw * statMultiplier(info.mods, 'backlashGain');
}

/** AGI progress, regulation and backlash for one tick; `share` is the lab's world share after spread. */
export function applyProgressAndMeters(context: EngineContext, lab: LabState, info: LabTickInfo, growth: GrowthTally, share: number): void {
  const { regulationDecay, backlashDecay, aiRegulationDecay, aiBacklashDecay, aiMeterGainFactor } = context.balance;
  // AI labs get no event cards to relieve their meters, so they gain less and lose more.
  const ai = lab.controller === 'ai';
  const gainFactor = ai ? aiMeterGainFactor : 1;
  lab.agiProgress = clamp(lab.agiProgress + agiGainOf(context, info) * (ai ? context.balance.aiAgiFactor : 1), 0, 100);
  lab.regulation = clamp(lab.regulation + regulationGainOf(context, share, info, growth) * gainFactor - regulationDecay - (ai ? aiRegulationDecay : 0), 0, 100);
  lab.backlash = clamp(lab.backlash + backlashGainOf(context, lab, share, info) * gainFactor - backlashDecay - (ai ? aiBacklashDecay : 0), 0, 100);
}

function strictestPresentRegions(state: GameState, context: EngineContext, lab: LabState, count: number, arrays?: LabArrays): string[] {
  const present = (region: RegionDef, index: number): boolean => (arrays ? arrays.adoption[index] > 0 : isPresent(lab, region.id));
  return context.pack.regions
    .filter((region, index) => present(region, index) && !isBannedAt(lab, region.id, state.tick))
    .sort((a, b) => b.strictness - a.strictness)
    .slice(0, max(0, count))
    .map((region) => region.id);
}

/**
 * When regulation reaches the n-th threshold, the n × banRegionsPerThreshold strictest
 * regions where the lab is present ban it. A threshold re-arms once regulation falls
 * banResetMargin below it.
 */
export function applyThresholdBans(state: GameState, context: EngineContext, lab: LabState, arrays?: LabArrays): void {
  const { banThresholds, banRegionsPerThreshold, banDuration, banResetMargin } = context.balance;
  for (let index = 0; index < banThresholds.length; index++) {
    const threshold = banThresholds[index];
    const flag = banThresholdFlag(threshold);
    const armed = !lab.flags.includes(flag);
    if (armed && lab.regulation >= threshold) {
      lab.flags.push(flag);
      const count = (index + 1) * banRegionsPerThreshold;
      for (const regionId of strictestPresentRegions(state, context, lab, count, arrays)) banLab(state, context, lab, regionId, banDuration);
    } else if (!armed && lab.regulation < threshold - banResetMargin) {
      lab.flags = lab.flags.filter((f) => f !== flag);
    }
  }
}

export function eliminateLab(
  state: GameState,
  context: EngineContext,
  lab: LabState,
  reason: 'banned' | 'revolt' | 'acquired',
  byLabId?: string,
): void {
  lab.active = false;
  lab.eliminated = byLabId === undefined ? { reason, tick: state.tick } : { reason, tick: state.tick, byLabId };
  if (reason === 'acquired') return;
  const textKey = reason === 'banned' ? ENGINE_NEWS_KEYS.eliminatedBanned : ENGINE_NEWS_KEYS.eliminatedRevolt;
  pushNews(state, context, { textKey, tone: 'bad', params: { lab: lab.id }, labId: lab.id });
}

/** Full regulation eliminates as 'banned', full backlash as 'revolt'. */
export function checkElimination(state: GameState, context: EngineContext, lab: LabState): void {
  if (lab.regulation >= 100) eliminateLab(state, context, lab, 'banned');
  else if (lab.backlash >= 100) eliminateLab(state, context, lab, 'revolt');
}
