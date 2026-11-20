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

import { setI18nContext } from '../i18n';
import { DEFAULT_PACK_ID, getPackEntry } from '../packs';

/** 0 = paused. A tick runs every 500 / speed ms. */
export type Speed = 0 | 1 | 2 | 3;
export const SPEEDS: readonly Speed[] = [0, 1, 2, 3];

/** What the start screen passes in; the seed defaults to a random one. */
export type NewGameSetup = Omit<GameSetup, 'seed'> & { seed?: number; packId?: string };

export type EventResult = NonNullable<GameState['lastEventResult']>;

export interface GameStore {
  packId: string;
  pack: ContentPack;
  /** Null before the first run. */
  state: GameState | null;
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
  speed: 1,
  eventResult: null,

  newGame(setup) {
    const { packId = DEFAULT_PACK_ID, seed = randomSeed(), ...rest } = setup;
    const { pack } = getPackEntry(packId);
    const state = createGame(pack, { ...rest, seed });
    set({ packId, pack, state, speed: 1, eventResult: null });
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
    return { ok: true };
  },

  tick() {
    const { state, pack } = get();
    if (!state) return;
    const next = step(state, pack);
    if (next !== state) set({ state: next });
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

// Keep t() able to resolve lab ids in news params to the current labs.
useGameStore.subscribe((s, prev) => {
  if (s.state?.labs !== prev.state?.labs || s.pack !== prev.pack) setI18nContext(s.pack, s.state?.labs ?? null);
});
