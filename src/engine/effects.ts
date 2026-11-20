import { addAdoptionCapped, banLab, setAdoption } from './adoption';
import type { EngineContext } from './context';
import { adoptionIn, clamp, leadRivalOf, otherActiveLabs } from './derived';
import { pushNews } from './news';
import { random } from './rng';
import { assertNever, resolveScope } from './scopes';
import type { Effect, EffectTarget, GameState, LabState, NewsItem, RegionDef, RegionId } from './types';
import { floor, max } from './natives';

/** Labs an effect lands on, relative to the lab that triggered it. */
export function resolveTargets(state: GameState, context: EngineContext, source: LabState, target: EffectTarget = 'self'): LabState[] {
  switch (target) {
    case 'self':
      return [source];
    case 'rivals':
      return otherActiveLabs(state, source.id);
    case 'leadRival': {
      const lead = leadRivalOf(state, context, source.id);
      return lead ? [lead] : [];
    }
    case 'randomRival': {
      const others = otherActiveLabs(state, source.id);
      return others.length > 0 ? [others[floor(random(state) * others.length)]] : [];
    }
    default:
      return assertNever(target);
  }
}

function applyResource(lab: LabState, resource: 'hype' | 'cash', amount: number): void {
  lab[resource] = max(0, lab[resource] + amount);
}

/** Average income of `resource` per tick so far in the run (what `scaleWithIncome` multiplies). */
export function averageIncomeOf(state: GameState, lab: LabState, resource: 'hype' | 'cash'): number {
  const earned = resource === 'hype' ? lab.stats.hypeEarned : lab.stats.cashEarned;
  return earned / max(1, state.tick);
}

/** Final amount of a 'resource' effect for `lab`, including its optional income scaling. */
export function resourceAmountOf(state: GameState, lab: LabState, effect: Extract<Effect, { type: 'resource' }>): number {
  if (!effect.scaleWithIncome) return effect.amount;
  return effect.amount + effect.scaleWithIncome * averageIncomeOf(state, lab, effect.resource);
}

/** Regions a scoped effect acts on: the moment's region for `atMoment` effects applied by a moment, else its scope. */
function scopedRegions(
  state: GameState,
  context: EngineContext,
  lab: LabState,
  effect: Extract<Effect, { scope: unknown }>,
  momentRegion: RegionId | undefined,
): RegionDef[] {
  if (momentRegion !== undefined && 'atMoment' in effect && effect.atMoment) {
    const region = context.regions.get(momentRegion);
    return region ? [region] : [];
  }
  return resolveScope(effect.scope, lab, context, state);
}

function applyAdoptionFactor(
  state: GameState,
  context: EngineContext,
  lab: LabState,
  effect: Extract<Effect, { type: 'adoption' }>,
  momentRegion: RegionId | undefined,
): void {
  for (const region of scopedRegions(state, context, lab, effect, momentRegion)) {
    const current = adoptionIn(lab, region.id);
    if (current <= 0) continue;
    if (effect.factor <= 1) setAdoption(lab, region.id, current * max(0, effect.factor), context);
    else addAdoptionCapped(state, context, lab, region.id, current * (effect.factor - 1));
  }
}

function applyDataCentreEffect(
  state: GameState,
  context: EngineContext,
  lab: LabState,
  effect: Extract<Effect, { type: 'dataCentre' }>,
  momentRegion: RegionId | undefined,
): void {
  const regionIds = new Set(scopedRegions(state, context, lab, effect, momentRegion).map((region) => region.id));
  if (effect.action === 'destroy') {
    lab.dataCentres = lab.dataCentres.filter((dc) => !regionIds.has(dc.regionId));
    return;
  }
  const until = state.tick + (effect.durationTicks ?? context.balance.defaultDisableTicks);
  for (const dc of lab.dataCentres) {
    if (regionIds.has(dc.regionId)) dc.disabledUntilTick = max(dc.disabledUntilTick ?? 0, until);
  }
}

/** Applies one effect to one lab. 'setFlag' and 'news' are handled by applyEffect. */
function applyToLab(
  state: GameState,
  context: EngineContext,
  lab: LabState,
  effect: Exclude<Effect, { type: 'setFlag' | 'news' }>,
  momentRegion: RegionId | undefined,
): void {
  switch (effect.type) {
    case 'resource':
      return applyResource(lab, effect.resource, resourceAmountOf(state, lab, effect));
    case 'resourcePercent':
      return applyResource(lab, effect.resource, (lab[effect.resource] * effect.percent) / 100);
    case 'meter':
      lab[effect.meter] = clamp(lab[effect.meter] + effect.amount, 0, 100);
      return;
    case 'agiProgress':
      lab.agiProgress = clamp(lab.agiProgress + effect.amount, 0, 100);
      return;
    case 'adoption':
      return applyAdoptionFactor(state, context, lab, effect, momentRegion);
    case 'ban':
      for (const region of resolveScope(effect.scope, lab, context, state)) banLab(state, context, lab, region.id, effect.durationTicks);
      return;
    case 'unban':
      for (const region of resolveScope(effect.scope, lab, context, state)) delete lab.bans[region.id];
      return;
    case 'timedModifier':
      lab.timedModifiers.push({ modifier: { ...effect.modifier }, untilTick: state.tick + effect.durationTicks });
      return;
    case 'dataCentre':
      return applyDataCentreEffect(state, context, lab, effect, momentRegion);
    case 'compute':
      lab.computeBonus += effect.amount;
      return;
    default:
      return assertNever(effect);
  }
}

/**
 * Applies an effect triggered by `source`. `newsParams` fill placeholders of 'news' effects;
 * `momentRegion` is the region of the moment applying it (for `atMoment` effects).
 */
export function applyEffect(
  state: GameState,
  context: EngineContext,
  source: LabState,
  effect: Effect,
  newsParams?: NewsItem['params'],
  momentRegion?: RegionId,
): void {
  if (effect.type === 'setFlag') {
    if (effect.durationTicks !== undefined && effect.durationTicks > 0) {
      const timers = (source.flagTimers ??= {});
      const permanent = source.flags.includes(effect.flag) && timers[effect.flag] === undefined;
      // A timed flag never shortens a permanent one; a second timed one extends the first.
      if (!permanent) timers[effect.flag] = max(timers[effect.flag] ?? 0, state.tick + floor(effect.durationTicks));
    } else if (source.flagTimers?.[effect.flag] !== undefined) {
      delete source.flagTimers[effect.flag];
    }
    if (!source.flags.includes(effect.flag)) source.flags.push(effect.flag);
    return;
  }
  if (effect.type === 'news') {
    const params = { lab: source.id, ...newsParams };
    pushNews(state, context, { textKey: effect.textKey, kind: 'other', tone: effect.tone ?? 'neutral', params, labId: source.id });
    return;
  }
  for (const lab of resolveTargets(state, context, source, effect.target)) applyToLab(state, context, lab, effect, momentRegion);
}

export function applyEffects(
  state: GameState,
  context: EngineContext,
  source: LabState,
  effects: readonly Effect[] | undefined,
  newsParams?: NewsItem['params'],
  momentRegion?: RegionId,
): void {
  if (!effects) return;
  for (const effect of effects) applyEffect(state, context, source, effect, newsParams, momentRegion);
}
