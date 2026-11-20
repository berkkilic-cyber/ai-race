import type { GameState, LabState } from './types';
import { objectKeys } from './natives';

/** Deep copy of a lab. Hand-written because it runs every tick. */
export function cloneLab(lab: LabState): LabState {
  const copy: LabState = {
    ...lab,
    ownedNodes: lab.ownedNodes.slice(),
    dataCentres: lab.dataCentres.map((dc) => ({ ...dc })),
    adoption: { ...lab.adoption },
    bans: { ...lab.bans },
    timedModifiers: lab.timedModifiers.map((tm) => ({ modifier: { ...tm.modifier }, untilTick: tm.untilTick })),
    flags: lab.flags.slice(),
    stats: { ...lab.stats },
  };
  if (lab.eliminated) copy.eliminated = { ...lab.eliminated };
  if (lab.personality) copy.personality = { ...lab.personality };
  return copy;
}

/** Deep copy of a game state; the engine mutates the copy and returns it. */
export function cloneState(state: GameState): GameState {
  const labs: Record<string, LabState> = {};
  for (const id of objectKeys(state.labs)) labs[id] = cloneLab(state.labs[id]);
  return {
    ...state,
    labs,
    labOrder: state.labOrder.slice(),
    pendingEvent: state.pendingEvent ? { ...state.pendingEvent } : null,
    lastEventResult: state.lastEventResult ? { ...state.lastEventResult } : null,
    seenEvents: state.seenEvents.slice(),
    // News items are never mutated after creation, so sharing them is safe.
    news: state.news.slice(),
    achievements: state.achievements.slice(),
    ending: state.ending ? { ...state.ending } : null,
  };
}
