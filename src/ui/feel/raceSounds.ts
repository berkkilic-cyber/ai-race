import { getMeters, type ContentPack, type GameState, type LabState } from '@/engine';

import { composureOf, type ComposureLevel } from '../composure/logic';
import type { CueRequest } from './cues';

/** A composure level sounds its warning again only after this many ticks (meters wobble around a threshold). */
export const METER_WARNING_COOLDOWN_TICKS = 120;

/** What the race mapping remembers between changes (per run). */
export interface RaceMemo {
  /** Tick each composure level last sounded its warning. */
  warnedAt: Partial<Record<ComposureLevel, number>>;
}

export function createRaceMemo(): RaceMemo {
  return { warnedAt: {} };
}

function regionsPresent(lab: LabState): Set<string> {
  const out = new Set<string>();
  for (const [r, v] of Object.entries(lab.adoption)) if (v > 0) out.add(r);
  return out;
}

function dataCentreLevels(lab: LabState): number {
  let n = 0;
  for (const d of lab.dataCentres) n += d.level;
  return n;
}

/**
 * Sounds for one change of the race state, derived only from discrete changes: never one
 * per tick. Player actions show up as counters and sets that grew without the tick
 * moving (buy, data centre, region launch, moment, event choice); world events come from
 * new news items (model launches, achievements), a new pending event, the player's
 * composure level rising and the run ending. Pure apart from updating `memo`.
 */
export function deriveRaceCues(prev: GameState | null, next: GameState | null, pack: ContentPack, memo: RaceMemo): CueRequest[] {
  if (!next || next === prev) return [];
  // A new run (or the first state seen): forget the last run's warnings, say nothing.
  if (!prev || prev.seed !== next.seed || next.tick < prev.tick || prev.playerLabId !== next.playerLabId) {
    memo.warnedAt = {};
    return [];
  }
  const id = next.playerLabId;
  const me = next.labs[id];
  const was = prev.labs[id];
  if (!me || !was) return [];

  if (next.status === 'ended' && prev.status !== 'ended') return [{ cue: next.ending?.kind === 'win' ? 'win' : 'lose' }];
  if (next.status === 'ended') return [];

  const cues: CueRequest[] = [];
  const action = next.tick === prev.tick;

  // Player actions.
  if (me.stats.nodesBought > was.stats.nodesBought) cues.push({ cue: 'buy' });
  if (me.stats.dataCentresBuilt > was.stats.dataCentresBuilt) cues.push({ cue: 'dataCentre' });
  else if (dataCentreLevels(me) > dataCentreLevels(was) && action) cues.push({ cue: 'buy' });
  if (action && me.adoption !== was.adoption) {
    const before = regionsPresent(was);
    for (const r of regionsPresent(me))
      if (!before.has(r)) {
        cues.push({ cue: 'regionLaunch' });
        break;
      }
  }
  if (me.stats.momentsCollected > was.stats.momentsCollected) {
    const still = new Set(next.moments.map((m) => m.uid));
    const gone = prev.moments.find((m) => m.labId === id && !still.has(m.uid));
    const kind = gone ? pack.moments.find((d) => d.id === gone.defId)?.kind : undefined;
    cues.push({ cue: kind === 'threat' ? 'momentAverted' : 'momentBoost' });
  }
  if (me.stats.eventsResolved > was.stats.eventsResolved) cues.push({ cue: 'eventConfirm' });
  // A rival bought out by the player.
  for (const lid of next.labOrder) {
    const l = next.labs[lid];
    if (lid !== id && l.eliminated?.reason === 'acquired' && l.eliminated.byLabId === id && !prev.labs[lid]?.eliminated) {
      cues.push({ cue: 'buy' });
      break;
    }
  }

  // The world.
  if (next.pendingEvent && next.pendingEvent.eventId !== prev.pendingEvent?.eventId) cues.push({ cue: 'eventOpen' });
  if (next.news !== prev.news) {
    const old = new Set(prev.news);
    let own = false;
    let rival = false;
    let achievement = false;
    for (const n of next.news) {
      if (old.has(n)) continue;
      if (n.kind === 'launch') {
        if (n.labId === id) own = true;
        else rival = true;
      } else if (n.kind === 'achievement') achievement = true;
    }
    if (own) cues.push({ cue: 'modelLaunch' });
    if (rival) cues.push({ cue: 'rivalLaunch' });
    if (achievement) cues.push({ cue: 'achievement' });
  }
  if (me.active) {
    const level = composureOf(getMeters(next, id)).level;
    const before = composureOf(getMeters(prev, id)).level;
    if (level > before) {
      const last = memo.warnedAt[level];
      if (last === undefined || next.tick - last >= METER_WARNING_COOLDOWN_TICKS) {
        memo.warnedAt[level] = next.tick;
        cues.push({ cue: 'meterWarning' });
      }
    }
  }
  return cues;
}
