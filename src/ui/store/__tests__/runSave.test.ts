import { chooseAiActions, chooseEventChoice, applyAction, step, type ContentPack, type GameState } from '@/engine';

import { readValue, setStorageBackend, writeValue } from '../../tutorial/storage';
import { resetTutorialStore, useTutorialStore } from '../../tutorial/store';
import { useGameStore } from '../game';
import {
  autosaveTick,
  clearRunSave,
  hasCompletedRun,
  loadRunSave,
  makeRunSave,
  parseRunSave,
  restartSetup,
  restoreRun,
  RUN_SAVE_KEY,
  saveCurrentRun,
  setupOf,
  startAutosave,
} from '../runSave';

const SETUP = { playerName: 'Save Lab', founderId: 'researcher', homeRegion: 'canada', seed: 77, runLength: 'sprint' };

/** One tick of play the way the debug bot plays: resolve a card, act every 10 ticks, step. */
function playTick(s: GameState, pack: ContentPack): GameState {
  let next = s;
  if (next.pendingEvent) {
    const choice = chooseEventChoice(next, pack, next.playerLabId);
    const r = applyAction(next, pack, { type: 'resolveEvent', labId: next.playerLabId, choiceId: choice });
    if (r.ok) next = r.state;
  }
  if (next.tick % 10 === 0) {
    for (const action of chooseAiActions(next, pack, next.playerLabId)) {
      const r = applyAction(next, pack, action);
      if (r.ok) next = r.state;
    }
  }
  return step(next, pack);
}

function playN(s: GameState, pack: ContentPack, n: number): GameState {
  let next = s;
  for (let i = 0; i < n && next.status === 'running'; i++) next = playTick(next, pack);
  return next;
}

beforeEach(async () => {
  setStorageBackend(null);
  resetTutorialStore();
  useGameStore.getState().reset();
  await clearRunSave();
});

describe('run save', () => {
  it('save -> load -> the next 500 ticks match the uninterrupted run', async () => {
    useGameStore.getState().newGame(SETUP);
    const { pack } = useGameStore.getState();
    const at200 = playN(useGameStore.getState().state!, pack, 200);
    useGameStore.setState({ state: at200 });
    expect(await saveCurrentRun('test')).toBe(true);

    const uninterrupted = playN(at200, pack, 500);

    useGameStore.getState().reset();
    const save = await loadRunSave();
    expect(save).not.toBeNull();
    restoreRun(save!);
    const resumed = useGameStore.getState().state!;
    expect(resumed).toEqual(at200);
    expect(resumed).not.toBe(at200); // a real round trip through JSON
    expect(playN(resumed, pack, 500)).toEqual(uninterrupted);
  });

  it('keeps the setup, pack id and version, and the run length', async () => {
    useGameStore.getState().newGame(SETUP);
    const { state, pack } = useGameStore.getState();
    const save = makeRunSave(state, pack.version, null, 123)!;
    expect(save.packId).toBe(pack.id);
    expect(save.packVersion).toBe(pack.version);
    expect(save.savedAt).toBe(123);
    expect(save.setup).toMatchObject({ playerName: 'Save Lab', founderId: 'researcher', homeRegion: 'canada', seed: 77, runLength: 'sprint' });
    expect(save.state.runLength).toBe('sprint');
    expect(save.tutorialStep).toBeUndefined();
  });

  it('restart setup replays the same run from day one', () => {
    useGameStore.getState().newGame(SETUP);
    const first = useGameStore.getState().state!;
    const { pack } = useGameStore.getState();
    const later = playN(first, pack, 50);
    useGameStore.getState().newGame(restartSetup(later));
    expect(useGameStore.getState().state).toEqual(first);
    expect(setupOf(later).seed).toBe(77);
  });

  it('discards saves from another pack version, another format, junk and finished runs', async () => {
    useGameStore.getState().newGame(SETUP);
    const { state, pack } = useGameStore.getState();
    const good = makeRunSave(state, pack.version)!;
    expect(parseRunSave(JSON.stringify(good))).not.toBeNull();
    expect(parseRunSave(JSON.stringify({ ...good, packVersion: pack.version + 1 }))).toBeNull();
    expect(parseRunSave(JSON.stringify({ ...good, format: 99 }))).toBeNull();
    expect(parseRunSave(JSON.stringify({ ...good, packId: 'gone' }))).toBeNull();
    expect(parseRunSave(JSON.stringify({ ...good, state: { ...good.state, status: 'ended' } }))).toBeNull();
    expect(parseRunSave('{not json')).toBeNull();
    expect(parseRunSave(null)).toBeNull();

    await writeValue(RUN_SAVE_KEY, JSON.stringify({ ...good, packVersion: pack.version + 1 }));
    expect(await loadRunSave()).toBeNull();
    expect(await readValue(RUN_SAVE_KEY)).toBeNull(); // removed, not kept around
  });

  it('nothing is saved without a run in progress', async () => {
    expect(await saveCurrentRun('test')).toBe(false);
    expect(makeRunSave(null, 1)).toBeNull();
  });

  it('a run that ends clears the save and counts as completed', async () => {
    expect(await hasCompletedRun()).toBe(false);
    useGameStore.getState().newGame(SETUP);
    await saveCurrentRun('test');
    expect(await loadRunSave()).not.toBeNull();
    const s = useGameStore.getState().state!;
    useGameStore.setState({ state: { ...s, status: 'ended', ending: { endingId: 'x', kind: 'lose', trigger: 'banned', tick: s.tick, score: 0 } } });
    await new Promise((r) => setTimeout(r, 0));
    expect(await loadRunSave()).toBeNull();
    expect(await hasCompletedRun()).toBe(true);
  });

  it('stores the tutorial step while the tutorial runs in this run, and restores it', async () => {
    useGameStore.getState().newGame(SETUP);
    useTutorialStore.setState({ tutorial: { status: 'active', step: 3, dcBaseline: null, runSeed: 77 } });
    await saveCurrentRun('test');
    resetTutorialStore();
    useGameStore.getState().reset();
    restoreRun((await loadRunSave())!);
    expect(useTutorialStore.getState().tutorial).toMatchObject({ status: 'active', step: 3, runSeed: 77 });
  });

  it('autosave writes only when a tick has passed since the last save, on a timer', async () => {
    jest.useFakeTimers();
    try {
      useGameStore.getState().newGame(SETUP);
      const stop = startAutosave(1000);
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      jest.useRealTimers();
      await new Promise((r) => setTimeout(r, 0));
      const first = await readValue(RUN_SAVE_KEY);
      expect(parseRunSave(first)?.state.tick).toBe(0);
      // Same tick: nothing new is written.
      await writeValue(RUN_SAVE_KEY, 'sentinel');
      autosaveTick();
      await new Promise((r) => setTimeout(r, 0));
      expect(await readValue(RUN_SAVE_KEY)).toBe('sentinel');
      useGameStore.getState().tick();
      autosaveTick();
      await new Promise((r) => setTimeout(r, 0));
      expect(parseRunSave(await readValue(RUN_SAVE_KEY))?.state.tick).toBe(1);
      stop();
    } finally {
      jest.useRealTimers();
    }
  });
});
