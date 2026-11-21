/**
 * Moments: short-lived things on the map that a human player taps. Boosts give a reward
 * when collected; threats land a penalty when they expire untapped. Only human-controlled
 * labs get them. Everything runs inside step(), so nothing happens while an event card is
 * pending (step does nothing then), and checkEnding clears them when the run ends.
 */
import { checkAll } from './conditions';
import type { EngineContext } from './context';
import { adoptionIn, isBannedAt, isPresent, worldShareOf } from './derived';
import { applyEffects } from './effects';
import { pushNews } from './news';
import { randomInt, weightedPick } from './rng';
import type { GameState, LabState, MomentDef, MomentState, RegionDef } from './types';
import { max, round } from './natives';

/** True when the moment's effects act on a data centre, so it needs a region where the lab has one. */
export function momentNeedsDataCentre(def: MomentDef): boolean {
  return def.onCollect.some((e) => e.type === 'dataCentre') || (def.onExpire ?? []).some((e) => e.type === 'dataCentre');
}

function momentDef(context: EngineContext, defId: string): MomentDef | undefined {
  return context.pack.moments.find((def) => def.id === defId);
}

/** Regions where a new moment for `lab` may appear (present, not banned, free of other moments of this lab). */
function openRegions(state: GameState, context: EngineContext, lab: LabState): RegionDef[] {
  const taken = new Set<string>();
  for (const moment of state.moments) if (moment.labId === lab.id) taken.add(moment.regionId);
  return context.pack.regions.filter((region) => isPresent(lab, region.id) && !isBannedAt(lab, region.id, state.tick) && !taken.has(region.id));
}

function regionsFor(def: MomentDef, lab: LabState, open: readonly RegionDef[]): RegionDef[] {
  if (!momentNeedsDataCentre(def)) return open.slice();
  return open.filter((region) => lab.dataCentres.some((dc) => dc.regionId === region.id));
}

/** Tries to place one moment for `lab`. */
function spawnFor(state: GameState, context: EngineContext, lab: LabState): void {
  const active = state.moments.reduce((n, m) => (m.labId === lab.id ? n + 1 : n), 0);
  if (active >= context.balance.maxActiveMoments) return;
  const open = openRegions(state, context, lab);
  if (open.length === 0) return;
  const eligible = context.pack.moments.filter((def) => checkAll(state, context, lab, def.conditions) && regionsFor(def, lab, open).length > 0);
  const { momentBoostWeightFactor, momentThreatWeightFactor, momentLifetimeFactor } = context.balance;
  const def = weightedPick(state, eligible, (d) => d.weight * (d.kind === 'threat' ? momentThreatWeightFactor : momentBoostWeightFactor));
  if (!def) return;
  // Weighted by the lab's users there: moments show up where the lab's people are.
  const region = weightedPick(state, regionsFor(def, lab, open), (r) => adoptionIn(lab, r.id) * r.population);
  if (!region) return;
  const lifetime = max(1, round(def.lifetimeTicks * momentLifetimeFactor));
  state.moments.push({
    uid: `m${state.tick}-${lab.id}`,
    defId: def.id,
    labId: lab.id,
    regionId: region.id,
    spawnTick: state.tick,
    expiresTick: state.tick + lifetime,
  });
}

/** Ticks until the next spawn attempt: a random interval shrinking with world share, down to a floor. */
function nextInterval(state: GameState, context: EngineContext, share: number): number {
  const b = context.balance;
  const base = randomInt(state, b.momentIntervalMin, b.momentIntervalMax);
  return max(max(1, b.momentIntervalFloor), round(base * (1 - b.momentShareSpeedup * share)));
}

/** Expires due moments: onExpire lands, the miss is counted, and threats add a news item. */
function expireMoments(state: GameState, context: EngineContext): void {
  if (state.moments.length === 0) return;
  const due = state.moments.filter((m) => state.tick >= m.expiresTick);
  if (due.length === 0) return;
  state.moments = state.moments.filter((m) => state.tick < m.expiresTick);
  for (const moment of due) {
    const lab = state.labs[moment.labId];
    const def = momentDef(context, moment.defId);
    if (!lab || !def) continue;
    lab.stats.momentsMissed++;
    applyEffects(state, context, lab, def.onExpire, { region: moment.regionId }, moment.regionId);
    if (def.kind === 'threat' && def.expireTextKey !== undefined) {
      pushNews(state, context, {
        textKey: def.expireTextKey,
        kind: 'moment',
        tone: 'bad',
        params: { lab: lab.id, region: moment.regionId },
        regionId: moment.regionId,
        labId: lab.id,
      });
    }
  }
}

/** One tick of moments: expiries, then a spawn attempt for every active human lab when one is due. */
export function updateMoments(state: GameState, context: EngineContext): void {
  if (state.status === 'ended') return;
  expireMoments(state, context);
  if (state.tick < state.nextMomentTick || context.pack.moments.length === 0) return;
  let share = 0;
  for (const id of state.labOrder) {
    const lab = state.labs[id];
    if (lab.controller !== 'human' || !lab.active) continue;
    spawnFor(state, context, lab);
    share = max(share, worldShareOf(lab, context));
  }
  state.nextMomentTick = state.tick + nextInterval(state, context, share);
}

/** The active moment with this uid, if any. */
export function findMoment(state: GameState, uid: string): MomentState | undefined {
  return state.moments.find((m) => m.uid === uid && state.tick < m.expiresTick);
}

/** Taps a moment (already checked): removes it, applies onCollect and counts it. */
export function collectMoment(state: GameState, context: EngineContext, lab: LabState, uid: string): void {
  const moment = findMoment(state, uid);
  if (!moment) return;
  state.moments = state.moments.filter((m) => m.uid !== uid);
  lab.stats.momentsCollected++;
  applyEffects(state, context, lab, momentDef(context, moment.defId)?.onCollect, { region: moment.regionId }, moment.regionId);
}
