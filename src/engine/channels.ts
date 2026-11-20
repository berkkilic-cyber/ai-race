/**
 * Spread channels: ways of spreading a lab holds (from owned nodes, or for a while from a
 * "channel:<id>" flag). 'clear' channels lift the seeding penalty of barriers, 'jump' channels
 * let seeding skip one neighbour, 'open' channels raise seeding everywhere but help every rival.
 */
import type { EngineContext } from './context';
import type { ChannelDef, LabState } from './types';

/** A flag with this prefix grants the channel named after it while the lab holds the flag. */
export const CHANNEL_FLAG_PREFIX = 'channel:';

/** The channels one lab holds, digested for the spread loop. */
export interface ChannelSet {
  /** Channel ids held, in a stable order (nodes in purchase order, then flags). */
  ids: string[];
  /** Bit mask of the barriers the lab's 'clear' channels lift. */
  clearMask: number;
  /** 'clear' channels with the barrier bits each lifts, for naming the route in news. */
  clearers: { id: string; mask: number }[];
  /** The first 'jump' channel held, if any. */
  jump: string | undefined;
  /** True when the lab holds an 'open' channel. */
  open: boolean;
}

export const NO_CHANNELS: ChannelSet = { ids: [], clearMask: 0, clearers: [], jump: undefined, open: false };

/** Barrier bits a 'clear' channel lifts (its `clears`, or the barrier sharing its id). */
export function clearMaskOf(channel: ChannelDef, context: EngineContext): number {
  if (channel.kind !== 'clear') return 0;
  let mask = 0;
  for (const id of channel.clears ?? [channel.id]) mask |= context.barrierBits.get(id) ?? 0;
  return mask;
}

const nodeChannelCache = new WeakMap<LabState['ownedNodes'], { context: EngineContext; count: number; ids: string[] }>();

/** Channel ids from owned nodes (cached: the engine only appends to ownedNodes). */
function nodeChannels(lab: LabState, context: EngineContext): string[] {
  const cached = nodeChannelCache.get(lab.ownedNodes);
  if (cached && cached.context === context && cached.count === lab.ownedNodes.length) return cached.ids;
  const ids: string[] = [];
  for (const nodeId of lab.ownedNodes) {
    for (const id of context.nodes.get(nodeId)?.channels ?? []) if (!ids.includes(id)) ids.push(id);
  }
  nodeChannelCache.set(lab.ownedNodes, { context, count: lab.ownedNodes.length, ids });
  return ids;
}

/** Ids of every channel the lab holds now (unknown ids are ignored). */
export function channelIdsOf(lab: LabState, context: EngineContext): string[] {
  const fromNodes = nodeChannels(lab, context);
  let ids: string[] | undefined;
  for (const flag of lab.flags) {
    if (!flag.startsWith(CHANNEL_FLAG_PREFIX)) continue;
    const id = flag.slice(CHANNEL_FLAG_PREFIX.length);
    if (fromNodes.includes(id) || ids?.includes(id)) continue;
    (ids ??= fromNodes.slice()).push(id);
  }
  return (ids ?? fromNodes).filter((id) => context.channels.has(id));
}

/** The lab's channels digested for the spread step. */
export function channelSetOf(lab: LabState, context: EngineContext): ChannelSet {
  if (context.channels.size === 0) return NO_CHANNELS;
  const ids = channelIdsOf(lab, context);
  if (ids.length === 0) return NO_CHANNELS;
  const set: ChannelSet = { ids, clearMask: 0, clearers: [], jump: undefined, open: false };
  for (const id of ids) {
    const channel = context.channels.get(id);
    if (!channel) continue;
    if (channel.kind === 'clear') {
      const mask = clearMaskOf(channel, context);
      set.clearMask |= mask;
      set.clearers.push({ id, mask });
    } else if (channel.kind === 'jump') set.jump ??= id;
    else set.open = true;
  }
  return set;
}

/** Number of set bits. */
export function bitCount(mask: number): number {
  let n = 0;
  for (let m = mask >>> 0; m !== 0; m &= m - 1) n++;
  return n;
}

/** The first of the lab's 'clear' channels lifting any of these barrier bits. */
export function clearerOf(set: ChannelSet, mask: number): string | undefined {
  for (const clearer of set.clearers) if ((clearer.mask & mask) !== 0) return clearer.id;
  return undefined;
}
