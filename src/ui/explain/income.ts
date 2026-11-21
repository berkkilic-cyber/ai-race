/**
 * Where today's Hype and Cash come from (getIncomeBreakdown) and two or three concrete tips
 * read off the state. Tips are presentation only: they point at things the player can do
 * (and whose cost and availability the engine reports), they never change a rule.
 */
import {
  canApply,
  getIncomeBreakdown,
  getLaunchCost,
  getNodeCost,
  getReachableRegions,
  type ContentPack,
  type GameState,
  type IncomeLine,
  type NodeDef,
  type Stat,
} from '@/engine';

import type { IconName } from '../icons';
import { fmtCash, fmtCompact } from '../format';
import { t } from '../i18n';
import { describeModifier } from './describe';
import { modelFacts, ownsMoreThanRuns } from './model';

export type IncomeKind = 'hype' | 'cash';

export interface IncomeRow {
  key: string;
  text: string;
  /** Per day (a tick is a day); negative for costs. */
  amount: number;
  icon: IconName;
}

export interface IncomeTip {
  key: string;
  text: string;
  icon: IconName;
}

export interface IncomeExplanation {
  total: number;
  rows: IncomeRow[];
  /** The largest cost, if any. */
  biggestCost: IncomeRow | null;
  tips: IncomeTip[];
}

/** Upkeep rows beyond this many are folded into one "other data centres" row. */
const MAX_UPKEEP_ROWS = 3;
const MAX_TIPS = 3;

const SOURCE_ICON: Record<IncomeLine['source'], IconName> = {
  base: 'tier',
  newUsers: 'users',
  perUser: 'users',
  modifiers: 'trees',
  upkeep: 'datacentre',
};

function rowsOf(kind: IncomeKind, lines: readonly IncomeLine[]): IncomeRow[] {
  const rows: IncomeRow[] = [];
  const upkeep = lines.filter((l) => l.source === 'upkeep').sort((a, b) => a.amount - b.amount);
  for (const line of lines) {
    if (line.source === 'upkeep') continue;
    // A modifiers line of zero says nothing.
    if (line.source === 'modifiers' && Math.abs(line.amount) < 1e-6) continue;
    const icon = kind === 'hype' && line.source === 'base' ? 'hype' : kind === 'cash' && line.source === 'base' ? 'cash' : SOURCE_ICON[line.source];
    rows.push({ key: line.source, text: t(`ui.explain.income.${kind}.${line.source}`), amount: line.amount, icon });
  }
  upkeep.slice(0, MAX_UPKEEP_ROWS).forEach((line, i) => {
    rows.push({ key: `upkeep-${line.dataCentreId ?? i}`, text: t('ui.explain.income.cash.upkeep', { region: line.regionId ?? '' }), amount: line.amount, icon: 'datacentre' });
  });
  const rest = upkeep.slice(MAX_UPKEEP_ROWS);
  if (rest.length > 0) {
    rows.push({ key: 'upkeep-rest', text: t('ui.explain.income.cash.upkeepRest', { count: rest.length }), amount: rest.reduce((s, l) => s + l.amount, 0), icon: 'datacentre' });
  }
  return rows;
}

function biggestCostOf(rows: readonly IncomeRow[]): IncomeRow | null {
  let worst: IncomeRow | null = null;
  for (const row of rows) if (row.amount < 0 && row.key !== 'upkeep-rest' && (!worst || row.amount < worst.amount)) worst = row;
  return worst;
}

interface RegionPick {
  regionId: string;
  cost: number;
  affordable: boolean;
}

/**
 * The best region to launch in next for Hype (big, open populations) or Cash (big, wealthy
 * ones): one the lab is not in and not banned from, preferring ones natural spread cannot
 * reach soon. Affordable ones (canApply) first.
 */
export function bestLaunch(state: GameState, pack: ContentPack, labId: string, kind: IncomeKind): RegionPick | null {
  const reach = getReachableRegions(state, pack, labId);
  let best: (RegionPick & { score: number }) | null = null;
  for (const r of reach) {
    if (r.present || r.banned) continue;
    const region = pack.regions.find((x) => x.id === r.regionId);
    if (!region) continue;
    const check = canApply(state, pack, { type: 'launchInRegion', labId, regionId: region.id });
    const affordable = check.ok;
    if (!check.ok && check.reason !== 'notEnoughCash') continue;
    const score = region.population * (kind === 'hype' ? region.openness : region.wealth) * (r.reachable ? 0.6 : 1);
    const pick = { regionId: region.id, cost: getLaunchCost(state, pack, labId, region.id), affordable, score };
    if (!best || Number(pick.affordable) > Number(best.affordable) || (pick.affordable === best.affordable && pick.score > best.score)) best = pick;
  }
  return best ? { regionId: best.regionId, cost: best.cost, affordable: best.affordable } : null;
}

