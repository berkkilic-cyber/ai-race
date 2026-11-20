import { applyActionInPlace } from './actions';
import { chooseActionsFor, type BotPolicy } from './ai';
import { cloneState } from './clone';
import { getContext, type EngineContext } from './context';
import { capabilityOf, computeOf, worldShareOf } from './derived';
import { createGame } from './game';
import { stepInPlace } from './step';
import type { ContentPack, EndingTrigger, GameSetup, GameState } from './types';
import { hashString, random, seedToRng, type RngHolder } from './rng';
import { floor, max, min, round } from './natives';

export interface HeadlessOptions {
  /** How the bot in the player's seat plays. */
  policy: BotPolicy;
  /** Stop after this many ticks even without an ending. */
  maxTicks: number;
  /**
   * Called after every tick with the live state (for balance scripts that record a run).
   * The state is the engine's working draft: read it, never change it.
   */
  onTick?: (state: GameState) => void;
  /**
   * Probability (0..1) that the bot taps a moment before it expires, rolled when the moment
   * spawns. Default by policy: see DEFAULT_MOMENT_SKILL.
   */
  momentSkill?: number;
  /** Called after the bot taps a moment, with what the tap gained (for balance scripts measuring moment income). */
  onMomentCollected?: (gain: { defId: string; hype: number; cash: number }) => void;
}

/** How reliably each bot policy taps moments when no momentSkill is given. */
export const DEFAULT_MOMENT_SKILL: Record<BotPolicy, number> = {
  sensible: 0.7,
  capability: 0.7,
  reach: 0.7,
  shadow: 0.7,
  random: 0.3,
  idle: 0,
};

/** Share of a moment's lifetime a bot may take to react to it. */
const MOMENT_REACTION_SHARE = 0.6;

/**
 * The bot's hands: rolls each new moment against the skill when it first appears and taps the
 * lucky ones after a reaction delay. Uses its own generator so the skill roll never shifts the
 * game's random stream.
 */
class MomentTapper {
  private readonly seen = new Set<string>();
  private readonly due = new Map<string, number>();
  private readonly rng: RngHolder;

  constructor(
    seed: number,
    private readonly skill: number,
    private readonly onCollected?: HeadlessOptions['onMomentCollected'],
  ) {
    this.rng = { rng: (seedToRng(seed) ^ hashString('moments')) >>> 0 };
  }

  /** Registers moments that appeared since the last call. */
  observe(state: GameState): void {
    for (const moment of state.moments) {
      if (this.seen.has(moment.uid)) continue;
      this.seen.add(moment.uid);
      if (moment.labId !== state.playerLabId || random(this.rng) >= this.skill) continue;
      const lifetime = moment.expiresTick - moment.spawnTick;
      this.due.set(moment.uid, moment.spawnTick + min(lifetime - 1, floor(random(this.rng) * lifetime * MOMENT_REACTION_SHARE)));
    }
  }

  /** Taps the moments whose reaction delay is over. */
  act(state: GameState, context: EngineContext): void {
    for (const [uid, tick] of this.due) {
      if (state.tick < tick) continue;
      this.due.delete(uid);
      const player = state.labs[state.playerLabId];
      const before = { hype: player.hype, cash: player.cash };
      const defId = state.moments.find((m) => m.uid === uid)?.defId ?? '';
      const check = applyActionInPlace(state, context, { type: 'collectMoment', labId: state.playerLabId, uid });
      if (check.ok) this.onCollected?.({ defId, hype: player.hype - before.hype, cash: player.cash - before.cash });
    }
  }
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
  const skill = max(0, min(1, opts.momentSkill ?? DEFAULT_MOMENT_SKILL[opts.policy]));
  const tapper = skill > 0 && pack.moments.length > 0 ? new MomentTapper(setup.seed, skill, opts.onMomentCollected) : undefined;
  while (state.status === 'running' && state.tick < opts.maxTicks) {
    playerTurn(state, context, opts.policy);
    if (state.pendingEvent) {
      // A card the bot cannot resolve would stall the run; eligible cards always have an available choice.
      playerTurn(state, context, opts.policy);
      if (state.pendingEvent) break;
    }
    tapper?.act(state, context);
    stepInPlace(state, context);
    tapper?.observe(state);
    opts.onTick?.(state);
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
  momentsCollected: number;
  momentsMissed: number;
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
    momentsCollected: player.stats.momentsCollected,
    momentsMissed: player.stats.momentsMissed,
    achievements: state.achievements.slice(),
  };
}
