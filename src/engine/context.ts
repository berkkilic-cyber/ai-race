import { mergeBalance, type BalanceConfig } from './balance';
import type { ChannelDef, ContentPack, EventDef, FounderDef, NodeDef, RegionDef, RivalDef } from './types';

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
  channels: Map<string, ChannelDef>;
  /** Barrier id -> bit (at most 31 barriers per pack). */
  barrierBits: Map<string, number>;
  /** Bit mask of the barriers on each region (by index). */
  regionBarrierMask: Uint32Array;
  /** Bit mask of the barriers on each link, aligned with neighbourIndices. */
  linkBarrierMask: number[][];
  /** Regions two links away from each region (not itself, not a neighbour): via which neighbour, and both links' barriers. */
  twoHop: { target: number; via: number; mask: number }[][];
}

/** Bit for each barrier id: the pack's barriers first, then any other id regions use. */
function barrierBitsOf(pack: ContentPack): Map<string, number> {
  const bits = new Map<string, number>();
  const add = (id: string) => {
    if (!bits.has(id) && bits.size < 31) bits.set(id, 1 << bits.size);
  };
  for (const barrier of pack.barriers ?? []) add(barrier.id);
  for (const region of pack.regions) {
    for (const id of region.barriers ?? []) add(id);
    for (const list of Object.values(region.linkBarriers ?? {})) for (const id of list) add(id);
  }
  return bits;
}

function maskOf(ids: readonly string[] | undefined, bits: ReadonlyMap<string, number>): number {
  let mask = 0;
  for (const id of ids ?? []) mask |= bits.get(id) ?? 0;
  return mask;
}

function twoHopOf(neighbours: number[][], links: number[][]): { target: number; via: number; mask: number }[][] {
  return neighbours.map((direct, from) => {
    const seen = new Set<number>([from, ...direct]);
    const out: { target: number; via: number; mask: number }[] = [];
    direct.forEach((via, k) => {
      neighbours[via].forEach((target, j) => {
        if (seen.has(target)) return;
        seen.add(target);
        out.push({ target, via, mask: links[from][k] | links[via][j] });
      });
    });
    return out;
  });
}

const cache = new WeakMap<ContentPack, EngineContext>();

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function getContext(pack: ContentPack): EngineContext {
  const cached = cache.get(pack);
  if (cached) return cached;
  const regionIndex = new Map(pack.regions.map((region, index) => [region.id, index]));
  const neighbourIndices = pack.regions.map((region) =>
    region.neighbors.map((id) => regionIndex.get(id)).filter((index): index is number => index !== undefined),
  );
  const barrierBits = barrierBitsOf(pack);
  const linkBarrierMask = pack.regions.map((region, index) =>
    neighbourIndices[index].map((n) => {
      const other = pack.regions[n];
      // Links are symmetric; either side may list the barrier.
      return maskOf(region.linkBarriers?.[other.id], barrierBits) | maskOf(other.linkBarriers?.[region.id], barrierBits);
    }),
  );
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
    neighbourIndices,
    channels: byId(pack.channels ?? []),
    barrierBits,
    regionBarrierMask: Uint32Array.from(pack.regions.map((region) => maskOf(region.barriers, barrierBits))),
    linkBarrierMask,
    twoHop: twoHopOf(neighbourIndices, linkBarrierMask),
  };
  cache.set(pack, context);
  return context;
}
