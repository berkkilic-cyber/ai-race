/**
 * Pure queue of model launch banners: one at a time, in arrival order, never overlapping.
 * A banner that waited too long (the map was hidden, or several launches came at once) is
 * dropped rather than shown late.
 */
import type { GameState, NewsItem } from '@/engine';

export interface LaunchBanner {
  id: number;
  labId: string;
  mine: boolean;
  /** Name key of the node that provides the new tier (params.model). */
  modelKey: string;
  tier: number;
  /** Rivals: tiers ahead of the player's running model when it launched (0 when not ahead). */
  ahead: number;
  /** Date.now() when it arrived. */
  at: number;
}

/** On screen, including the slide in and out. */
export const BANNER_MS = 3200;
/** A banner that has waited longer than this is dropped. */
export const BANNER_STALE_MS = 9000;
export const MAX_QUEUE = 4;

/** The banner a launch news item makes, or null for any other item. */
export function bannerFor(item: NewsItem, state: GameState, playerTier: number, id: number, now: number): LaunchBanner | null {
  if (item.kind !== 'launch' || !item.labId || !state.labs[item.labId]) return null;
  const tier = item.tier ?? (typeof item.params?.tier === 'number' ? item.params.tier : 0);
  const modelKey = typeof item.params?.model === 'string' ? item.params.model : '';
  const mine = item.labId === state.playerLabId;
  return { id, labId: item.labId, mine, modelKey, tier, ahead: mine ? 0 : Math.max(0, tier - playerTier), at: now };
}

/** Adds a banner; the player's own launch jumps ahead of waiting rival ones. Keeps at most MAX_QUEUE. */
export function enqueue(queue: readonly LaunchBanner[], banner: LaunchBanner): LaunchBanner[] {
  const out = banner.mine ? [...queue.filter((b) => b.mine), banner, ...queue.filter((b) => !b.mine)] : [...queue, banner];
  return out.slice(0, MAX_QUEUE);
}

/** The next banner to show at `now` and the queue left after it (stale ones dropped). */
export function nextBanner(queue: readonly LaunchBanner[], now: number): { show: LaunchBanner | null; rest: LaunchBanner[] } {
  const fresh = queue.filter((b) => now - b.at <= BANNER_STALE_MS);
  return { show: fresh[0] ?? null, rest: fresh.slice(1) };
}
