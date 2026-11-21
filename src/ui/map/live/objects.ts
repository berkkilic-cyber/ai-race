/**
 * Pure placement of the things that stand on the map: data-centre racks, node objects
 * (robots, lobbyists) and the barrier mark of a blocked region. Offsets are in screen
 * points from a region's marker point, so they keep their size at any zoom.
 */
import { isBanned, type ContentPack, type GameState, type LabId, type RegionId } from '@/engine';

import type { MapLiveConfig } from './config';

/** Rack chip side (points). */
export const RACK = 18;
const RACK_GAP = 2;
/** At most this many racks drawn per region; more show as "+n". */
export const MAX_RACKS = 4;
/** Racks sit just below the marker point; bubbles float above it. */
const RACK_DY = 6;
export const OBJECT = 15;

export interface SiteItem {
  key: string;
  labId: LabId;
  level: number;
  online: boolean;
  mine: boolean;
}

export interface PlacedSite extends SiteItem {
  dx: number;
  dy: number;
}

/** Rack chips of one region in a centred row (the player's first), plus how many did not fit. */
export function placeSites(sites: readonly SiteItem[]): { placed: PlacedSite[]; more: number } {
  const ordered = sites.slice().sort((a, b) => Number(b.mine) - Number(a.mine) || b.level - a.level);
  const shown = ordered.slice(0, MAX_RACKS);
  const width = shown.length * RACK + (shown.length - 1) * RACK_GAP;
  const x0 = -width / 2 + RACK / 2;
  return {
    placed: shown.map((s, i) => ({ ...s, dx: x0 + i * (RACK + RACK_GAP), dy: RACK_DY + RACK / 2 })),
    more: ordered.length - shown.length,
  };
}

/** Offset of a node object of a region: left of the racks for the first kind, right for the second. */
export function objectOffset(index: number, racks: number): [number, number] {
  const half = racks > 0 ? (Math.min(racks, MAX_RACKS) * (RACK + RACK_GAP)) / 2 + OBJECT / 2 + 2 : OBJECT / 2 + 3;
  const side = index % 2 === 0 ? -1 : 1;
  return [side * half, RACK_DY + RACK / 2];
}

export interface ObjectItem {
  regionId: RegionId;
  icon: string;
}

/** Users of the player in a region (millions). */
function usersIn(state: GameState, pack: ContentPack, regionId: RegionId): number {
  const region = pack.regions.find((r) => r.id === regionId);
  return (state.labs[state.playerLabId].adoption[regionId] ?? 0) * (region?.population ?? 0);
}

/**
 * Map objects for the nodes the player owns, by the pack's rules: per icon, the largest
 * count among the owned nodes that show it, placed in the strongest or strictest regions
 * where the player is present and not banned.
 */
export function objectItems(state: GameState, pack: ContentPack, config: MapLiveConfig): ObjectItem[] {
  const player = state.labs[state.playerLabId];
  const wanted = new Map<string, { place: 'strongest' | 'strictest'; count: number }>();
  for (const nodeId of player.ownedNodes) {
    const rule = config.objects[nodeId];
    if (!rule) continue;
    const prev = wanted.get(rule.icon);
    if (!prev || rule.count > prev.count) wanted.set(rule.icon, { place: rule.place, count: rule.count });
  }
  if (wanted.size === 0) return [];
  const present = pack.regions.filter((r) => (player.adoption[r.id] ?? 0) > 0 && !isBanned(state, player.id, r.id));
  const out: ObjectItem[] = [];
  for (const [icon, { place, count }] of wanted) {
    const sorted = present
      .slice()
      .sort((a, b) => (place === 'strictest' ? b.strictness - a.strictness : 0) || usersIn(state, pack, b.id) - usersIn(state, pack, a.id) || (a.id < b.id ? -1 : 1));
    for (const r of sorted.slice(0, count)) out.push({ regionId: r.id, icon });
  }
  return out;
}

export function objectsKey(items: readonly ObjectItem[]): string {
  return items.map((i) => `${i.regionId}:${i.icon}`).join('|');
}

export function parseObjectsKey(key: string): ObjectItem[] {
  if (!key) return [];
  return key.split('|').map((part) => {
    const i = part.lastIndexOf(':');
    return { regionId: part.slice(0, i), icon: part.slice(i + 1) };
  });
}

/** Rack icon for a data-centre level. */
export function rackIcon(level: number): 'rack-1' | 'rack-2' | 'rack-3' {
  return level >= 3 ? 'rack-3' : level === 2 ? 'rack-2' : 'rack-1';
}
