import { getCompute, getWorldShare, isBanned, type ContentPack, type GameState } from '@/engine';

import { fmtCash, fmtCompact, fmtNum } from '../format';

/** The player numbers the result view compares before and after a choice. */
export interface PlayerSnapshot {
  hype: number;
  cash: number;
  regulation: number;
  backlash: number;
  agi: number;
  compute: number;
  /** Data centres owned (online or not). */
  dataCentres: number;
  /** Data centres currently offline. */
  offline: number;
  /** Regions the player is banned from right now. */
  banned: number;
  /** 0..1. */
  worldShare: number;
}

export type DeltaId =
  | 'hype'
  | 'cash'
  | 'regulation'
  | 'backlash'
  | 'agi'
  | 'compute'
  | 'dataCentresLost'
  | 'offline'
  | 'banned'
  | 'worldShare';

export interface StatDelta {
  id: DeltaId;
  /** Signed change (for dataCentresLost: how many were lost, positive). */
  delta: number;
  good: boolean;
}

/** Reads the player's numbers through the engine selectors. Presentation only: no rules. */
export function snapshotPlayer(state: GameState, pack: ContentPack): PlayerSnapshot {
  const id = state.playerLabId;
  const lab = state.labs[id];
  const regionIds = new Set([...Object.keys(lab.bans), ...Object.keys(lab.adoption)]);
  let banned = 0;
  for (const regionId of regionIds) if (isBanned(state, id, regionId)) banned++;
  return {
    hype: lab.hype,
    cash: lab.cash,
    regulation: lab.regulation,
    backlash: lab.backlash,
    agi: lab.agiProgress,
    compute: getCompute(state, pack, id),
    dataCentres: lab.dataCentres.length,
    offline: lab.dataCentres.filter((dc) => dc.disabledUntilTick !== undefined && dc.disabledUntilTick > state.tick).length,
    banned,
    worldShare: getWorldShare(state, pack, id),
  };
}

/** Changes smaller than this are noise and not listed. */
const EPSILON: Record<DeltaId, number> = {
  hype: 0.05,
  cash: 0.05,
  regulation: 0.05,
  backlash: 0.05,
  agi: 0.05,
  compute: 0.05,
  dataCentresLost: 0.5,
  offline: 0.5,
  banned: 0.5,
  worldShare: 0.0005,
};

/** Order in which changes are listed. */
const ORDER: readonly { id: DeltaId; upIsGood: boolean; value: (s: PlayerSnapshot) => number }[] = [
  { id: 'hype', upIsGood: true, value: (s) => s.hype },
  { id: 'cash', upIsGood: true, value: (s) => s.cash },
  { id: 'regulation', upIsGood: false, value: (s) => s.regulation },
  { id: 'backlash', upIsGood: false, value: (s) => s.backlash },
  { id: 'agi', upIsGood: true, value: (s) => s.agi },
  { id: 'compute', upIsGood: true, value: (s) => s.compute },
  // Lost = owned before minus owned after, so a loss is a positive number.
  { id: 'dataCentresLost', upIsGood: false, value: (s) => -s.dataCentres },
  { id: 'offline', upIsGood: false, value: (s) => s.offline },
  { id: 'banned', upIsGood: false, value: (s) => s.banned },
  { id: 'worldShare', upIsGood: true, value: (s) => s.worldShare },
];

/** What changed between two snapshots, in a fixed order, without noise. */
export function diffSnapshots(before: PlayerSnapshot, after: PlayerSnapshot): StatDelta[] {
  const out: StatDelta[] = [];
  for (const { id, upIsGood, value } of ORDER) {
    const delta = value(after) - value(before);
    if (Math.abs(delta) < EPSILON[id]) continue;
    // New sites are not a loss; only list sites that disappeared.
    if (id === 'dataCentresLost' && delta < 0) continue;
    out.push({ id, delta, good: delta > 0 === upIsGood });
  }
  return out;
}

export const DELTA_LABEL_KEYS: Record<DeltaId, string> = {
  hype: 'term.hype',
  cash: 'term.cash',
  regulation: 'term.regulation',
  backlash: 'term.backlash',
  agi: 'ui.events.delta.agi',
  compute: 'term.compute',
  dataCentresLost: 'ui.events.delta.dataCentresLost',
  offline: 'ui.events.delta.offline',
  banned: 'ui.events.delta.banned',
  worldShare: 'ui.events.delta.worldShare',
};

const MINUS = '−';

function sign(n: number): string {
  return n < 0 ? MINUS : '+';
}

function trimmed(n: number): string {
  return fmtNum(n, 1);
}

/** "+20", "−$40M", "+0.4 pts" (world share in percentage points), "2" for counts lost. */
export function formatDelta(d: StatDelta, pointsSuffix: string): string {
  const a = Math.abs(d.delta);
  switch (d.id) {
    case 'cash':
      return `${sign(d.delta)}${fmtCash(a)}`;
    case 'hype':
    case 'compute':
      return `${sign(d.delta)}${fmtCompact(a)}`;
    case 'regulation':
    case 'backlash':
    case 'agi':
      return `${sign(d.delta)}${trimmed(a)}`;
    case 'dataCentresLost':
      return `${Math.round(d.delta)}`;
    case 'offline':
    case 'banned':
      return `${sign(d.delta)}${Math.round(a)}`;
    case 'worldShare':
      return `${sign(d.delta)}${trimmed(a * 100)} ${pointsSuffix}`;
  }
}
