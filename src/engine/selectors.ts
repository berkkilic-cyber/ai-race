/** Public pure reads over a GameState. Screens use these instead of computing rules themselves. */
import { checkAll } from './conditions';
import { getContext } from './context';
import { acquirePrice, dataCentrePrice, launchPrice, nodePrice, upgradePrice, type Price } from './costs';
import { bitCount, channelSetOf, clearerOf, clearMaskOf } from './channels';
import {
  capabilityOf,
  clamp,
  computeForCapability,
  computeOf,
  isBannedAt,
  isOnline,
  isPresent,
  leadRivalOf,
  ownedCapability,
  usersOf,
  worldShareOf,
} from './derived';
import { cashIncomeOf, dataCentreUpkeepOf, hypeIncomeOf, upkeepOf } from './economy';
import { labModifierTable, statMultiplier } from './modifiers';
import type { Condition, ContentPack, GameState, LabState, Meters, MomentState, Stat } from './types';
import { max } from './natives';

function labOrThrow(state: GameState, labId: string): LabState {
  const lab = state.labs[labId];
  if (!lab) throw new Error(`Unknown lab: ${labId}`);
  return lab;
}

export function getMeters(state: GameState, labId: string): Meters {
  const lab = labOrThrow(state, labId);
  let rival = 0;
  for (const id of state.labOrder) if (id !== labId && state.labs[id].active) rival = max(rival, state.labs[id].agiProgress);
  return { regulation: lab.regulation, backlash: lab.backlash, rival };
}

export function getCompute(state: GameState, pack: ContentPack, labId: string): number {
  return computeOf(labOrThrow(state, labId), getContext(pack), state.tick);
}

/** Effective model tier: highest owned capability level, capped by compute. */
export function getCapabilityLevel(state: GameState, pack: ContentPack, labId: string): number {
  return capabilityOf(labOrThrow(state, labId), getContext(pack), state.tick);
}

/** Users in millions. */
export function getUsers(state: GameState, pack: ContentPack, labId: string): number {
  return usersOf(labOrThrow(state, labId), getContext(pack));
}

/** Share of world population using the lab, 0..1. */
export function getWorldShare(state: GameState, pack: ContentPack, labId: string): number {
  return worldShareOf(labOrThrow(state, labId), getContext(pack));
}

/**
 * Expected income per tick at the current state: cash is net of upkeep, hype
 * counts only the base rate (new-user hype depends on next tick's growth).
 */
export function getIncome(state: GameState, pack: ContentPack, labId: string): { cash: number; hype: number } {
  const context = getContext(pack);
  const lab = labOrThrow(state, labId);
  const mods = labModifierTable(lab, context, state.tick);
  return {
    cash: cashIncomeOf(state, context, lab, mods) - upkeepOf(state, context, lab, mods),
    hype: hypeIncomeOf(context, mods, 0),
  };
}

export function getNodeCost(state: GameState, pack: ContentPack, labId: string, nodeId: string): Price {
  const context = getContext(pack);
  const node = context.nodes.get(nodeId);
  if (!node) throw new Error(`Unknown node: ${nodeId}`);
  return nodePrice(labOrThrow(state, labId), context, node, state.tick);
}

export function getDataCentreCost(state: GameState, pack: ContentPack, labId: string, regionId: string): number {
  const context = getContext(pack);
  const region = context.regions.get(regionId);
  if (!region) throw new Error(`Unknown region: ${regionId}`);
  return dataCentrePrice(labOrThrow(state, labId), context, region, state.tick);
}

export function getUpgradeCost(state: GameState, pack: ContentPack, labId: string, dataCentreId: string): number {
  const lab = labOrThrow(state, labId);
  const dc = lab.dataCentres.find((d) => d.id === dataCentreId);
  if (!dc) throw new Error(`Unknown data centre: ${dataCentreId}`);
  return upgradePrice(lab, getContext(pack), dc, state.tick);
}

export function getLaunchCost(state: GameState, pack: ContentPack, labId: string, regionId: string): number {
  const context = getContext(pack);
  const region = context.regions.get(regionId);
  if (!region) throw new Error(`Unknown region: ${regionId}`);
  return launchPrice(labOrThrow(state, labId), context, region, state.tick);
}

