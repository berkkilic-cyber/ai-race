import { mergeBalance, type BalanceConfig } from './balance';
import type { ContentPack, EventDef, FounderDef, NodeDef, RegionDef, RivalDef } from './types';

/** Lookup tables derived once per pack. Packs are treated as immutable. */
export interface EngineContext {
  pack: ContentPack;
  balance: BalanceConfig;
  regions: Map<string, RegionDef>;
  nodes: Map<string, NodeDef>;
  events: Map<string, EventDef>;
  founders: Map<string, FounderDef>;
  rivals: Map<string, RivalDef>;
  /** Total population in millions. */
  worldPopulation: number;
  /** Memo of capabilityCapFor by compute value. */
  capabilityCapMemo: Map<number, number>;
  /** Region id -> position in pack.regions (the index used by the tick's typed arrays). */
  regionIndex: Map<string, number>;
  /** Neighbour indices per region index (unknown ids dropped). */
  neighbourIndices: number[][];
}

const cache = new WeakMap<ContentPack, EngineContext>();

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function getContext(pack: ContentPack): EngineContext {
  const cached = cache.get(pack);
  if (cached) return cached;
  const regionIndex = new Map(pack.regions.map((region, index) => [region.id, index]));
  const context: EngineContext = {
    pack,
    balance: mergeBalance(pack.balance),
    regions: byId(pack.regions),
    nodes: byId(pack.nodes),
    events: byId(pack.events),
    founders: byId(pack.founders),
    rivals: byId(pack.rivals),
    worldPopulation: pack.regions.reduce((sum, region) => sum + region.population, 0),
    capabilityCapMemo: new Map(),
    regionIndex,
    neighbourIndices: pack.regions.map((region) =>
      region.neighbors.map((id) => regionIndex.get(id)).filter((index): index is number => index !== undefined),
    ),
  };
  cache.set(pack, context);
  return context;
}
