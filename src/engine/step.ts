import { applyActionInPlace } from './actions';
import { addAdoptionCapped } from './adoption';
import { chooseActionsFor } from './ai';
import { cloneState } from './clone';
import { getContext, type EngineContext } from './context';
import { cachedCapabilityCap, computeOf, ownedCapability } from './derived';
import { applyIncome } from './economy';
import { checkAchievements, checkEnding } from './endings';
import { maybeAddHeadline, maybeDrawEvent } from './events';
import { applyProgressAndMeters, applyThresholdBans, checkElimination } from './meters';
import { expireTimedModifiers, labModifierTable } from './modifiers';
import { ENGINE_NEWS_KEYS, pushNews } from './news';
import { baseAppealOf, decayEliminated, spreadLab, spreadMultipliersOf, type LabTickInfo } from './spread';
import type { ContentPack, GameState, LabState } from './types';
import { loadWorkspace, storeWorkspace, usersFromArrays, type Workspace } from './workspace';
import { max, min, round } from './natives';

/** Rivals whose entryTick has come join at their home region. Not-yet-entered = inactive and never eliminated. */
function enterRivals(state: GameState, context: EngineContext): void {
  for (const id of state.labOrder) {
    const lab = state.labs[id];
    if (lab.active || lab.eliminated) continue;
    const def = context.rivals.get(id);
    if (!def || state.tick < def.entryTick) continue;
    lab.active = true;
    addAdoptionCapped(state, context, lab, lab.homeRegion, context.balance.startAdoption);
    if (def.entryTick > 0) {
      pushNews(state, context, {
        textKey: ENGINE_NEWS_KEYS.rivalEntered,
        tone: 'neutral',
        params: { lab: id, region: lab.homeRegion },
        regionId: lab.homeRegion,
        labId: id,
      });
    }
  }
}

function expireTimers(lab: LabState, tick: number): void {
  expireTimedModifiers(lab, tick);
  for (const regionId in lab.bans) {
    const until = lab.bans[regionId];
    if (until !== -1 && until <= tick) delete lab.bans[regionId];
  }
  for (const dc of lab.dataCentres) {
    if (dc.disabledUntilTick !== undefined && dc.disabledUntilTick <= tick) delete dc.disabledUntilTick;
  }
}

function tickInfo(lab: LabState, context: EngineContext, tick: number): LabTickInfo {
  const mods = labModifierTable(lab, context, tick);
  const compute = computeOf(lab, context, tick, mods);
  const capability = min(ownedCapability(lab, context), cachedCapabilityCap(compute, context));
  return { mods, compute, capability, baseAppeal: baseAppealOf(lab, capability, context), spreadMult: spreadMultipliersOf(mods, context) };
}

/** Rules 3 to 9 for one active lab (compute and capability are in `info`). */
function updateLab(state: GameState, context: EngineContext, ws: Workspace, lab: LabState, infos: ReadonlyMap<string, LabTickInfo>): void {
  const info = infos.get(lab.id);
  const arrays = ws.labs.get(lab.id);
  if (!info || !arrays) return;
  // A meter pushed to 100 by an effect since the last tick eliminates before decay can save it.
  checkElimination(state, context, lab);
  if (!lab.active) return;
  const growth = spreadLab(state, context, ws, lab, info, infos);
  applyIncome(state, context, lab, arrays, info, growth);
  const share = context.worldPopulation > 0 ? usersFromArrays(arrays, context) / context.worldPopulation : 0;
  applyProgressAndMeters(context, lab, info, growth, share);
  lab.stats.peakWorldShare = max(lab.stats.peakWorldShare, share);
  applyThresholdBans(state, context, lab, arrays);
  checkElimination(state, context, lab);
}

function runAiLabs(state: GameState, context: EngineContext): void {
  const interval = max(1, round(context.balance.aiDecisionInterval));
  state.labOrder.forEach((id, index) => {
    const lab = state.labs[id];
    // Staggered by lab index so AI labs do not all act on the same tick.
    if (lab.controller !== 'ai' || !lab.active || (state.tick + index) % interval !== 0) return;
    for (const action of chooseActionsFor(state, context, id)) {
      if (state.status === 'ended') return;
      applyActionInPlace(state, context, action);
    }
  });
}

/** Advances a draft state by one tick in place. */
export function stepInPlace(state: GameState, context: EngineContext): void {
  if (state.status === 'ended' || state.pendingEvent) return;
  state.tick++;
  enterRivals(state, context);
  for (const id of state.labOrder) expireTimers(state.labs[id], state.tick);

  const infos = new Map<string, LabTickInfo>();
  for (const id of state.labOrder) {
    if (state.labs[id].active) infos.set(id, tickInfo(state.labs[id], context, state.tick));
  }
  const ws = loadWorkspace(state, context);
  for (const id of state.labOrder) {
    const lab = state.labs[id];
    if (lab.active) updateLab(state, context, ws, lab, infos);
    else if (lab.eliminated) decayEliminated(context, ws, id);
  }
  storeWorkspace(state, context, ws);

  runAiLabs(state, context);
  maybeDrawEvent(state, context);
  maybeAddHeadline(state, context);
  checkAchievements(state, context, 'tick');
  checkEnding(state, context);
}

export function step(state: GameState, pack: ContentPack): GameState {
  if (state.status === 'ended' || state.pendingEvent) return state;
  const draft = cloneState(state);
  stepInPlace(draft, getContext(pack));
  return draft;
}
