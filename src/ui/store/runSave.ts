/**
 * Saving and resuming the current run. The engine state is plain serialisable data with the
 * random generator inside it, so a run is saved as its state plus the setup and pack it was
 * started with, and resumes exactly where it stopped (the next ticks are the same as if it had
 * never been interrupted).
 *
 * When: the app goes to the background, the run menu's "Save and quit", and every
 * AUTOSAVE_INTERVAL_MS of play (a timer, never per tick; it does nothing when no tick passed).
 * A run that has ended clears the save and counts as a completed run. A save from another pack
 * version (or one that no longer parses) is discarded.
 *
 * Storage goes through the shared key-value helper (AsyncStorage, memory fallback).
 */
import { AppState } from 'react-native';

import type { GameSetup, GameState } from '@/engine';

import { logLifecycle } from '../diagnostics/log';
import { getPackEntry } from '../packs';
import { readValue, writeValue } from '../tutorial/storage';
import { useTutorialStore } from '../tutorial/store';
import { useGameStore, type NewGameSetup } from './game';

/** Storage key of the saved run. */
export const RUN_SAVE_KEY = 'ai-race.run.v1';
/** Storage key of the number of runs the player has finished (any ending). */
export const RUNS_COMPLETED_KEY = 'ai-race.runs.completed.v1';
/** Save format version; a save with another one is discarded. */
export const RUN_SAVE_FORMAT = 1;
/** Autosave period while a run is on screen. */
export const AUTOSAVE_INTERVAL_MS = 20_000;

export interface RunSave {
  format: number;
  packId: string;
  packVersion: number;
  /** Date.now() when written. */
  savedAt: number;
  /** What the run was started with (Restart and Rematch replay it). */
  setup: GameSetup;
  state: GameState;
  /** The tutorial step to continue at, when the tutorial was running in this run. */
  tutorialStep?: number;
}

/** The setup a run was started with, read back from its state (same seed). */
export function setupOf(state: GameState): GameSetup {
  const player = state.labs[state.playerLabId];
  const rivalIds = state.labOrder.filter((id) => id !== state.playerLabId);
  return {
    playerName: player.name,
    founderId: player.founderId ?? '',
    homeRegion: player.homeRegion,
    seed: state.seed,
    rivalIds,
    ...(state.difficulty !== undefined ? { difficulty: state.difficulty } : {}),
    ...(state.runLength !== undefined ? { runLength: state.runLength } : {}),
  };
}

/** The same run again from day one: same seed, same setup and pack. */
export function restartSetup(state: GameState): NewGameSetup {
  return { ...setupOf(state), packId: state.packId };
}

/** A save record for a run in progress, or null when there is nothing worth saving. */
export function makeRunSave(state: GameState | null, packVersion: number, tutorialStep?: number | null, now: number = Date.now()): RunSave | null {
  if (!state || state.status !== 'running') return null;
  return {
    format: RUN_SAVE_FORMAT,
    packId: state.packId,
    packVersion,
    savedAt: now,
    setup: setupOf(state),
    state,
    ...(tutorialStep !== null && tutorialStep !== undefined ? { tutorialStep } : {}),
  };
}

/**
 * Parses stored text into a save that can be resumed with the packs this build has, or null:
 * not JSON, another format, an unknown pack, another pack version, or a run that is not in
 * progress.
 */
export function parseRunSave(text: string | null): RunSave | null {
  if (!text) return null;
  let save: RunSave;
  try {
    save = JSON.parse(text) as RunSave;
  } catch {
    return null;
  }
  if (!save || typeof save !== 'object' || save.format !== RUN_SAVE_FORMAT) return null;
  const state = save.state;
  if (!state || typeof state !== 'object' || state.status !== 'running' || typeof state.tick !== 'number' || !state.labs?.[state.playerLabId]) return null;
  let version: number;
  try {
    version = getPackEntry(save.packId).pack.version;
  } catch {
    return null;
  }
  if (save.packVersion !== version || state.packId !== save.packId) return null;
  return save;
}