/** The cheapest unowned upgrade whose prerequisites are owned that raises `stat`. */
function bestUpgradeFor(state: GameState, pack: ContentPack, labId: string, stat: Stat): { node: NodeDef; hype: number; cash: number } | null {
  const lab = state.labs[labId];
  let best: { node: NodeDef; hype: number; cash: number } | null = null;
  for (const node of pack.nodes) {
    if (lab.ownedNodes.includes(node.id)) continue;
    if (!node.modifiers.some((m) => m.stat === stat && !m.regionTag && (m.op === 'mul' ? m.value > 1 : m.value > 0))) continue;
    const check = canApply(state, pack, { type: 'buyNode', labId, nodeId: node.id });
    if (!check.ok && check.reason === 'missingRequirement') continue;
    const price = getNodeCost(state, pack, labId, node.id);
    if (!best || price.hype < best.hype) best = { node, hype: price.hype, cash: price.cash };
  }
  return best;
}

function upgradeTip(state: GameState, pack: ContentPack, labId: string, stat: Stat): IncomeTip | null {
  const pick = bestUpgradeFor(state, pack, labId, stat);
  if (!pick) return null;
  const mod = pick.node.modifiers.find((m) => m.stat === stat && !m.regionTag);
  const price = pick.cash > 0 ? `${fmtCompact(pick.hype)} ${t('term.hype')} + ${fmtCash(pick.cash)}` : `${fmtCompact(pick.hype)} ${t('term.hype')}`;
  return {
    key: `upgrade-${stat}`,
    text: t('ui.explain.tip.upgrade', { node: t(pick.node.nameKey), tree: t(`term.tree.${pick.node.tree}`), effect: mod ? describeModifier(mod).text : '', price }),
    icon: pick.node.id as IconName,
  };
}

function launchTip(state: GameState, pack: ContentPack, labId: string, kind: IncomeKind): IncomeTip | null {
  const pick = bestLaunch(state, pack, labId, kind);
  if (!pick) return null;
  const params = { region: pick.regionId, cost: fmtCash(pick.cost), cash: fmtCash(state.labs[labId].cash) };
  return { key: 'launch', text: t(`ui.explain.tip.launch.${kind}${pick.affordable ? '' : 'Later'}`, params), icon: 'users' };
}

function modelTips(state: GameState, pack: ContentPack, labId: string): IncomeTip[] {
  const facts = modelFacts(state, pack, labId);
  if (ownsMoreThanRuns(facts)) {
    return [{ key: 'model-stuck', text: t('ui.explain.tip.modelStuck', { owned: facts.owned, running: facts.running, more: fmtCompact(facts.shortfall) }), icon: 'compute' }];
  }
  const next = facts.tiers.find((tier) => !tier.owned);
  if (!next) return [];
  const node = pack.nodes.find((n) => n.id === next.nodeId);
  if (!node) return [];
  const price = getNodeCost(state, pack, labId, node.id);
  const key = next.required > facts.compute ? 'ui.explain.tip.nextModelCompute' : 'ui.explain.tip.nextModel';
  return [{ key: 'model-next', text: t(key, { node: t(node.nameKey), tier: next.tier, price: fmtCompact(price.hype), compute: fmtCompact(next.required) }), icon: node.id as IconName }];
}

/** Hype or Cash: the lines of today's income, the biggest cost and a few tips. */
export function explainIncome(state: GameState, pack: ContentPack, labId: string, kind: IncomeKind): IncomeExplanation {
  const breakdown = getIncomeBreakdown(state, pack, labId)[kind];
  const rows = rowsOf(kind, breakdown.lines);
  const tips: (IncomeTip | null)[] = [];
  if (kind === 'hype') {
    tips.push(...modelTips(state, pack, labId), launchTip(state, pack, labId, 'hype'), upgradeTip(state, pack, labId, 'hypeIncome'));
  } else {
    if (breakdown.total < 0) tips.push({ key: 'losing', text: t('ui.explain.tip.losingCash'), icon: 'datacentre' });
    tips.push(launchTip(state, pack, labId, 'cash'), upgradeTip(state, pack, labId, 'cashIncome'));
  }
  return { total: breakdown.total, rows, biggestCost: biggestCostOf(rows), tips: tips.filter((x): x is IncomeTip => x !== null).slice(0, MAX_TIPS) };
}

/** "+$1.2M" / "−0.4": a signed per-day amount in the resource's format. */
export function fmtIncome(kind: IncomeKind, amount: number): string {
  const sign = amount < 0 ? '−' : '+';
  const abs = Math.abs(amount);
  return `${sign}${kind === 'cash' ? fmtCash(abs) : fmtCompact(abs)}`;
}

