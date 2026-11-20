/** Test helpers shared by the engine test suites. */
import { applyAction, createGame, step } from '../index';
import type { Action, ContentPack, GameSetup, GameState, LabState } from '../types';
import { testPack, testSetup } from './testPack';

/** Recursively freezes an object so any mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The test pack without events, headlines, rivals or achievements, for isolating one rule. */
export function quietPack(overrides: Partial<ContentPack> = {}): ContentPack {
  return { ...testPack, events: [], headlines: [], rivals: [], achievements: [], ...overrides };
}

/** A pack whose balance overrides the defaults. */
export function withBalance(pack: ContentPack, balance: ContentPack['balance']): ContentPack {
  return { ...pack, balance: { ...pack.balance, ...balance } };
}

export function newGame(pack: ContentPack = testPack, setup: Partial<GameSetup> = {}): GameState {
  return createGame(pack, { ...testSetup, ...setup });
}

/** A copy of `state` with one lab changed by `edit`. */
export function editLab(state: GameState, labId: string, edit: (lab: LabState) => void): GameState {
  const copy = clone(state);
  edit(copy.labs[labId]);
  return copy;
}

export function edit(state: GameState, change: (state: GameState) => void): GameState {
  const copy = clone(state);
  change(copy);
  return copy;
}

export function stepN(state: GameState, pack: ContentPack, ticks: number): GameState {
  let current = state;
  for (let i = 0; i < ticks; i++) current = step(current, pack);
  return current;
}

/** Applies an action that must succeed. */
export function mustApply(state: GameState, pack: ContentPack, action: Action): GameState {
  const result = applyAction(state, pack, action);
  if (!result.ok) throw new Error(`Action ${action.type} failed: ${result.reason}`);
  return result.state;
}

export function failureOf(state: GameState, pack: ContentPack, action: Action): string | undefined {
  const result = applyAction(state, pack, action);
  return result.ok ? undefined : result.reason;
}

export function totalAdoptionIn(state: GameState, regionId: string): number {
  return state.labOrder.reduce((sum, id) => sum + (state.labs[id].adoption[regionId] ?? 0), 0);
}

export const PLAYER = 'player';
