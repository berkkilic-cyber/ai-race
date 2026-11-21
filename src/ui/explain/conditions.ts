/**
 * Requirements in plain words: each Condition as a sentence with the player's current
 * value and where to get what is missing ("Needs the Safety Team upgrade (Capability
 * tree)", "Needs Regulation at 50% or less (yours is 62%)", "Needs $30M, you have $12M").
 * Whether a condition holds is always the engine's answer (checkConditions); this file
 * only reads the numbers to show next to it.
 */
import { checkConditions, getMeters, getWorldShare, type Condition, type ContentPack, type GameState, type LabState, type RegionScope, type TreeId } from '@/engine';

import { fmtCash, fmtCompact, fmtPct } from '../format';
import { hasString, t } from '../i18n';
import { scopeLabel } from './describe';

/** The player's numbers a requirement may compare against. */
export interface ConditionValues {
  tick: number;
  hype: number;
  cash: number;
  regulation: number;
  backlash: number;
  /** AGI progress of the strongest active rival, 0..100. */
  rival: number;
  /** 0..100. */
  agi: number;
  /** 0..1. */
  worldShare: number;
  dataCentres: number;
  nodesInTree: Record<TreeId, number>;
  stats: LabState['stats'];
}

export interface ConditionLine {
  text: string;
  /** The engine's verdict for this one condition. */
  met: boolean;
  /** Where to get the missing thing, when the condition is not met and there is a place. */
  help?: string;
}

/** Reads the values through the engine selectors. */
export function conditionValues(state: GameState, pack: ContentPack, labId: string): ConditionValues {
  const lab = state.labs[labId];
  const nodesInTree: Record<TreeId, number> = { capability: 0, reach: 0, shadow: 0 };
  for (const id of lab.ownedNodes) {
    const node = pack.nodes.find((n) => n.id === id);
    if (node) nodesInTree[node.tree]++;
  }
  return {
    tick: state.tick,
    hype: lab.hype,
    cash: lab.cash,
    regulation: lab.regulation,
    backlash: lab.backlash,
    rival: getMeters(state, labId).rival,
    agi: lab.agiProgress,
    worldShare: getWorldShare(state, pack, labId),
    dataCentres: lab.dataCentres.length,
    nodesInTree,
    stats: lab.stats,
  };
}

const pct = (v: number) => `${Math.floor(v)}%`;

function nodeName(pack: ContentPack, id: string): { name: string; tree: string } {
  const node = pack.nodes.find((n) => n.id === id);
  return { name: node ? t(node.nameKey) : id, tree: node ? t(`term.tree.${node.tree}`) : '' };
}

function meterName(meter: 'regulation' | 'backlash' | 'rival'): string {
  return meter === 'rival' ? t('ui.explain.cond.rivalMeter') : t(`term.${meter}`);
}

function meterValue(values: ConditionValues, meter: 'regulation' | 'backlash' | 'rival'): number {
  return values[meter];
}

function resourceText(resource: 'hype' | 'cash', n: number): string {
  return resource === 'cash' ? fmtCash(n) : `${fmtCompact(n)} ${t('term.hype')}`;
}

function statText(stat: keyof LabState['stats'], n: number): string {
  if (stat === 'peakWorldShare') return fmtPct(n);
  if (stat === 'cashEarned') return fmtCash(n);
  return fmtCompact(n);
}

function statName(stat: keyof LabState['stats']): string {
  return t(`ui.explain.stat.${stat}`);
}

function scopeText(scope: RegionScope): string {
  return scopeLabel(scope.kind === 'random' || scope.kind === 'top' ? { kind: 'all' } : scope);
}

/**
 * The sentence for one condition (and, when given, whether it holds and where to get it).
 * `met` defaults to true here; `explainConditions` fills it from the engine.
 */
