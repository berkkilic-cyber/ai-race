import { runHeadless } from '@/engine';

import { getPackEntry } from '../../packs';
import { useGameStore } from '../../store/game';
import { restartSetup } from '../../store/runSave';
import { setStorageBackend } from '../../tutorial/storage';
import { dailyGameSetup, emptyRecord, streakOf } from '../logic';
import { abandonScoredDaily, asPractice, isScoredDailyRun, onDailyEvent, startDaily, todaysDaily, useDailyStore } from '../store';

const { pack } = getPackEntry();

beforeEach(() => {
  setStorageBackend(null);
  useDailyStore.setState({ record: emptyRecord(), loaded: true });
  useDailyStore.getState().setToday('2026-11-25');
  useGameStore.getState().reset();
});

/** Ends the store's run with a headless bot playing the same setup. */
function finishStoreRun(): void {
  const { setup } = useGameStore.getState();
  const ended = runHeadless(pack, setup!, { policy: 'sensible', maxTicks: 6000 });
  useGameStore.setState({ state: ended });
}

describe('daily store', () => {
  it('starts the scored attempt once; a second start that day is practice', () => {
    const events: string[] = [];
    const off = onDailyEvent((e) => events.push(e.type));
    expect(startDaily(pack, 'Store Lab', true)).toBe(true);
    const { setup, state } = useGameStore.getState();
    const def = todaysDaily(pack)!;
    expect(setup?.daily).toEqual({ key: '2026-11-25', number: def.number, scored: true });
    expect(setup?.perksOn).toBe(false);
    expect(state?.seed).toBe(def.seed);
    expect(isScoredDailyRun()).toBe(true);
    expect(startDaily(pack, 'Store Lab', true)).toBe(false);
    expect(useGameStore.getState().setup?.daily?.scored).toBe(false);
    off();
    expect(events).toEqual(['start']);
  });

  it('records the result when the scored run ends, with the streak, once', () => {
    const ends: number[] = [];
    const off = onDailyEvent((e) => e.type === 'end' && ends.push(e.streak));
    startDaily(pack, 'Store Lab', true);
    finishStoreRun();
    const record = useDailyStore.getState().record;
    expect(record.started).toBeNull();
    expect(record.history).toHaveLength(1);
    expect(record.history[0]).toMatchObject({ key: '2026-11-25', ending: useGameStore.getState().state!.ending!.endingId });
    expect(record.history[0].race).toMatch(/^[YR.]{5}$/);
    expect(streakOf(record, '2026-11-25').current).toBe(1);
    expect(ends).toEqual([1]);
    // Practice of the same day changes nothing.
    startDaily(pack, 'Store Lab', false);
    finishStoreRun();
    expect(useDailyStore.getState().record.history).toHaveLength(1);
    off();
  });

  it('Restart and Rematch of a scored daily are practice; abandoning counts as played', () => {
    startDaily(pack, 'Store Lab', true);
    const replay = asPractice(restartSetup(useGameStore.getState().state!));
    expect(replay.daily?.scored).toBe(false);
    expect(replay.seed).toBe(todaysDaily(pack)!.seed);
    abandonScoredDaily();
    const record = useDailyStore.getState().record;
    expect(record.history[0]).toMatchObject({ ending: null, score: 0 });
    expect(streakOf(record, '2026-11-25').current).toBe(1);
  });

  it('builds the same engine setup as the pure function (twist bonus kept, perks off)', () => {
    startDaily(pack, 'Store Lab', true);
    const def = todaysDaily(pack)!;
    const { setup } = useGameStore.getState();
    const expected = dailyGameSetup(def, 'Store Lab');
    expect(setup?.bonus).toEqual(expected.bonus);
    expect(setup?.rivalIds).toEqual(expected.rivalIds);
    expect(setup?.runLength).toBe('sprint');
  });
});