export function getAcquirePrice(state: GameState, pack: ContentPack, labId: string, targetLabId: string): number {
  return acquirePrice(labOrThrow(state, labId), labOrThrow(state, targetLabId), getContext(pack), state.tick);
}

/** Multiplier for a stat, (1 + Σadd) × Πmul; with a region, its tagged modifiers count too. */
export function getModifierTotal(state: GameState, pack: ContentPack, labId: string, stat: Stat, regionId?: string): number {
  const context = getContext(pack);
  const region = regionId === undefined ? undefined : context.regions.get(regionId);
  return statMultiplier(labModifierTable(labOrThrow(state, labId), context, state.tick), stat, region);
}

export function isBanned(state: GameState, labId: string, regionId: string): boolean {
  return isBannedAt(labOrThrow(state, labId), regionId, state.tick);
}

export function checkConditions(state: GameState, pack: ContentPack, labId: string, conditions: readonly Condition[]): boolean {
  return checkAll(state, getContext(pack), labOrThrow(state, labId), conditions);
}

/** The strongest other active lab (highest AGI progress), if any. */
export function getLeadRival(state: GameState, pack: ContentPack, labId: string): string | undefined {
  return leadRivalOf(state, getContext(pack), labId)?.id;
}

/**
 * Params for the ending's title and body text: {lab} is the player's lab id and,
 * when another lab won (rivalAgi), {rival} is the winner's id. Empty before the run ends.
 */
export function getEndingParams(state: GameState): Record<string, string> {
  if (!state.ending) return {};
  const params: Record<string, string> = { lab: state.playerLabId };
  const winner = state.ending.winnerLabId;
  if (winner !== undefined && winner !== state.playerLabId) params.rival = winner;
  return params;
}

/** The lab's moments on the map now (oldest first). */
export function getMoments(state: GameState, labId: string): MomentState[] {
  return state.moments.filter((moment) => moment.labId === labId);
}

/** Share of the moment's lifetime used, 0 (just appeared) to 1 (expiring); 1 for a moment that no longer exists. */
export function getMomentProgress(state: GameState, uid: string): number {
  const moment = state.moments.find((m) => m.uid === uid);
  if (!moment) return 1;
  const lifetime = moment.expiresTick - moment.spawnTick;
  return lifetime <= 0 ? 1 : clamp((state.tick - moment.spawnTick) / lifetime, 0, 1);
}

// ───────────────────────── Clarity selectors (tiers, wins, standings, income, reach) ─────────────────────────

/** Highest model tier among owned nodes, whatever the compute (the effective tier may be lower). */
export function getOwnedCapabilityLevel(state: GameState, pack: ContentPack, labId: string): number {
  return ownedCapability(labOrThrow(state, labId), getContext(pack));
}

/** Compute needed to run model tier `level` (0 for level ≤ 0). */
export function getComputeRequired(pack: ContentPack, level: number): number {
  return computeForCapability(level, getContext(pack).balance);
}

/** Compute still missing to run the highest owned tier: required − current, 0 when enough or nothing owned. */
export function getComputeShortfall(state: GameState, pack: ContentPack, labId: string): number {
  const context = getContext(pack);
  const lab = labOrThrow(state, labId);
  const owned = ownedCapability(lab, context);
  if (owned <= 0) return 0;
  return max(0, computeForCapability(owned, context.balance) - computeOf(lab, context, state.tick));
}

export interface WinProgress {
  /** AGI progress, 0..1. */
  agi: number;
  /** World share over the dependence threshold, 0..1. */
  dependence: number;
  /** Rivals not yet eliminated or bought (including those still to enter), of all rivals. */
  monopoly: { remaining: number; total: number };
}

/** How close the lab is to each win. */
export function getWinProgress(state: GameState, pack: ContentPack, labId: string): WinProgress {
  const context = getContext(pack);
  const lab = labOrThrow(state, labId);
  const threshold = context.balance.dependenceShare;
  const others = state.labOrder.filter((id) => id !== labId);
  return {
    agi: clamp(lab.agiProgress / 100, 0, 1),
    dependence: threshold > 0 ? clamp(worldShareOf(lab, context) / threshold, 0, 1) : 0,
    monopoly: { remaining: others.filter((id) => !state.labs[id].eliminated).length, total: others.length },
  };
}

