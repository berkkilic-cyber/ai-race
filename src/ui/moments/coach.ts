import { create } from 'zustand';

import type { MomentKind } from '@/engine';

import { useGameStore, type Speed } from '../store/game';
import { readValue, writeValue } from '../tutorial/storage';
import { useTutorialStore } from '../tutorial/store';

/** Storage keys of "the player has seen the first boost / threat coach line". */
export const COACH_KEYS: Record<MomentKind, string> = { boost: 'ai-race.coach.boost.v1', threat: 'ai-race.coach.threat.v1' };
/** How long the run pauses for a coach line (it ends sooner when the bubble is tapped). */
export const COACH_MS = 3800;

export interface CoachStore {
  /** Null until the flags are read. */
  seen: Record<MomentKind, boolean> | null;
  /** The bubble a coach line points at. */
  active: { uid: string; kind: MomentKind } | null;
  load(): Promise<void>;
  /** A bubble appeared: the first of its kind in this player's life gets a coach line (pausing the run briefly). */
  consider(kind: MomentKind, uid: string): void;
  /** The bubble was collected (or left): the line goes and the run resumes. */
  resolved(uid: string): void;
  end(): void;
}

/** Web debug pages (the screenshot scripts) skip coach lines unless the URL has `coach=1`. */
function suppressed(): boolean {
  if (typeof window === 'undefined' || typeof window.location?.search !== 'string') return false;
  const q = window.location.search;
  return /[?&]debug=1\b/.test(q) && !/[?&]coach=1\b/.test(q);
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pausedSpeed: Speed | null = null;
let loading: Promise<void> | null = null;

/**
 * First-run coach lines for moments: the first boost and the first threat each pause the
 * run for a few seconds with one caption ("Tap it before it fades" / "... lands"). Uses the
 * tutorial's persistence (src/ui/tutorial/storage.ts) under keys of its own, and waits while
 * the tutorial itself is running.
 */
export const useCoachStore = create<CoachStore>()((set, get) => ({
  seen: null,
  active: null,
  load() {
    if (!loading) {
      loading = (suppressed() ? Promise.resolve(['1', '1']) : Promise.all([readValue(COACH_KEYS.boost), readValue(COACH_KEYS.threat)]))
        .then(([b, th]) => set({ seen: { boost: b === '1', threat: th === '1' } }))
        .catch(() => set({ seen: { boost: false, threat: false } }));
    }
    return loading;
  },
  consider(kind, uid) {
    const { seen, active } = get();
    if (!seen || seen[kind] || active) return;
    const tutorial = useTutorialStore.getState();
    if (tutorial.tutorial.status !== 'done' || tutorial.showing) return;
    const game = useGameStore.getState();
    if (!game.state || game.state.pendingEvent || game.eventResult) return;
    set({ seen: { ...seen, [kind]: true }, active: { uid, kind } });
    void writeValue(COACH_KEYS[kind], '1').catch(() => undefined);
    if (game.speed > 0) {
      pausedSpeed = game.speed;
      game.setSpeed(0);
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => get().end(), COACH_MS);
  },
  resolved(uid) {
    if (get().active?.uid === uid) get().end();
  },
  end() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (pausedSpeed !== null && useGameStore.getState().speed === 0) useGameStore.getState().setSpeed(pausedSpeed);
    pausedSpeed = null;
    if (get().active) set({ active: null });
  },
}));

/** Tests: forget everything. */
export function resetCoachStore(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pausedSpeed = null;
  loading = null;
  useCoachStore.setState({ seen: null, active: null });
}
