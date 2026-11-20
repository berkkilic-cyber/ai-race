import {
  applyAction,
  canApply,
  chooseAiActions,
  createGame,
  getCapabilityLevel,
  getIncome,
  getMeters,
  getWorldShare,
  runHeadless,
  step,
  type Action,
  type GameState,
} from '@/engine';
import { deepFreeze, PLAYER } from '../__fixtures__/helpers';
import { testPack, testSetup } from '../__fixtures__/testPack';

/** Plays `ticks` ticks through the public API with a fixed action script and the AI resolving events. */
function playScripted(seed: number, ticks: number): GameState {
  let state = createGame(testPack, { ...testSetup, seed });
  const script: Record<number, Action> = {
    1: { type: 'buyNode', labId: PLAYER, nodeId: 'c1' },
    2: { type: 'buildDataCentre', labId: PLAYER, regionId: 'north' },
    50: { type: 'buyNode', labId: PLAYER, nodeId: 'r1' },
  };
  for (let t = 0; t < ticks; t++) {
    const scripted = script[state.tick];
    if (scripted) {
      const result = applyAction(state, testPack, scripted);
      if (result.ok) state = result.state;
    }
    if (state.pendingEvent) {
      for (const action of chooseAiActions(state, testPack, PLAYER)) {
        const result = applyAction(state, testPack, action);
        if (result.ok) state = result.state;
      }
    }
    state = step(state, testPack);
  }
  return state;
}

describe('determinism', () => {
  it('same seed and same actions give deep-equal states', () => {
    expect(playScripted(5, 600)).toEqual(playScripted(5, 600));
  });

  it('different seeds give different runs', () => {
    expect(playScripted(5, 600)).not.toEqual(playScripted(6, 600));
  });

  it('runHeadless is deterministic', () => {
    const opts = { policy: 'sensible' as const, maxTicks: 1500 };
    expect(runHeadless(testPack, { ...testSetup, seed: 3 }, opts)).toEqual(runHeadless(testPack, { ...testSetup, seed: 3 }, opts));
  });

  it('runHeadless (in-place fast path) matches playing through the public API', () => {
    const maxTicks = 900;
    const headless = runHeadless(testPack, { ...testSetup, seed: 11 }, { policy: 'sensible', maxTicks });
    let state = createGame(testPack, { ...testSetup, seed: 11 });
    while (state.status === 'running' && state.tick < maxTicks) {
      if (state.pendingEvent || state.tick % 10 === 0) {
        for (const action of chooseAiActions(state, testPack, PLAYER)) {
          const result = applyAction(state, testPack, action);
          if (result.ok) state = result.state;
        }
      }
      state = step(state, testPack);
    }
    expect(state).toEqual(headless);
  });
});

describe('immutability', () => {
  it('step, applyAction, canApply and selectors never mutate their input', () => {
    let state = createGame(testPack, testSetup);
    for (let i = 0; i < 300; i++) {
      const frozen = deepFreeze(state);
      if (frozen.pendingEvent) {
        const [action] = chooseAiActions(frozen, testPack, PLAYER);
        canApply(frozen, testPack, action);
        const result = applyAction(frozen, testPack, action);
        state = result.ok ? result.state : frozen;
        continue;
      }
      getMeters(frozen, PLAYER);
      getIncome(frozen, testPack, PLAYER);
      getWorldShare(frozen, testPack, PLAYER);
      getCapabilityLevel(frozen, testPack, PLAYER);
      const bought = applyAction(frozen, testPack, { type: 'buyNode', labId: PLAYER, nodeId: 'c1' });
      state = step(bought.ok ? bought.state : frozen, testPack);
    }
    expect(state.tick).toBeGreaterThan(0);
  });

  it('createGame and runHeadless do not mutate the pack', () => {
    const pack = deepFreeze(JSON.parse(JSON.stringify(testPack)) as typeof testPack);
    expect(() => runHeadless(pack, testSetup, { policy: 'sensible', maxTicks: 500 })).not.toThrow();
  });

  it('step returns the same object when the game has ended or an event is pending', () => {
    const state = createGame(testPack, testSetup);
    const ended = { ...state, status: 'ended' as const };
    expect(step(ended, testPack)).toBe(ended);
    const pending = { ...state, pendingEvent: { eventId: 'press', labId: PLAYER } };
    expect(step(pending, testPack)).toBe(pending);
  });
});
