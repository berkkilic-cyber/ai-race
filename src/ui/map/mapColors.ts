import { isBanned, type DataCentre, type GameState, type LabId, type RegionId } from '@/engine';

import { labColor } from '../i18n';
import { colors } from '../theme';

/** Total adoption below which a region counts as untouched. */
const UNTOUCHED = 0.0005;
/** Colour strength of a region with minimal adoption, and at full adoption. */
const MIN_STRENGTH = 0.28;
const MAX_STRENGTH = 0.95;
/** Fill strength is rounded to this many steps so tiny changes do not re-render paths. */
const STEPS = 32;

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(n: number): string {
  return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
}

/** Linear blend from colour a (t = 0) to colour b (t = 1). */
export function mixColor(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return `#${toHex(ca[0] + (cb[0] - ca[0]) * t)}${toHex(ca[1] + (cb[1] - ca[1]) * t)}${toHex(ca[2] + (cb[2] - ca[2]) * t)}`;
}

export interface RegionPresence {
  leader: LabId | null;
  total: number;
}

/** Leading lab (highest adoption) and total adoption in a region. */
export function regionPresence(state: GameState, regionId: RegionId): RegionPresence {
  let leader: LabId | null = null;
  let best = 0;
  let total = 0;
  for (const id of state.labOrder) {
    const a = state.labs[id].adoption[regionId] ?? 0;
    total += a;
    if (a > best) {
      best = a;
      leader = id;
    }
  }
  return { leader, total };
}

/**
 * Fill colour per region: raised surface when untouched, otherwise the leading
 * lab's colour, stronger as total adoption rises. Pure; used by the map every tick.
 */
export function regionFills(state: GameState, regionIds: readonly RegionId[]): Record<RegionId, string> {
  const out: Record<RegionId, string> = {};
  for (const id of regionIds) {
    const { leader, total } = regionPresence(state, id);
    if (!leader || total < UNTOUCHED) {
      out[id] = colors.raised;
      continue;
    }
    const raw = MIN_STRENGTH + (MAX_STRENGTH - MIN_STRENGTH) * Math.sqrt(Math.min(1, total));
    const strength = Math.round(raw * STEPS) / STEPS;
    out[id] = mixColor(colors.raised, labColor(state.labs[leader]), strength);
  }
  return out;
}

/** Regions where the player is banned right now, joined with "|" (a stable string for memoised selectors). */
export function bannedKey(state: GameState): string {
  const lab = state.labs[state.playerLabId];
  return Object.keys(lab.bans)
    .filter((id) => isBanned(state, lab.id, id))
    .sort()
    .join('|');
}

export interface SiteMarker {
  key: string;
  regionId: RegionId;
  color: string;
  level: number;
  online: boolean;
  mine: boolean;
}

function online(dc: DataCentre, tick: number): boolean {
  return dc.disabledUntilTick === undefined || tick >= dc.disabledUntilTick;
}

/** Every active lab's data centres as a compact string, so the dot layer only re-renders when sites change. */
export function sitesKey(state: GameState): string {
  const parts: string[] = [];
  for (const id of state.labOrder) {
    const lab = state.labs[id];
    if (!lab.active) continue;
    for (const dc of lab.dataCentres) parts.push(`${id},${dc.id},${dc.regionId},${dc.level},${online(dc, state.tick) ? 1 : 0}`);
  }
  return parts.join(';');
}

export function parseSites(key: string, playerId: LabId, colorOf: (labId: LabId) => string): SiteMarker[] {
  if (!key) return [];
  return key.split(';').map((part) => {
    const [labId, dcId, regionId, level, on] = part.split(',');
    return { key: `${labId}:${dcId}`, regionId, color: colorOf(labId), level: Number(level), online: on === '1', mine: labId === playerId };
  });
}
