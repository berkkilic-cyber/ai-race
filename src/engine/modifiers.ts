import type { EngineContext } from './context';
import type { LabState, Modifier, RegionDef, Stat } from './types';
import { max, objectValues } from './natives';

/** All modifiers currently affecting a lab: founder perk, owned nodes and unexpired timed modifiers. */
export function collectModifiers(lab: LabState, context: EngineContext, tick: number): Modifier[] {
  const result: Modifier[] = [];
  if (lab.founderId) {
    const founder = context.founders.get(lab.founderId);
    if (founder) result.push(...founder.modifiers);
  }
  for (const nodeId of lab.ownedNodes) {
    const node = context.nodes.get(nodeId);
    if (node) result.push(...node.modifiers);
  }
  for (const timed of lab.timedModifiers) {
    if (timed.untilTick > tick) result.push(timed.modifier);
  }
  return result;
}

interface StatTotals {
  add: number;
  mul: number;
  /** Region-tagged modifiers, evaluated per region. */
  tagged: Modifier[];
  /** The multiplier without region-tagged modifiers. */
  untagged: number;
}

/** Pre-aggregated modifiers of one lab, so per-region lookups stay cheap inside the tick loop. */
export type ModifierTable = Partial<Record<Stat, StatTotals>>;

export function buildModifierTable(modifiers: readonly Modifier[]): ModifierTable {
  const table: ModifierTable = {};
  for (const modifier of modifiers) {
    const totals = (table[modifier.stat] ??= { add: 0, mul: 1, tagged: [], untagged: 1 });
    if (modifier.regionTag !== undefined) totals.tagged.push(modifier);
    else if (modifier.op === 'add') totals.add += modifier.value;
    else totals.mul *= modifier.value;
  }
  for (const totals of objectValues(table)) totals.untagged = max(0, (1 + totals.add) * totals.mul);
  return table;
}

/**
 * The multiplier for a stat: (1 + Σadd) × Πmul, never negative. Without a region
 * only untagged modifiers count; with one, modifiers tagged for that region count too.
 */
export function statMultiplier(table: ModifierTable, stat: Stat, region?: RegionDef): number {
  const totals = table[stat];
  if (!totals) return 1;
  if (!region || totals.tagged.length === 0) return totals.untagged;
  let add = totals.add;
  let mul = totals.mul;
  for (const modifier of totals.tagged) {
    if (modifier.regionTag === undefined || !region.tags.includes(modifier.regionTag)) continue;
    if (modifier.op === 'add') add += modifier.value;
    else mul *= modifier.value;
  }
  return max(0, (1 + add) * mul);
}

interface CachedTable {
  context: EngineContext;
  nodeCount: number;
  founderId: string | undefined;
  timed: LabState['timedModifiers'];
  timedCount: number;
  table: ModifierTable;
}

/**
 * Tables keyed by the lab's ownedNodes array. The engine only ever appends to
 * ownedNodes and timedModifiers (or replaces the arrays), so identity plus
 * length tells whether a cached table is still valid. Saves rebuilding it every tick.
 */
const tableCache = new WeakMap<LabState['ownedNodes'], CachedTable>();

export function labModifierTable(lab: LabState, context: EngineContext, tick: number): ModifierTable {
  const cacheable = lab.timedModifiers.every((timed) => timed.untilTick > tick);
  if (!cacheable) return buildModifierTable(collectModifiers(lab, context, tick));
  const cached = tableCache.get(lab.ownedNodes);
  if (
    cached &&
    cached.context === context &&
    cached.nodeCount === lab.ownedNodes.length &&
    cached.founderId === lab.founderId &&
    cached.timed === lab.timedModifiers &&
    cached.timedCount === lab.timedModifiers.length
  ) {
    return cached.table;
  }
  const table = buildModifierTable(collectModifiers(lab, context, tick));
  tableCache.set(lab.ownedNodes, {
    context,
    nodeCount: lab.ownedNodes.length,
    founderId: lab.founderId,
    timed: lab.timedModifiers,
    timedCount: lab.timedModifiers.length,
    table,
  });
  return table;
}

/** Drops timed modifiers that have expired. */
export function expireTimedModifiers(lab: LabState, tick: number): void {
  if (lab.timedModifiers.some((timed) => timed.untilTick <= tick)) {
    lab.timedModifiers = lab.timedModifiers.filter((timed) => timed.untilTick > tick);
  }
}

const regionMultCache = new WeakMap<ModifierTable, { regions: readonly RegionDef[]; byStat: Partial<Record<Stat, Float64Array>> }>();

/** statMultiplier of `stat` for every region (by index in `regions`), cached per modifier table. Read-only. */
export function regionMultipliers(table: ModifierTable, stat: Stat, regions: readonly RegionDef[]): Float64Array {
  let cached = regionMultCache.get(table);
  if (!cached || cached.regions !== regions) {
    cached = { regions, byStat: {} };
    regionMultCache.set(table, cached);
  }
  let values = cached.byStat[stat];
  if (!values) {
    values = new Float64Array(regions.length);
    for (let i = 0; i < regions.length; i++) values[i] = statMultiplier(table, stat, regions[i]);
    cached.byStat[stat] = values;
  }
  return values;
}
