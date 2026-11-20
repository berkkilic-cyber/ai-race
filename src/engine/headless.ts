import { applyActionInPlace } from './actions';
import { chooseActionsFor, type BotPolicy } from './ai';
import { cloneState } from './clone';
import { getContext, type EngineContext } from './context';
import { capabilityOf, computeOf, worldShareOf } from './derived';
import { createGame } from './game';
import { stepInPlace } from './step';
import type { ContentPack, EndingTrigger, GameSetup, GameState } from './types';
import { max, round } from './natives';

export interface HeadlessOptions {
  /** How the bot in the player's seat plays. */
  policy: BotPolicy;
  /** Stop after this many ticks even without an ending. */
  maxTicks: number;
}

/** Lets the player-seat bot act: resolves a pending event, and plays every aiDecisionInterval ticks. */
function playerTurn(state: GameState, context: EngineContext, policy: BotPolicy): void {
  const interval = max(1, round(context.balance.aiDecisionInterval));
  const playerId = state.playerLabId;
  if (!state.pendingEvent && state.tick % interval !== 0) return;
  for (const action of chooseActionsFor(state, context, playerId, policy)) applyActionInPlace(state, context, action);
}

/** Plays a whole run with a bot in the player's seat and returns the final state. */
export function runHeadless(pack: ContentPack, setup: GameSetup, opts: HeadlessOptions): GameState {
  const context = getContext(pack);
  const state = cloneState(createGame(pack, setup));
  while (state.status === 'running' && state.tick < opts.maxTicks) {
    playerTurn(state, context, opts.policy);
    if (state.pendingEvent) {
      // A card the bot cannot resolve would stall the run; eligible cards always have an available choice.
      playerTurn(state, context, opts.policy);
      if (state.pendingEvent) break;
    }
    stepInPlace(state, context);
  }
  return state;
}

export interface RunSummary {
  endingId: string | null;
  trigger: EndingTrigger | null;
  kind: 'win' | 'lose' | null;
  ticks: number;
  score: number;
  worldShare: number;
  agiProgress: number;
  capability: number;
  compute: number;
  meters: { regulation: number; backlash: number };
  nodesBought: number;
  dataCentres: number;
  eventsResolved: number;
  achievements: string[];
}

/** Compact facts about a finished (or timed-out) run, for balance scripts. */
export function summarizeRun(state: GameState, pack: ContentPack): RunSummary {
  const context = getContext(pack);
  const player = state.labs[state.playerLabId];
  return {
    endingId: state.ending?.endingId ?? null,
    trigger: state.ending?.trigger ?? null,
    kind: state.ending?.kind ?? null,
    ticks: state.tick,
    score: state.ending?.score ?? 0,
    worldShare: worldShareOf(player, context),
    agiProgress: player.agiProgress,
    capability: capabilityOf(player, context, state.tick),
    compute: computeOf(player, context, state.tick),
    meters: { regulation: player.regulation, backlash: player.backlash },
    nodesBought: player.stats.nodesBought,
    dataCentres: player.dataCentres.length,
    eventsResolved: player.stats.eventsResolved,
    achievements: state.achievements.slice(),
  };
}
