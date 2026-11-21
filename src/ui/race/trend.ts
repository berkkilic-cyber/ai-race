/**
 * A tiny rolling sample of every lab's world share, kept in UI state so the standings can
 * show whether a lab is rising or falling over the last ~30 days. Bounded: one sample every
 * few ticks, at most MAX_SAMPLES of them. Presentation only.
 */
import { useEffect } from 'react';

import { getWorldShare } from '@/engine';

import { useGameStore, type GameStore } from '../store/game';

export interface ShareSample {
  tick: number;
  shares: Record<string, number>;
}

export type Trend = 'up' | 'down' | 'flat';

/** Ticks between samples. */
export const SAMPLE_EVERY = 3;
/** The trend compares with the share about this many ticks ago. */
export const TREND_WINDOW = 30;
/** Enough samples to reach back one window, plus a margin. */
export const MAX_SAMPLES = Math.ceil(TREND_WINDOW / SAMPLE_EVERY) + 2;
/** Changes smaller than this (a tenth of a percentage point) count as flat. */
export const TREND_EPSILON = 0.001;

/** Adds a sample if enough ticks have passed; restarts when time went backwards (a new run). Never grows past `max`. */
export function addSample(buffer: readonly ShareSample[], sample: ShareSample, every = SAMPLE_EVERY, max = MAX_SAMPLES): ShareSample[] {
  const last = buffer[buffer.length - 1];
  if (last && sample.tick < last.tick) return [sample];
  if (last && sample.tick - last.tick < every) return buffer as ShareSample[];
  const next = [...buffer, sample];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Up, down or flat: the current share against the oldest sample within the window. */
export function trendOf(buffer: readonly ShareSample[], labId: string, current: number, tick: number, window = TREND_WINDOW): Trend {
  const from = buffer.find((s) => s.tick >= tick - window && s.tick < tick && s.shares[labId] !== undefined);
  if (!from) return 'flat';
  const delta = current - from.shares[labId];
  if (delta > TREND_EPSILON) return 'up';
  if (delta < -TREND_EPSILON) return 'down';
  return 'flat';
}

let buffer: ShareSample[] = [];
let seed: number | null = null;
let users = 0;
let unsubscribe: (() => void) | null = null;

function sample(s: GameStore): void {
  const st = s.state;
  if (!st) return;
  if (st.seed !== seed) {
    seed = st.seed;
    buffer = [];
  }
  const last = buffer[buffer.length - 1];
  if (last && st.tick >= last.tick && st.tick - last.tick < SAMPLE_EVERY) return;
  const shares: Record<string, number> = {};
  for (const id of st.labOrder) shares[id] = getWorldShare(st, s.pack, id);
  buffer = addSample(buffer, { tick: st.tick, shares });
}

/** The samples so far (oldest first). */
export function shareSamples(): readonly ShareSample[] {
  return buffer;
}

/** Keeps the sampler running while at least one component that needs it is mounted. */
export function useShareSampler(): void {
  useEffect(() => {
    users++;
    if (!unsubscribe) {
      sample(useGameStore.getState());
      unsubscribe = useGameStore.subscribe((s, prev) => {
        if (s.state !== prev.state) sample(s);
      });
    }
    return () => {
      users--;
      if (users === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  }, []);
}