export function describeCondition(cond: Condition, values: ConditionValues, pack: ContentPack): Omit<ConditionLine, 'met'> {
  switch (cond.type) {
    case 'tickAtLeast':
      return { text: t('ui.explain.cond.fromDay', { day: cond.value + 1, today: values.tick + 1 }) };
    case 'tickAtMost':
      return { text: t('ui.explain.cond.untilDay', { day: cond.value + 1, today: values.tick + 1 }) };
    case 'hasNode': {
      const n = nodeName(pack, cond.nodeId);
      return { text: t('ui.explain.cond.hasNode', n), help: t('ui.explain.help.node', n) };
    }
    case 'lacksNode':
      return { text: t('ui.explain.cond.lacksNode', nodeName(pack, cond.nodeId)) };
    case 'nodesInTreeAtLeast': {
      const tree = t(`term.tree.${cond.tree}`);
      return { text: t('ui.explain.cond.nodesInTree', { n: cond.value, tree, have: values.nodesInTree[cond.tree] }), help: t('ui.explain.help.tree', { tree }) };
    }
    case 'meterAtLeast':
      return { text: t('ui.explain.cond.meterAtLeast', { meter: meterName(cond.meter), value: pct(cond.value), have: pct(meterValue(values, cond.meter)) }) };
    case 'meterAtMost':
      return {
        text: t('ui.explain.cond.meterAtMost', { meter: meterName(cond.meter), value: pct(cond.value), have: pct(meterValue(values, cond.meter)) }),
        help: cond.meter === 'rival' ? undefined : t(`ui.explain.help.${cond.meter}`),
      };
    case 'agiAtLeast':
      return { text: t('ui.explain.cond.agiAtLeast', { value: pct(cond.value), have: pct(values.agi) }), help: t('ui.explain.help.agi') };
    case 'worldShareAtLeast':
      return { text: t('ui.explain.cond.shareAtLeast', { value: fmtPct(cond.value), have: fmtPct(values.worldShare) }), help: t('ui.explain.help.share') };
    case 'worldShareAtMost':
      return { text: t('ui.explain.cond.shareAtMost', { value: fmtPct(cond.value), have: fmtPct(values.worldShare) }) };
    case 'resourceAtLeast':
      return {
        text: t('ui.explain.cond.resourceAtLeast', { amount: resourceText(cond.resource, cond.value), have: resourceText(cond.resource, values[cond.resource]) }),
        help: t(`ui.explain.help.${cond.resource}`),
      };
    case 'resourceAtMost':
      return { text: t('ui.explain.cond.resourceAtMost', { amount: resourceText(cond.resource, cond.value), have: resourceText(cond.resource, values[cond.resource]) }) };
    case 'dataCentresAtLeast':
      return { text: t('ui.explain.cond.dcAtLeast', { n: cond.value, have: values.dataCentres }), help: t('ui.explain.help.dataCentres') };
    case 'dataCentresAtMost':
      return { text: t('ui.explain.cond.dcAtMost', { n: cond.value, have: values.dataCentres }) };
    case 'presentInRegion':
      return { text: t('ui.explain.cond.present', { where: scopeText(cond.scope) }), help: t('ui.explain.help.launch') };
    case 'hasFlag': {
      const key = `ui.explain.flagNeed.${cond.flag}`;
      return { text: hasString(key) ? t(key) : t('ui.explain.cond.hasFlag') };
    }
    case 'lacksFlag':
      return { text: t('ui.explain.cond.lacksFlag') };
    case 'founderIs': {
      const founder = pack.founders.find((f) => f.id === cond.founderId);
      return { text: t('ui.explain.cond.founder', { founder: founder ? t(founder.nameKey) : cond.founderId }) };
    }
    case 'labNameIs':
      return { text: t('ui.explain.cond.labName') };
    case 'endingIs':
    case 'endingKindIs':
      return { text: t('ui.explain.cond.ending') };
    case 'bannedIn':
      return { text: t('ui.explain.cond.bannedIn', { where: scopeText(cond.scope) }) };
    case 'statAtLeast':
      return { text: t('ui.explain.cond.statAtLeast', { stat: statName(cond.stat), value: statText(cond.stat, cond.value), have: statText(cond.stat, values.stats[cond.stat]) }) };
    case 'statAtMost':
      return { text: t('ui.explain.cond.statAtMost', { stat: statName(cond.stat), value: statText(cond.stat, cond.value), have: statText(cond.stat, values.stats[cond.stat]) }) };
  }
}

/** Every condition with the engine's verdict; `help` only on unmet ones. */
export function explainConditions(state: GameState, pack: ContentPack, labId: string, conditions: readonly Condition[]): ConditionLine[] {
  if (conditions.length === 0) return [];
  const values = conditionValues(state, pack, labId);
  return conditions.map((cond) => {
    const met = checkConditions(state, pack, labId, [cond]);
    const { text, help } = describeCondition(cond, values, pack);
    return met || help === undefined ? { text, met } : { text, met, help };
  });
}
