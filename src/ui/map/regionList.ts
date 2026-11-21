import { isBanned, type ContentPack, type GameState, type RegionId } from '@/engine';

import { searchRegions } from '../start/logic';

/**
 * The Regions list on the Map tab: every region, grouped for the player. A way to act on
 * any region without touching the map (and a better one for small regions). Grouping only:
 * costs and availability still come from the engine in the region panel.
 */

export interface RegionRow {
  id: RegionId;
  nameKey: string;
  /** The player's adoption share there (0..1). */
  share: number;
  /** Player data centres there. */
  sites: number;
  home: boolean;
  banned: boolean;
}

export interface RegionGroups {
  /** Where the player is present (share or a site), home first, then by share. */
  mine: RegionRow[];
  /** Not yet present, not banned, next to one of the player's regions. */
  next: RegionRow[];
  /** Everything else, by name. */
  rest: RegionRow[];
}

export function regionGroups(state: GameState, pack: ContentPack, query = ''): RegionGroups {
  const player = state.labs[state.playerLabId];
  const sitesBy = new Map<string, number>();
  for (const dc of player.dataCentres) sitesBy.set(dc.regionId, (sitesBy.get(dc.regionId) ?? 0) + 1);
  // searchRegions filters by the shown name and sorts by it.
  const matches = searchRegions(pack.regions, query);
  const rows = matches.map<RegionRow>((r) => ({
    id: r.id,
    nameKey: r.nameKey,
    share: player.adoption[r.id] ?? 0,
    sites: sitesBy.get(r.id) ?? 0,
    home: r.id === player.homeRegion,
    banned: isBanned(state, player.id, r.id),
  }));
  const present = (row: RegionRow) => row.share > 0 || row.sites > 0 || row.home;
  const presentIds = new Set(pack.regions.filter((r) => (player.adoption[r.id] ?? 0) > 0 || sitesBy.has(r.id) || r.id === player.homeRegion).map((r) => r.id));
  const nextIds = new Set<string>();
  for (const r of pack.regions) if (presentIds.has(r.id)) for (const n of r.neighbors) if (!presentIds.has(n)) nextIds.add(n);

  const mine = rows.filter(present).sort((a, b) => Number(b.home) - Number(a.home) || b.share - a.share);
  const next = rows.filter((row) => !present(row) && !row.banned && nextIds.has(row.id));
  const rest = rows.filter((row) => !present(row) && !(nextIds.has(row.id) && !row.banned));
  return { mine, next, rest };
}
