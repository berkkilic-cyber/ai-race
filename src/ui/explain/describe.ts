/**
 * Plain-language describers: turn content data (modifiers, channels, model tiers, flags,
 * one-off effects) into short sentences, each coloured good or bad from the player's point
 * of view. Stat changes use the pack's phrase templates (`stat.<Stat>.gain` / `.loss`,
 * "Spreads {pct} faster"); everything else comes from `ui.explain.*`.
 * Pure text formatting: no game rule is evaluated here.
 */
import type { ChannelDef, Effect, EffectTarget, Modifier, NodeDef, RegionScope, Stat } from '@/engine';

import { fmtCash, fmtCompact } from '../format';
import { hasString, regionName, t } from '../i18n';

export type LineTone = 'good' | 'bad';

export interface DescribedLine {
  text: string;
  tone: LineTone;
}

/** Whether a higher value of the stat helps the lab that has it. */
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

function trimNumber(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

/** 1.2 -> 20, 0.75 -> -25; keeps one decimal for small changes (1.005 -> 0.5). */
export function percentChange(fraction: number): number {
  const p = fraction * 100;
  return Math.abs(p) >= 10 ? Math.round(p) : Number(trimNumber(p));
}

function tone(helps: boolean): LineTone {
  return helps ? 'good' : 'bad';
}

function flip(t: LineTone): LineTone {
  return t === 'good' ? 'bad' : 'good';
}

/** Readable name of a region tag, e.g. "eu" -> "EU regions". */
export function tagLabel(tag: string): string {
  const key = `ui.trees.tag.${tag}`;
  return hasString(key) ? t(key) : t('ui.trees.tag.default', { tag: tag.replace(/[-_]+/g, ' ') });
}

/** Where an effect lands, from the point of view of the lab it targets ("your" for the player, "their" for others). */
export function scopeLabel(scope: RegionScope, other = false): string {
  const whose = other ? 'other' : 'self';
  switch (scope.kind) {
    case 'home':
      return t(`ui.explain.scope.home.${whose}`);
    case 'region':
      return regionName(scope.id);
    case 'tag':
      return tagLabel(scope.tag);
    case 'all':
      return t('ui.explain.scope.all');
    case 'random':
      return t(`ui.explain.scope.random.${whose}`, { count: scope.count });
    case 'top':
      return t(`ui.explain.scope.top.${whose}`, { count: scope.count });
  }
}

/** The pack's sentence for a stat change: "Spreads 20% faster", "Regulators notice you 25% less". */
export function statPhrase(stat: Stat, change: number): string {
  const pct = `${Math.abs(percentChange(change))}%`;
  return t(`stat.${stat}.${change >= 0 ? 'gain' : 'loss'}`, { pct });
}

/**
 * A lasting modifier as a sentence. 'mul' 1.2 and 'add' 0.2 both read "20% ..." (the engine
 * combines them as (1 + Σadd) × Πmul). Region-tagged ones add "in Spanish-speaking regions".
 */
export function describeModifier(modifier: Modifier): DescribedLine {
  const change = modifier.op === 'mul' ? modifier.value - 1 : modifier.value;
  let text = statPhrase(modifier.stat, change);
  if (modifier.regionTag !== undefined) text = t('ui.explain.where', { line: text, where: tagLabel(modifier.regionTag) });
  return { text, tone: tone(change > 0 === STAT_HIGHER_IS_GOOD[modifier.stat]) };
}

/** What holding a channel does ("Your model crosses oceans"). Falls back by kind for channels without their own line. */
export function describeChannel(channelId: string, channels: readonly ChannelDef[] = []): DescribedLine {
  const key = `ui.explain.channel.${channelId.replace(/:/g, '-')}`;
  if (hasString(key)) return { text: t(key), tone: 'good' };
  const def = channels.find((c) => c.id === channelId);
  if (def?.kind === 'jump') return { text: t('ui.explain.channel.kind.jump'), tone: 'good' };
  if (def?.kind === 'open') return { text: t('ui.explain.channel.kind.open'), tone: 'good' };
  const barrier = def?.clears?.[0] ?? channelId;
  const barrierKey = `barrier.${barrier.replace(/:/g, '-')}.name`;
  return { text: t('ui.explain.channel.kind.clear', { barrier: hasString(barrierKey) ? t(barrierKey) : barrier }), tone: 'good' };
}

/** Caption for a flag the player should know about, or null (engine internals and secrets stay hidden). */
export function describeFlag(flag: string, channels: readonly ChannelDef[] = [], days?: number): DescribedLine | null {
  let line: DescribedLine | null = null;
  if (flag.startsWith('channel:')) line = describeChannel(flag.slice('channel:'.length), channels);
  else if (hasString(`ui.explain.flag.${flag}`)) line = { text: t(`ui.explain.flag.${flag}`), tone: 'good' };
  else if (hasString(`ui.trees.flag.${flag}`)) line = { text: t(`ui.trees.flag.${flag}`), tone: 'good' };
  if (!line) return null;
  return days !== undefined ? { ...line, text: t('ui.explain.forDays', { line: line.text, days }) } : line;
}

/** Old name kept for callers that only need the caption. */
export function flagLabel(flag: string): string | null {
  return describeFlag(flag)?.text ?? null;
}

function amountOf(resource: 'hype' | 'cash', n: number): string {
  return resource === 'cash' ? fmtCash(Math.abs(n)) : `${fmtCompact(Math.abs(n))} ${t('term.hype')}`;
}

function whoOf(target: EffectTarget): string {
  return t(`ui.explain.who.${target}`);
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export interface DescribeOptions {
  /** The pack's channels, for timed channel flags. */
  channels?: readonly ChannelDef[];
}

/**
 * A one-off effect as a sentence ("Get 10 Hype now", "Regulation falls by 4%", "The leading
 * rival loses 3% of its AGI progress"); null when there is nothing to show (news, hidden flags).
 */
export function describeEffect(effect: Effect, options: DescribeOptions = {}): DescribedLine | null {
  const target = 'target' in effect && effect.target ? effect.target : 'self';
  const other = target !== 'self';
  const who = other ? whoOf(target) : '';
  // A line about another lab: good for them is bad for the player.
  const line = (key: string, params: Record<string, string | number>, helpsTarget: boolean): DescribedLine => {
    const text = t(`${key}.${other ? 'other' : 'self'}`, { ...params, who });
    return { text, tone: other ? flip(tone(helpsTarget)) : tone(helpsTarget) };
  };
  switch (effect.type) {
    case 'resource': {
      const up = effect.amount >= 0;
      const base = line(up ? 'ui.explain.fx.gain' : 'ui.explain.fx.lose', { amount: amountOf(effect.resource, effect.amount) }, up);
      if (!effect.scaleWithIncome) return base;
      return { ...base, text: t('ui.explain.fx.scaled', { line: base.text, days: effect.scaleWithIncome }) };
    }
    case 'resourcePercent': {
      const up = effect.percent >= 0;
      return line(up ? 'ui.explain.fx.gainPct' : 'ui.explain.fx.losePct', { pct: `${trimNumber(Math.abs(effect.percent))}%`, resource: t(`term.${effect.resource}`) }, up);
    }
    case 'meter': {
      const up = effect.amount >= 0;
      return line(up ? 'ui.explain.fx.meterUp' : 'ui.explain.fx.meterDown', { meter: t(`term.${effect.meter}`), amount: `${trimNumber(Math.abs(effect.amount))}%` }, !up);
    }
    case 'agiProgress': {
      const up = effect.amount >= 0;
      return line(up ? 'ui.explain.fx.agiUp' : 'ui.explain.fx.agiDown', { amount: `${trimNumber(Math.abs(effect.amount))}%` }, up);
    }
    case 'compute': {
      const up = effect.amount >= 0;
      return line(up ? 'ui.explain.fx.computeUp' : 'ui.explain.fx.computeDown', { amount: fmtCompact(Math.abs(effect.amount)), compute: t('term.compute').toLowerCase() }, up);
    }
    case 'adoption': {
      const change = effect.factor - 1;
      const up = change >= 0;
      return line(up ? 'ui.explain.fx.usersUp' : 'ui.explain.fx.usersDown', { pct: `${Math.abs(percentChange(change))}%`, where: scopeLabel(effect.scope, other) }, up);
    }
    case 'ban': {
      const where = scopeLabel(effect.scope, other);
      return effect.durationTicks < 0 ? line('ui.explain.fx.banForever', { where }, false) : line('ui.explain.fx.ban', { where, days: effect.durationTicks }, false);
    }
    case 'unban':
      return line('ui.explain.fx.unban', { where: scopeLabel(effect.scope, other) }, true);
    case 'timedModifier': {
      const m = describeModifier(effect.modifier);
      const text = other ? t('ui.explain.fx.timed.other', { who, line: lowerFirst(m.text), days: effect.durationTicks }) : t('ui.explain.forDays', { line: m.text, days: effect.durationTicks });
      return { text, tone: other ? flip(m.tone) : m.tone };
    }
    case 'dataCentre': {
      const where = scopeLabel(effect.scope, other);
      const dataCentres = t('ui.explain.dataCentres');
      return effect.action === 'destroy'
        ? line('ui.explain.fx.dcDestroy', { where, dataCentres }, false)
        : line(effect.durationTicks !== undefined ? 'ui.explain.fx.dcOffline' : 'ui.explain.fx.dcOfflineOpen', { where, dataCentres, days: effect.durationTicks ?? 0 }, false);
    }
    case 'setFlag':
      return describeFlag(effect.flag, options.channels, effect.durationTicks);
    case 'news':
      return null;
  }
}

/** Every effect that has something to say, in order. */
export function describeEffects(effects: readonly Effect[], options: DescribeOptions = {}): DescribedLine[] {
  const out: DescribedLine[] = [];
  for (const effect of effects) {
    const line = describeEffect(effect, options);
    if (line) out.push(line);
  }
  return out;
}

export interface NodeDescribeOptions extends DescribeOptions {
  /** Compute needed to run a model tier (getComputeRequired); adds the need to the tier line. */
  computeFor?: (tier: number) => number;
}

/** Everything a node does, in display order: model tier, channels, flags, lasting modifiers, then one-off effects. */
export function describeNode(node: NodeDef, options: NodeDescribeOptions = {}): DescribedLine[] {
  const lines: DescribedLine[] = [];
  if (node.capabilityLevel !== undefined) {
    const need = options.computeFor?.(node.capabilityLevel);
    const params = { model: t('term.capability'), tier: node.capabilityLevel, compute: need !== undefined ? String(Math.ceil(need - 1e-9)) : '' };
    lines.push({ text: t(need !== undefined ? 'ui.explain.tierNeeds' : 'ui.explain.tier', params), tone: 'good' });
  }
  for (const channel of node.channels ?? []) lines.push(describeChannel(channel, options.channels));
  for (const flag of node.grantsFlags ?? []) {
    const line = describeFlag(flag, options.channels);
    if (line) lines.push(line);
  }
  for (const modifier of node.modifiers) lines.push(describeModifier(modifier));
  lines.push(...describeEffects(node.onBuy ?? [], options));
  return lines;
}
