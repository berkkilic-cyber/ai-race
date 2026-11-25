/**
 * Demo mode: the free browser demo (itch.io) is the normal game built with
 * `EXPO_PUBLIC_DEMO=1` (`npm run demo`). This file is the ONE place that reads the variable;
 * every other file asks `isDemo()` or the helpers in this folder.
 *
 * What the demo offers (everything else stays visible with an "In the full game" note):
 * - the race on the shortest run length (Sprint) and the two easiest difficulty levels;
 * - the first two Garage stages.
 *
 * Without the variable every helper here is a no-op and the build is the full game.
 */
import { getDifficulties, getRunLengths, type ContentPack } from '@/engine';

/** Inlined by the bundler at build time (EXPO_PUBLIC_ variables are). */
const DEMO_ON = process.env.EXPO_PUBLIC_DEMO === '1';

/** True in the demo build. */
export function isDemo(): boolean {
  return DEMO_ON;
}

/** How much of each list the demo offers, counted from the start (easiest / shortest / first). */
export const DEMO_LIMITS = {
  /** Difficulty levels, easiest first. */
  difficulty: 2,
  /** Run lengths, shortest first. */
  runLength: 1,
  /** Garage stages, first first. */
  garageStage: 2,
} as const;

/** Things the demo can lock (also the `feature` of the demo_gate_seen event). */
export type DemoFeature = 'difficulty' | 'runLength' | 'garageStage';

/** The ids the demo offers for a pack list, in pack order. */
export function demoAllowedIds(kind: 'difficulty' | 'runLength', pack: ContentPack): string[] {
  const list = kind === 'difficulty' ? getDifficulties(pack) : getRunLengths(pack);
  return list.slice(0, DEMO_LIMITS[kind]).map((d) => d.id);
}

/**
 * True when `id` is outside the demo. `on` is the build flag (a parameter so tests can check
 * both builds). Unknown ids are not locked: the engine falls back on its own.
 */
export function isLockedInDemo(kind: 'difficulty' | 'runLength', id: string | undefined, pack: ContentPack, on: boolean = DEMO_ON): boolean {
  if (!on || id === undefined) return false;
  const list = kind === 'difficulty' ? getDifficulties(pack) : getRunLengths(pack);
  const index = list.findIndex((d) => d.id === id);
  return index >= DEMO_LIMITS[kind];
}

/** True when the Garage stage at `index` (0-based) is outside the demo. */
export function isStageLockedInDemo(index: number, on: boolean = DEMO_ON): boolean {
  return on && index >= DEMO_LIMITS.garageStage;
}

/**
 * The id to preselect: `id` itself when the demo offers it, else the demo's last offered one
 * (the hardest level / longest length still in the demo). Unchanged outside the demo.
 */
export function demoClamp(kind: 'difficulty' | 'runLength', pack: ContentPack, id: string | undefined, on: boolean = DEMO_ON): string | undefined {
  if (!isLockedInDemo(kind, id, pack, on)) return id;
  const allowed = demoAllowedIds(kind, pack);
  return allowed[allowed.length - 1] ?? id;
}
