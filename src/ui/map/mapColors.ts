import { isBanned, type DataCentre, type GameState, type LabId, type RegionId } from '@/engine';

import { mixColor } from '../color';
import { labColor } from '../i18n';
import { colors } from '../theme';

export { mixColor };

/** Total adoption below which a region counts as untouched. */
const UNTOUCHED = 0.0005;
/** Colour strength of a region with minimal adoption, and at full adoption. */
const MIN_STRENGTH = 0.28;
const MAX_STRENGTH = 0.95;
/** Fill strength is rounded to this many steps so tiny changes do not re-render paths. */
const STEPS = 32;

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

/** Adoption below which a lab lights no dots in a region. */
export const DOT_LIT_MIN = 0.0005;

/**
 * Which lab lights each dot bucket of a region (index 0 is nearest the marker point).
 * Each lab lights round(share x buckets) buckets, at least one once it is present; the
 * biggest share sits at the centre and the others follow outward. Pure.
 */
export function bucketOwners(shares: readonly { id: LabId; share: number }[], buckets: number): (LabId | null)[] {
  const present = shares.filter((s) => s.share >= DOT_LIT_MIN).sort((a, b) => b.share - a.share || (a.id < b.id ? -1 : 1));
  const counts = present.map((s) => Math.max(1, Math.round(Math.min(1, s.share) * buckets)));
  // Never more buckets than there are: take the excess from the largest counts.
  let excess = counts.reduce((a, b) => a + b, 0) - buckets;
  while (excess > 0) {
    let largest = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[largest]) largest = i;
    if (counts[largest] <= 1) break;
    counts[largest]--;
    excess--;
  }
  const out: (LabId | null)[] = [];
  present.forEach((s, i) => {
    for (let k = 0; k < counts[i] && out.length < buckets; k++) out.push(s.id);
  });
  while (out.length < buckets) out.push(null);
  return out;
}

/**
 * Dot colours per region as one comma-joined string of `buckets` colours, so a
 * shallow-compared selector only hands new props to regions whose colours changed.
 * Unlit dots rest in dotRest, or drop to dotBanned (with the player's own) where the player is banned.
 */
export function regionDotColors(
  state: GameState,
  regionIds: readonly RegionId[],
  buckets: number,
  colorOf: (labId: LabId) => string,
): Record<RegionId, string> {
  const player = state.labs[state.playerLabId];
  const out: Record<RegionId, string> = {};
  for (const regionId of regionIds) {
    const shares: { id: LabId; share: number }[] = [];
    for (const id of state.labOrder) {
      const share = state.labs[id].adoption[regionId] ?? 0;
      if (share > 0) shares.push({ id, share });
    }
    const banned = isBanned(state, player.id, regionId);
    const rest = banned ? colors.dotBanned : colors.dotRest;
    out[regionId] = bucketOwners(shares, buckets)
      .map((id) => (id === null || (banned && id === player.id) ? rest : colorOf(id)))
      .join(',');
  }
  return out;
}

export interface Presence {
  labId: LabId;
  regionId: RegionId;
}

/** Labs that gained a foothold (adoption from zero to above zero) between two states. Pure. */
export function newPresences(prev: GameState | null, next: GameState | null): Presence[] {
  if (!prev || !next || prev === next || prev.seed !== next.seed || prev.labs === next.labs) return [];
  const out: Presence[] = [];
  for (const labId of next.labOrder) {
    const before = prev.labs[labId]?.adoption;
    const after = next.labs[labId].adoption;
    if (!before || before === after) continue;
    for (const regionId of Object.keys(after)) {
      if ((after[regionId] ?? 0) > 0 && !((before[regionId] ?? 0) > 0)) out.push({ labId, regionId });
    }
  }
  return out;
}