export interface StandingRow {
  labId: string;
  name: string;
  /** 'pending' = a rival that has not entered yet. */
  status: 'active' | 'eliminated' | 'pending';
  eliminatedReason?: 'banned' | 'revolt' | 'acquired';
  /** 0..1 */
  worldShare: number;
  /** Millions. */
  users: number;
  /** 0..1 */
  agi: number;
  /** Model tier running now (after the compute cap). */
  tier: number;
  /** Highest model tier owned. */
  ownedTier: number;
  compute: number;
  dataCentres: number;
  bannedRegions: number;
  homeRegion: string;
}

/** One row per lab, sorted by world share (highest first, then lab order). */
export function getStandings(state: GameState, pack: ContentPack): StandingRow[] {
  const context = getContext(pack);
  const rows = state.labOrder.map((id, order) => {
    const lab = state.labs[id];
    let bannedRegions = 0;
    for (const regionId in lab.bans) if (isBannedAt(lab, regionId, state.tick)) bannedRegions++;
    const row: StandingRow = {
      labId: id,
      name: lab.name,
      status: lab.active ? 'active' : lab.eliminated ? 'eliminated' : 'pending',
      worldShare: worldShareOf(lab, context),
      users: usersOf(lab, context),
      agi: clamp(lab.agiProgress / 100, 0, 1),
      tier: capabilityOf(lab, context, state.tick),
      ownedTier: ownedCapability(lab, context),
      compute: computeOf(lab, context, state.tick),
      dataCentres: lab.dataCentres.length,
      bannedRegions,
      homeRegion: lab.homeRegion,
    };
    if (lab.eliminated) row.eliminatedReason = lab.eliminated.reason;
    return { row, order };
  });
  rows.sort((a, b) => b.row.worldShare - a.row.worldShare || a.order - b.order);
  return rows.map((r) => r.row);
}

export type IncomeSource = 'base' | 'newUsers' | 'perUser' | 'upkeep' | 'modifiers';

export interface IncomeLine {
  source: IncomeSource;
  /** Per tick; negative for costs. */
  amount: number;
  /** Upkeep lines: the data centre and its region. */
  dataCentreId?: string;
  regionId?: string;
}

export interface IncomeBreakdown {
  /** Hype per tick: base, new users (last tick's growth) and what modifiers add or take. */
  hype: { total: number; lines: IncomeLine[] };
  /** Cash per tick, net: base, per-user revenue, modifiers, and one upkeep line per online data centre. */
  cash: { total: number; lines: IncomeLine[] };
}

/** Where the lab's Hype and Cash come from per tick (the lines of each add up to its total). */
export function getIncomeBreakdown(state: GameState, pack: ContentPack, labId: string): IncomeBreakdown {
  const context = getContext(pack);
  const lab = labOrThrow(state, labId);
  const mods = labModifierTable(lab, context, state.tick);
  const { hypeBase, hypePerNewUser, cashBase, cashPerUser } = context.balance;

  const newUsers = lab.active ? (lab.newUsersLastTick ?? 0) : 0;
  const hypeRaw = hypeBase + hypePerNewUser * newUsers;
  const hypeTotal = hypeIncomeOf(context, mods, newUsers);
  const hypeLines: IncomeLine[] = [
    { source: 'base', amount: hypeBase },
    { source: 'newUsers', amount: hypePerNewUser * newUsers },
    { source: 'modifiers', amount: hypeTotal - hypeRaw },
  ];

  let perUserRaw = 0;
  for (const regionId in lab.adoption) {
    const region = context.regions.get(regionId);
    if (region && !isBannedAt(lab, regionId, state.tick)) perUserRaw += lab.adoption[regionId] * region.population * region.wealth * cashPerUser;
  }
  const gross = cashIncomeOf(state, context, lab, mods);
  const cashLines: IncomeLine[] = [
    { source: 'base', amount: cashBase },
    { source: 'perUser', amount: perUserRaw },
    { source: 'modifiers', amount: gross - cashBase - perUserRaw },
  ];
  let upkeep = 0;
  for (const dc of lab.dataCentres) {
    if (!isOnline(dc, state.tick)) continue;
    const amount = dataCentreUpkeepOf(dc, context, mods);
    upkeep += amount;
    cashLines.push({ source: 'upkeep', amount: -amount, dataCentreId: dc.id, regionId: dc.regionId });
  }
  return { hype: { total: hypeTotal, lines: hypeLines }, cash: { total: gross - upkeep, lines: cashLines } };
}

