/**
 * Everything the info panel of an event choice says: its requirements in plain words with a
 * tick or cross, its cost against what the player has, what its hint arrows mean, what it
 * does, and whether it is a gamble. Availability always comes from the engine (canApply,
 * checkConditions); this only arranges the numbers.
 */
import { canApply, getModifierTotal, type ChannelDef, type ContentPack, type EventChoiceDef, type GameState } from '@/engine';

import { explainConditions, type ConditionLine } from '../explain/conditions';
import { describeEffects, statPhrase, type DescribedLine } from '../explain/describe';
import { fmtCash, fmtCompact, fmtPct } from '../format';
import { failureText, t } from '../i18n';
import { effectHints, HINT_LABEL_KEYS, type EffectHint } from './hints';

export interface CostLine {
  resource: 'hype' | 'cash';
  text: string;
  have: string;
  short: boolean;
}

export interface HintMeaning {
  hint: EffectHint;
  text: string;
}

export interface ChoiceInfo {
  requirements: ConditionLine[];
  costs: CostLine[];
  hints: HintMeaning[];
  effects: DescribedLine[];
  risk: { text: string; effects: DescribedLine[] } | null;
  /** Null when the choice can be taken; otherwise the first thing in the way (a requirement before a cost). */
  blocker: string | null;
}

function costText(resource: 'hype' | 'cash', n: number): string {
  return resource === 'cash' ? fmtCash(n) : `${fmtCompact(n)} ${t('term.hype')}`;
}

/** "Hype goes up: good for you." */
export function hintMeaning(hint: EffectHint): string {
  const subject = t(HINT_LABEL_KEYS[hint.subject]);
  if (hint.subject === 'rivals') return t(hint.dir === 'up' ? 'ui.events2.meaning.rivalsUp' : 'ui.events2.meaning.rivalsDown');
  return t(`ui.events2.meaning.${hint.dir}.${hint.good ? 'good' : 'bad'}`, { subject });
}

export function explainChoice(state: GameState, pack: ContentPack, choice: EventChoiceDef): ChoiceInfo {
  const labId = state.playerLabId;
  const lab = state.labs[labId];
  const channels: readonly ChannelDef[] = pack.channels ?? [];
  const requirements = explainConditions(state, pack, labId, choice.requirements ?? []);
  const costs: CostLine[] = [];
  for (const resource of ['hype', 'cash'] as const) {
    const amount = choice.cost?.[resource];
    if (!amount) continue;
    costs.push({ resource, text: costText(resource, amount), have: costText(resource, lab[resource]), short: lab[resource] < amount });
  }
  let risk: ChoiceInfo['risk'] = null;
  if (choice.risk) {
    const multiplier = getModifierTotal(state, pack, labId, 'riskChance');
    const base = t('ui.events2.risk.base', { pct: fmtPct(choice.risk.chance) });
    const change = multiplier - 1;
    const text = Math.abs(change) < 0.005 ? base : t('ui.events2.risk.modified', { base, mine: statPhrase('riskChance', change) });
    risk = { text, effects: describeEffects(choice.risk.effects, { channels }) };
  }
  const check = canApply(state, pack, { type: 'resolveEvent', labId, choiceId: choice.id });
  let blocker: string | null = null;
  if (!check.ok) {
    const unmet = requirements.find((r) => !r.met);
    const shortCost = costs.find((c) => c.short);
    if (check.reason === 'missingRequirement' && unmet) blocker = unmet.text;
    else if ((check.reason === 'notEnoughHype' || check.reason === 'notEnoughCash') && shortCost) blocker = t('ui.events2.needs', { amount: shortCost.text, have: shortCost.have });
    else blocker = failureText(check.reason);
  }
  return {
    requirements,
    costs,
    hints: effectHints(choice.effects, channels).map((hint) => ({ hint, text: hintMeaning(hint) })),
    effects: describeEffects(choice.effects, { channels }),
    risk,
    blocker,
  };
}
