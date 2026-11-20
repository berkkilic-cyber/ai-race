/**
 * Turns node data (modifiers, model tier, flags, one-off effects) into short
 * readable lines, each coloured good or bad from the player's point of view.
 * Pure text formatting: no game rules are evaluated here.
 */
import type { Effect, EffectTarget, Modifier, NodeDef, RegionScope, Stat } from '@/engine';

import { fmtCash, fmtCompact } from '../format';
import { hasString, regionName, t } from '../i18n';

export type LineTone = 'good' | 'bad';

export interface DescribedLine {
  text: string;
  tone: LineTone;
}

/** Whether a higher value of the stat helps the player. */
export const STAT_HIGHER_IS_GOOD: Record<Stat, boolean> = {
  spreadRate: true,
  seedChance: true,
  cashIncome: true,
  hypeIncome: true,
  computeCapacity: true,
  agiRate: true,
  regulationGain: false,
  backlashGain: false,
  riskChance: false,
  dataCentreCost: false,
  dataCentreUpkeep: false,
  launchCost: false,
  nodeCost: false,
  acquireCost: false,
  banDuration: false,
};

const MINUS = '−';

function signed(value: number, text: string): string {
  return `${value < 0 ? MINUS : '+'}${text}`;
}

function trimNumber(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

/** 1.2 -> 20, 0.75 -> -25; keeps one decimal for small changes (1.005 -> 0.5). */
function percentChange(fraction: number): number {
  const p = fraction * 100;
  return Math.abs(p) >= 10 ? Math.round(p) : Number(trimNumber(p));
}

function lowerTerm(key: string): string {
  return t(key).toLowerCase();
}

/** The stat's label for use mid-sentence, e.g. "regulation gain". */
export function statLabel(stat: Stat): string {
  return t(`ui.trees.stat.${stat}`, {
    hype: lowerTerm('term.hype'),
    cash: lowerTerm('term.cash'),
    compute: lowerTerm('term.compute'),
    regulation: lowerTerm('term.regulation'),
    backlash: lowerTerm('term.backlash'),
    dataCentre: lowerTerm('term.dataCentre'),
  });
}

/** Readable name of a region tag, e.g. "eu" -> "EU regions". */
export function tagLabel(tag: string): string {
  const key = `ui.trees.tag.${tag}`;
  return hasString(key) ? t(key) : t('ui.trees.tag.default', { tag: tag.replace(/[-_]+/g, ' ') });
}

function scopeLabel(scope: RegionScope): string {
  switch (scope.kind) {
    case 'home':
      return t('ui.trees.scope.home');
    case 'region':
      return regionName(scope.id);
    case 'tag':
      return tagLabel(scope.tag);
    case 'all':
      return t('ui.trees.scope.all');
    case 'random':
      return t('ui.trees.scope.random', { count: scope.count });
    case 'top':
      return t('ui.trees.scope.top', { count: scope.count });
  }
}

function tone(helps: boolean): LineTone {
  return helps ? 'good' : 'bad';
}

/** "+20% spread", "−25% regulation gain", "+15% spread in EU regions". */
export function describeModifier(modifier: Modifier): DescribedLine {
  const stat = statLabel(modifier.stat);
  const change = modifier.op === 'mul' ? modifier.value - 1 : modifier.value;
  let text =
    modifier.op === 'mul'
      ? t('ui.trees.line.mul', { amount: signed(change, String(Math.abs(percentChange(change)))), stat })
      : t('ui.trees.line.add', { amount: signed(change, String(Math.abs(percentChange(change)))), stat });
  if (modifier.regionTag !== undefined) text = t('ui.trees.line.where', { line: text, where: tagLabel(modifier.regionTag) });
  const goesUp = change > 0;
  return { text, tone: tone(goesUp === STAT_HIGHER_IS_GOOD[modifier.stat]) };
}

function withTarget(line: DescribedLine, target: EffectTarget | undefined): DescribedLine {
  if (!target || target === 'self') return line;
  // An effect on rivals helps the player when it would hurt the player, and vice versa.
  return {
    text: t('ui.trees.line.target', { line: line.text, target: t(`ui.trees.target.${target}`) }),
    tone: line.tone === 'good' ? 'bad' : 'good',
  };
}

/** Caption for a known flag, or null for flags the player does not need to see. */
export function flagLabel(flag: string): string | null {
  const key = `ui.trees.flag.${flag}`;
  return hasString(key) ? t(key) : null;
}

/** A one-off effect as a short line ("+10 Hype now", "+5 Backlash now"); null when it has nothing to show. */
export function describeEffect(effect: Effect): DescribedLine | null {
  switch (effect.type) {
    case 'resource': {
      const amount = effect.resource === 'cash' ? fmtCash(Math.abs(effect.amount)) : fmtCompact(Math.abs(effect.amount));
      const text = t('ui.trees.line.now', { amount: signed(effect.amount, amount), resource: t(`term.${effect.resource}`) });
      return withTarget({ text, tone: tone(effect.amount > 0) }, effect.target);
    }
    case 'resourcePercent': {
      const text = t('ui.trees.line.percentNow', {
        amount: signed(effect.percent, trimNumber(Math.abs(effect.percent))),
        resource: t(`term.${effect.resource}`),
      });
      return withTarget({ text, tone: tone(effect.percent > 0) }, effect.target);
    }
    case 'meter': {
      const text = t('ui.trees.line.now', { amount: signed(effect.amount, fmtCompact(Math.abs(effect.amount))), resource: t(`term.${effect.meter}`) });
      return withTarget({ text, tone: tone(effect.amount < 0) }, effect.target);
    }
    case 'agiProgress': {
      const text = t('ui.trees.line.agi', { amount: signed(effect.amount, fmtCompact(Math.abs(effect.amount))) });
      return withTarget({ text, tone: tone(effect.amount > 0) }, effect.target);
    }
    case 'compute': {
      const text = t('ui.trees.line.compute', { amount: signed(effect.amount, fmtCompact(Math.abs(effect.amount))), compute: t('term.compute') });
      return withTarget({ text, tone: tone(effect.amount > 0) }, effect.target);
    }
    case 'adoption': {
      const change = effect.factor - 1;
      const text = t('ui.trees.line.adoption', { amount: signed(change, String(Math.abs(percentChange(change)))), where: scopeLabel(effect.scope) });
      return withTarget({ text, tone: tone(change > 0) }, effect.target);
    }
    case 'ban': {
      const where = scopeLabel(effect.scope);
      const text = effect.durationTicks < 0 ? t('ui.trees.line.ban', { where }) : t('ui.trees.line.banFor', { where, days: effect.durationTicks });
      return withTarget({ text, tone: 'bad' }, effect.target);
    }
    case 'unban':
      return withTarget({ text: t('ui.trees.line.unban', { where: scopeLabel(effect.scope) }), tone: 'good' }, effect.target);
    case 'timedModifier': {
      const line = withTarget(describeModifier(effect.modifier), effect.target);
      return { text: t('ui.trees.line.timed', { line: line.text, days: effect.durationTicks }), tone: line.tone };
    }
    case 'dataCentre': {
      const key = effect.action === 'destroy' ? 'ui.trees.line.dcDestroy' : 'ui.trees.line.dcDisable';
      const text = t(key, { dataCentre: t('term.dataCentre'), where: scopeLabel(effect.scope) });
      return withTarget({ text, tone: 'bad' }, effect.target);
    }
    case 'setFlag': {
      const label = flagLabel(effect.flag);
      return label ? { text: label, tone: 'good' } : null;
    }
    case 'news':
      return null;
  }
}

/** Everything a node does, in display order: model tier, flags, lasting modifiers, then one-off effects. */
export function describeNode(node: NodeDef): DescribedLine[] {
  const lines: DescribedLine[] = [];
  if (node.capabilityLevel !== undefined) {
    lines.push({ text: t('ui.trees.line.tier', { model: t('term.capability'), tier: node.capabilityLevel }), tone: 'good' });
  }
  for (const flag of node.grantsFlags ?? []) {
    const label = flagLabel(flag);
    if (label) lines.push({ text: label, tone: 'good' });
  }
  for (const modifier of node.modifiers) lines.push(describeModifier(modifier));
  for (const effect of node.onBuy ?? []) {
    const line = describeEffect(effect);
    if (line) lines.push(line);
  }
  return lines;
}