export interface RegionReach {
  regionId: string;
  /** The lab has users there now. */
  present: boolean;
  /** Natural seeding can reach it at full chance now (from a present, unbanned region next door, or two links away with a 'jump' channel). */
  reachable: boolean;
  /** Where seeding would come from (the best route), if any route exists. */
  from?: string;
  /** The skipped region of a 'jump' route. */
  via?: string;
  /** The channel the best route relies on, if any. */
  channel?: string;
  /** Not reachable: barriers on the best route the lab has no channel for (seeding there is slowed, not impossible). */
  blockedBy?: string[];
  /** Nodes carrying a channel that clears each blocking barrier. */
  unlockedBy?: Record<string, string[]>;
  /** The lab is banned there. */
  banned: boolean;
}

/**
 * For every region: is the lab there, can natural seeding reach it now and, if not, which
 * barrier blocks the best route and which nodes would clear it.
 */
export function getReachableRegions(state: GameState, pack: ContentPack, labId: string): RegionReach[] {
  const context = getContext(pack);
  const lab = labOrThrow(state, labId);
  const regions = pack.regions;
  const channels = channelSetOf(lab, context);
  const sources = regions.map((r) => isPresent(lab, r.id) && !isBannedAt(lab, r.id, state.tick));
  const barrierIds = [...context.barrierBits.keys()];
  const barriersIn = (mask: number) => barrierIds.filter((id) => (mask & context.barrierBits.get(id)!) !== 0);

  // Best route per target: fewest uncleared barriers, then direct over jump, then region order.
  const best: { blocked: number; mask: number; from: number; via?: number }[] = [];
  const consider = (target: number, from: number, linkMask: number, via?: number) => {
    const mask = linkMask | context.regionBarrierMask[target];
    const blocked = bitCount(mask & ~channels.clearMask);
    const current = best[target];
    if (!current || blocked < current.blocked || (blocked === current.blocked && current.via !== undefined && via === undefined)) {
      best[target] = via === undefined ? { blocked, mask, from } : { blocked, mask, from, via };
    }
  };
  regions.forEach((_, i) => {
    if (!sources[i]) return;
    context.neighbourIndices[i].forEach((n, k) => consider(n, i, context.linkBarrierMask[i][k]));
    if (channels.jump !== undefined) for (const hop of context.twoHop[i]) consider(hop.target, i, hop.mask, hop.via);
  });

  return regions.map((region, i) => {
    const present = isPresent(lab, region.id);
    const banned = isBannedAt(lab, region.id, state.tick);
    const row: RegionReach = { regionId: region.id, present, reachable: false, banned };
    const route = best[i];
    if (present || !route) return row;
    row.from = regions[route.from].id;
    if (route.via !== undefined) row.via = regions[route.via].id;
    row.reachable = !banned && route.blocked === 0;
    const channel = route.via !== undefined ? channels.jump : clearerOf(channels, route.mask & channels.clearMask);
    if (channel !== undefined) row.channel = channel;
    const blocked = route.mask & ~channels.clearMask;
    if (blocked !== 0) {
      row.blockedBy = barriersIn(blocked);
      row.unlockedBy = {};
      for (const barrier of row.blockedBy) {
        const bit = context.barrierBits.get(barrier)!;
        const clearing = (pack.channels ?? []).filter((c) => (clearMaskOf(c, context) & bit) !== 0).map((c) => c.id);
        row.unlockedBy[barrier] = pack.nodes.filter((n) => (n.channels ?? []).some((c) => clearing.includes(c))).map((n) => n.id);
      }
    }
    return row;
  });
}
