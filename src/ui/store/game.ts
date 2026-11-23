import { create } from 'zustand';

import {
  applyAction,
  createGame,
  step,
  type Action,
  type ActionCheck,
  type ContentPack,
  type GameSetup,
  type GameState,
} from '@/engine';

import { logLifecycle } from '../diagnostics/log';
import { noteTick, perfNow } from '../diagnostics/perfStats';
import { setI18nContext } from '../i18n';
import { DEFAULT_PACK_ID, getPackEntry } from '../packs';

/** 0 = paused. A tick runs every 500 / speed ms. */
export type Speed = 0 | 1 | 2 | 3;
export const SPEEDS: readonly Speed[] = [0, 1, 2, 3];

/**
 * Facts about a run's setup that the engine does not need: whether Lab Rep perks were on and
 * which went into `bonus` (src/ui/meta). Kept with the setup (Restart, Rematch, the run save).
 */
export interface RunPerks {
  perksOn?: boolean;
  perkIds?: string[];
}

/** What the start screen passes in; the seed defaults to a random one. */
export type NewGameSetup = Omit<GameSetup, 'seed'> & RunPerks & { seed?: number; packId?: string };

/** The setup the current run was started with (seed resolved). */
export type RunSetup = GameSetup & RunPerks & { packId: string };

export type EventResult = NonNullable<GameState['lastEventResult']>;

export interface GameStore {
  packId: string;
  pack: ContentPack;
  /** Null before the first run. */
  state: GameState | null;
  /** The setup of the current run (null before the first run, or for a run restored from an old save). */
  setup: RunSetup | null;
  speed: Speed;
  /** Result of the event choice just made, shown once until `dismissEventResult`. */
  eventResult: EventResult | null;
  /** Starts a new run and sets speed to 1x. */
  newGame(setup: NewGameSetup): void;
  /** Applies an action through the engine. On failure the state is unchanged. */
  dispatch(action: Action): ActionCheck;
  /** Advances one tick (no-op without a run; the engine ignores ticks while an event is pending or after the end). */
  tick(): void;
  setSpeed(speed: Speed): void;
  dismissEventResult(): void;
  /** Drops the current run. */
  reset(): void;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

const initial = getPackEntry(DEFAULT_PACK_ID);

export const useGameStore = create<GameStore>()((set, get) => ({
  packId: initial.pack.id,
  pack: initial.pack,
  state: null,
  setup: null,
  speed: 1,
  eventResult: null,

  newGame(setup) {
    const { packId = DEFAULT_PACK_ID, seed = randomSeed(), perksOn, perkIds, ...rest } = setup;
    const { pack } = getPackEntry(packId);
    const state = createGame(pack, { ...rest, seed });
    const runSetup: RunSetup = { ...rest, seed, packId, ...(perksOn !== undefined ? { perksOn } : {}), ...(perkIds ? { perkIds } : {}) };
    set({ packId, pack, state, setup: runSetup, speed: 1, eventResult: null });
    logLifecycle('run started', { seed, founder: rest.founderId, home: rest.homeRegion, difficulty: state.difficulty ?? '-' });
  },

  dispatch(action) {
    const { state, pack } = get();
    if (!state) return { ok: false, reason: 'gameEnded' };
    const result = applyAction(state, pack, action);
    if (!result.ok) return result;
    // Show the result of a choice once, if it has text.
    const last = result.state.lastEventResult;
    const eventResult = action.type === 'resolveEvent' ? (last?.resultKey ? last : null) : get().eventResult;
    set({ state: result.state, eventResult });
    logAction(action, result.state);
    for (const l of actionListeners) l(action, result.state, state);
    return { ok: true };
  },

  tick() {
    const { state, pack } = get();
    if (!state) return;
    const t0 = perfNow();
    const next = step(state, pack);
    const t1 = perfNow();
    if (next !== state) set({ state: next });
    noteTick(t1 - t0, perfNow() - t0);
  },

  setSpeed(speed) {
    set({ speed });
  },

  dismissEventResult() {
    set({ eventResult: null });
  },

  reset() {
    set({ state: null, eventResult: null, speed: 1 });
  },
}));

type ActionListener = (action: Action, state: GameState, before: GameState) => void;
const actionListeners = new Set<ActionListener>();

/** Called after every successful dispatch with the action, the new state and the state before (analytics). Returns an unsubscribe. */
export function onGameAction(listener: ActionListener): () => void {
  actionListeners.add(listener);
  return () => actionListeners.delete(listener);
}

/** Lifecycle lines for the actions worth knowing about when reading a crash log. */
function logAction(action: Action, state: GameState): void {
  const day = state.tick + 1;
  if (action.type === 'buyNode') logLifecycle('node bought', { node: action.nodeId, day });
  else if (action.type === 'buildDataCentre') logLifecycle('data centre built', { region: action.regionId, day });
  else if (action.type === 'resolveEvent') logLifecycle('event resolved', { choice: action.choiceId, day });
}

// Lifecycle lines for what the tick changes: an event appearing and the run ending.
useGameStore.subscribe((s, prev) => {
  const next = s.state;
  const before = prev.state;
  if (!next || next === before) return;
  if (next.pendingEvent && next.pendingEvent.eventId !== before?.pendingEvent?.eventId) logLifecycle('event shown', { event: next.pendingEvent.eventId, day: next.tick + 1 });
  if (next.status === 'ended' && before?.status !== 'ended') logLifecycle('run ended', { ending: next.ending?.endingId, day: next.tick + 1 });
});

// Keep t() able to resolve lab ids in news params to the current labs.
useGameStore.subscribe((s, prev) => {
  if (s.state?.labs !== prev.state?.labs || s.pack !== prev.pack) setI18nContext(s.pack, s.state?.labs ?? null);
});
