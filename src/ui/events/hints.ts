import type { ChannelDef, Effect, Stat } from '@/engine';

/** What a hint chip is about. Each maps to a caption key in `HINT_LABEL_KEYS`. */
export type HintSubject =
  | 'hype'
  | 'cash'
  | 'compute'
  | 'regulation'
  | 'backlash'
  | 'agi'
  | 'users'
  | 'bans'
  | 'dataCentres'
  | 'costs'
  | 'risk'
  | 'rivals'
  | 'spread';

export type HintDirection = 'up' | 'down';

/**
 * A direction-only hint for an event choice: which way something tends to move and
 * whether that is good for the player. For `rivals`, `up` means the rivals are helped.
 */
export interface EffectHint {
  subject: HintSubject;
  dir: HintDirection;
  good: boolean;
}

export const HINT_LABEL_KEYS: Record<HintSubject, string> = {
  hype: 'term.hype',
  cash: 'term.cash',
  compute: 'term.compute',
  regulation: 'term.regulation',
  backlash: 'term.backlash',
  agi: 'ui.events.hint.agi',
  users: 'term.users',
  bans: 'ui.events.hint.bans',
  dataCentres: 'ui.events.hint.dataCentres',
  costs: 'ui.events.hint.costs',
  risk: 'ui.events.hint.risk',
  rivals: 'ui.events.hint.rivals',
  spread: 'ui.events2.hint.spread',
};

/** For each modifier stat: the chip it shows as, and whether raising it is good for the lab it lands on. */
const STAT_HINT: Record<Stat, { subject: HintSubject; upIsGood: boolean }> = {
  spreadRate: { subject: 'users', upIsGood: true },
  seedChance: { subject: 'users', upIsGood: true },
  cashIncome: { subject: 'cash', upIsGood: true },
  hypeIncome: { subject: 'hype', upIsGood: true },
  computeCapacity: { subject: 'compute', upIsGood: true },
  agiRate: { subject: 'agi', upIsGood: true },
  regulationGain: { subject: 'regulation', upIsGood: false },
  backlashGain: { subject: 'backlash', upIsGood: false },
  riskChance: { subject: 'risk', upIsGood: false },
  dataCentreCost: { subject: 'costs', upIsGood: false },
  dataCentreUpkeep: { subject: 'costs', upIsGood: false },
  launchCost: { subject: 'costs', upIsGood: false },
  nodeCost: { subject: 'costs', upIsGood: false },
  acquireCost: { subject: 'costs', upIsGood: false },
  banDuration: { subject: 'bans', upIsGood: false },
};

function signed(value: number, subject: HintSubject, upIsGood: boolean): EffectHint | null {
  if (value === 0 || !Number.isFinite(value)) return null;
  const up = value > 0;
  return { subject, dir: up ? 'up' : 'down', good: up === upIsGood };
}

/** The hint for one effect from the point of view of the lab it lands on, or null for effects with nothing to show. */
export function hintForTarget(effect: Effect): EffectHint | null {
  switch (effect.type) {
    case 'resource':
      return signed(effect.amount, effect.resource, true);
    case 'resourcePercent':
      return signed(effect.percent, effect.resource, true);
    case 'meter':
      return signed(effect.amount, effect.meter, false);
    case 'agiProgress':
      return signed(effect.amount, 'agi', true);
    case 'adoption':
      return signed(effect.factor - 1, 'users', true);
    case 'ban':
      return { subject: 'bans', dir: 'up', good: false };
    case 'unban':
      return { subject: 'bans', dir: 'down', good: true };
    case 'timedModifier': {
      const { stat, op, value } = effect.modifier;
      const { subject, upIsGood } = STAT_HINT[stat];
      return signed(op === 'mul' ? value - 1 : value, subject, upIsGood);
    }
    case 'dataCentre':
      return { subject: 'dataCentres', dir: 'down', good: false };
    case 'compute':
      return signed(effect.amount, 'compute', true);
    case 'setFlag':
    case 'news':
      return null;
  }
}

function targetOf(effect: Effect): string {
  return 'target' in effect && effect.target ? effect.target : 'self';
}

/**
 * Chips for a flag that grants a spread channel for a while ("channel:<id>"): faster spread
 * for the player and, for an 'open' channel, faster spread for every rival too.
 */
export function channelFlagHints(effect: Effect, channels: readonly ChannelDef[] = []): EffectHint[] {
  if (effect.type !== 'setFlag' || !effect.flag.startsWith('channel:')) return [];
  const def = channels.find((c) => c.id === effect.flag.slice('channel:'.length));
  const out: EffectHint[] = [{ subject: 'spread', dir: 'up', good: true }];
  if (def?.kind === 'open') out.push({ subject: 'rivals', dir: 'up', good: false });
  return out;
}

/** The hint for one effect from the player's point of view: effects aimed at rivals become a `rivals` chip. */
export function effectHint(effect: Effect): EffectHint | null {
  const hint = hintForTarget(effect);
  if (!hint) return null;
  if (targetOf(effect) === 'self') return hint;
  // Good for the rivals is bad for the player.
  return { subject: 'rivals', dir: hint.good ? 'up' : 'down', good: !hint.good };
}

/** Hint chips for a choice's effects, in effect order, one per subject and direction. */
export function effectHints(effects: readonly Effect[], channels: readonly ChannelDef[] = []): EffectHint[] {
  const out: EffectHint[] = [];
  const seen = new Set<string>();
  for (const effect of effects) {
    const single = effectHint(effect);
    for (const hint of single ? [single] : channelFlagHints(effect, channels)) {
      const key = `${hint.subject}:${hint.dir}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(hint);
    }
  }
  return out;
}
