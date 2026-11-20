import { create } from 'zustand';

import { INITIAL, loaded, next, observe, replayNextRun, skip, start, type Observation, type TutorialState } from './machine';
import { readValue, writeValue } from './storage';

/** Storage key of the "tutorial done" flag. */
export const TUTORIAL_DONE_KEY = 'ai-race.tutorial.done.v1';

export interface TutorialStore {
  tutorial: TutorialState;
  /** True while a coach mark is on screen (toasts wait for it). Set by the host. */
  showing: boolean;
  setShowing(showing: boolean): void;
  /** Reads the done flag once (the host calls it on mount). */
  load(): Promise<void>;
  observe(obs: Observation): void;
  next(obs: Observation): void;
  skip(): void;
  /** Help button in the shell: start over now. */
  replayNow(seed: number | null): void;
  /** Start screen: run it again when the next run starts. */
  replayNextRun(): void;
}

let loading: Promise<void> | null = null;

/**
 * Web debug pages (`?debug=1`, the screenshot scripts) skip the tutorial unless the URL
 * also has `tutorial=1`, so existing scripts keep capturing the plain game.
 */
function suppressedForDebug(): boolean {
  if (typeof window === 'undefined' || typeof window.location?.search !== 'string') return false;
  const q = window.location.search;
  return /[?&]debug=1\b/.test(q) && !/[?&]tutorial=1\b/.test(q);
}

/** Persists done (or clears it) whenever the status crosses into or out of done. */
function persist(prev: TutorialState, nextState: TutorialState): void {
  const was = prev.status === 'done';
  const is = nextState.status === 'done';
  if (was === is || nextState.status === 'loading') return;
  void writeValue(TUTORIAL_DONE_KEY, is ? '1' : null).catch(() => undefined);
}

export const useTutorialStore = create<TutorialStore>()((set, get) => {
  const update = (fn: (s: TutorialState) => TutorialState) => {
    const prev = get().tutorial;
    const out = fn(prev);
    if (out === prev) return;
    set({ tutorial: out });
    persist(prev, out);
  };
  return {
    tutorial: INITIAL,
    showing: false,
    setShowing: (showing) => {
      if (get().showing !== showing) set({ showing });
    },
    load() {
      if (!loading) {
        loading = (suppressedForDebug() ? Promise.resolve('1') : readValue(TUTORIAL_DONE_KEY))
          .then((v) => set((s) => ({ tutorial: loaded(s.tutorial, v === '1') })))
          .catch(() => set((s) => ({ tutorial: loaded(s.tutorial, false) })));
      }
      return loading;
    },
    observe: (obs) => update((s) => observe(s, obs)),
    next: (obs) => update((s) => next(s, obs)),
    skip: () => update(skip),
    replayNow: (seed) => update(() => start(seed)),
    replayNextRun: () => update(replayNextRun),
  };
});

/** Tests: forget the loaded flag and state. */
export function resetTutorialStore(): void {
  loading = null;
  useTutorialStore.setState({ tutorial: INITIAL, showing: false });
}
