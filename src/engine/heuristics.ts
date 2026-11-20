/** Rough value estimates the AI controller and headless bot use to compare options. */
import type { Effect, EventChoiceDef, LabState, Modifier, NodeDef, Stat } from './types';
import { assertNever } from './scopes';
import { max, min } from './natives';

/** Stats where a higher multiplier is better for the lab that owns the modifier. */
const BENEFICIAL_STATS: ReadonlySet<Stat> = new Set<Stat>(['spreadRate', 'seedChance', 'cashIncome', 'hypeIncome', 'computeCapacity', 'agiRate']);

/** +1 for a beneficial stat, −1 for a cost or danger stat. */
export function statDirection(stat: Stat): 1 | -1 {
  return BENEFICIAL_STATS.has(stat) ? 1 : -1;
}

/** Signed strength of a modifier: positive is good for its owner. Region-tagged ones count half. */
export function modifierValue(modifier: Modifier): number {
  const change = modifier.op === 'add' ? modifier.value : modifier.value - 1;
  return statDirection(modifier.stat) * change * (modifier.regionTag === undefined ? 1 : 0.5);
}

/** How costly another meter point is: more so as the meter fills up. */
function meterWeight(level: number): number {
  return 1 + level / 25;
}

function selfEffectValue(effect: Exclude<Effect, { type: 'setFlag' | 'news' }>, lab: LabState): number {
  switch (effect.type) {
    case 'resource':
      return effect.resource === 'hype' ? effect.amount : effect.amount * 0.3;
    case 'resourcePercent': {
      const amount = (lab[effect.resource] * effect.percent) / 100;
      return effect.resource === 'hype' ? amount : amount * 0.3;
    }
    case 'meter':
      return -effect.amount * 2 * meterWeight(lab[effect.meter]);
    case 'agiProgress':
      return effect.amount * 4;
    case 'adoption':
      return (effect.factor - 1) * 25;
    case 'ban':
      return effect.durationTicks === -1 ? -30 : -10;
    case 'unban':
      return 6;
    case 'timedModifier':
      return modifierValue(effect.modifier) * effect.durationTicks * 0.15;
    case 'dataCentre':
      return effect.action === 'destroy' ? -40 : -12;
    case 'compute':
      return effect.amount * 0.8;
    default:
      return assertNever(effect);
  }
}

/** Value of an effect for the lab that triggers it. Effects on rivals count with the opposite sign, damped. */
export function effectValue(effect: Effect, lab: LabState): number {
  if (effect.type === 'setFlag') return 1;
  if (effect.type === 'news') return 0;
  const value = selfEffectValue(effect, lab);
  const target = effect.target ?? 'self';
  if (target === 'self') return value;
  return target === 'rivals' ? -value * 0.6 : -value * 0.4;
}

export function effectsValue(effects: readonly Effect[] | undefined, lab: LabState): number {
  let total = 0;
  for (const effect of effects ?? []) total += effectValue(effect, lab);
  return total;
}

/** Expected value of an event choice, net of its cost; `riskScale` is the lab's riskChance multiplier. */
export function choiceValue(choice: EventChoiceDef, lab: LabState, riskScale: number): number {
  const cost = (choice.cost?.hype ?? 0) + (choice.cost?.cash ?? 0) * 0.3;
  const risk = choice.risk ? min(1, choice.risk.chance * riskScale) * effectsValue(choice.risk.effects, lab) : 0;
  return effectsValue(choice.effects, lab) + risk - cost;
}

/** Intrinsic value of a node's modifiers, flags and one-off effects (before personality and cost). */
export function nodeBaseValue(node: NodeDef, lab: LabState): number {
  let value = 1;
  for (const modifier of node.modifiers) value += modifierValue(modifier) * 4;
  value += effectsValue(node.onBuy, lab) * 0.1;
  value += (node.grantsFlags?.length ?? 0) * 1.5;
  return max(0.1, value);
}