/** The saved run, or null. A save that cannot be resumed is removed. */
export async function loadRunSave(): Promise<RunSave | null> {
  const text = await readValue(RUN_SAVE_KEY).catch(() => null);
  const save = parseRunSave(text);
  if (text && !save) {
    logLifecycle('run save discarded', {});
    await clearRunSave();
  }
  return save;
}

export async function clearRunSave(): Promise<void> {
  lastSavedTick = null;
  await writeValue(RUN_SAVE_KEY, null).catch(() => undefined);
}

/** The tutorial step to store with the run: only while the tutorial runs in this run. */
function tutorialStepFor(state: GameState): number | null {
  const tutorial = useTutorialStore.getState().tutorial;
  return tutorial.status === 'active' && (tutorial.runSeed === null || tutorial.runSeed === state.seed) ? tutorial.step : null;
}

let lastSavedTick: number | null = null;

/** Saves the store's run now (no-op without a run in progress). Resolves when written. */
export async function saveCurrentRun(reason: string): Promise<boolean> {
  const { state, pack } = useGameStore.getState();
  const save = makeRunSave(state, pack.version, state ? tutorialStepFor(state) : null);
  if (!save) return false;
  lastSavedTick = save.state.tick;
  await writeValue(RUN_SAVE_KEY, JSON.stringify(save)).catch(() => undefined);
  logLifecycle('run saved', { reason, day: save.state.tick + 1 });
  return true;
}

/** Autosave timer step: saves only when at least one tick passed since the last save. */
export function autosaveTick(): void {
  const state = useGameStore.getState().state;
  if (!state || state.status !== 'running' || state.tick === lastSavedTick) return;
  void saveCurrentRun('interval');
}

/**
 * Puts a saved run back into the store, paused at 1x-ready (speed 1 after the caller
 * navigates), and the tutorial at its step when it was running in that run.
 */
export function restoreRun(save: RunSave): void {
  const { pack } = getPackEntry(save.packId);
  useGameStore.setState({ packId: save.packId, pack, state: save.state, speed: 1, eventResult: null });
  lastSavedTick = save.state.tick;
  if (save.tutorialStep !== undefined) {
    useTutorialStore.setState({ tutorial: { status: 'active', step: save.tutorialStep, dcBaseline: null, runSeed: save.state.seed } });
  }
  logLifecycle('run resumed', { day: save.state.tick + 1 });
}

/** True once the player has finished at least one run (any ending). */
export async function hasCompletedRun(): Promise<boolean> {
  const text = await readValue(RUNS_COMPLETED_KEY).catch(() => null);
  return Number(text) > 0;
}

async function countCompletedRun(): Promise<void> {
  const text = await readValue(RUNS_COMPLETED_KEY).catch(() => null);
  const n = Number(text);
  await writeValue(RUNS_COMPLETED_KEY, String((Number.isFinite(n) ? n : 0) + 1)).catch(() => undefined);
}

// A run that ends clears the save and counts as completed.
useGameStore.subscribe((s, prev) => {
  if (s.state?.status === 'ended' && prev.state?.status !== 'ended' && s.state !== prev.state) {
    void clearRunSave();
    void countCompletedRun();
  }
});

/**
 * Starts the autosave while the race screen is mounted: on going to the background and on a
 * timer. Returns the cleanup.
 */
export function startAutosave(intervalMs: number = AUTOSAVE_INTERVAL_MS): () => void {
  const timer = setInterval(autosaveTick, intervalMs);
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'background' || next === 'inactive') void saveCurrentRun('background');
  });
  // Web: a closed or reloaded tab never reports "background"; pagehide still fires.
  const onHide = () => void saveCurrentRun('pagehide');
  const win = typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
  win?.addEventListener('pagehide', onHide);
  return () => {
    clearInterval(timer);
    sub.remove();
    win?.removeEventListener('pagehide', onHide);
  };
}
