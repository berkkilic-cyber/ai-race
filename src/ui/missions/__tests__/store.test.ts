import { createGame, type GameState } from '@/engine';
import { dailyRewardQuote, deserialize, labRepTotal, tap, type GarageContent } from '@/idle';

import { garageNow } from '../../garage/clock';
import { garageContent } from '../../garage/content';
import { SAVE_KEY as GARAGE_SAVE_KEY, useGarageStore } from '../../garage/store';
import { getPackEntry } from '../../packs';
import { useGameStore } from '../../store/game';
import { readValue, setStorageBackend } from '../../tutorial/storage';
import { EMPTY_STREAK, utcDay, type MissionsSave } from '../logic';
import { installMissions, noteRace, resetMissionsForTests, useMissionsStore } from '../store';

const content: GarageContent = garageContent();
const { pack } = getPackEntry();

/** A day with three fixed missions (a Garage one, a race one and an either-or). */
function today(extra: Partial<NonNullable<MissionsSave['today']>> = {}): MissionsSave {
  const fresh = deserialize(null, content, garageNow()).state;
  const base = { taps: fresh.stats.taps, bought: 0, happenings: 0, golden: 0, upgrades: 0, training: 0, incidents: 0, ships: 0 };
  return { v: 1, today: { day: utcDay(garageNow()), ids: ['tap-300', 'regions-5', 'ship-or-win'], base, garage: base, race: {}, done: [], claimed: [], crate: false, ...extra }, streak: EMPTY_STREAK };
}

describe('missions store', () => {
  beforeAll(() => setStorageBackend(null));
  beforeEach(() => {
    resetMissionsForTests();
    useGarageStore.setState({ state: null });
  });

  it('race actions and run endings feed the race counters and queue a toast on completion', () => {
    useMissionsStore.getState().replace(today());
    for (let i = 0; i < 4; i++) noteRace('regions', 1);
    expect(useMissionsStore.getState().toasts).toEqual([]);
    noteRace('regions', 1);
    const st = useMissionsStore.getState();
    expect(st.save.today!.done).toEqual(['regions-5']);
    expect(st.toasts.map((x) => x.id)).toEqual(['regions-5']);
    st.dismissToast(st.toasts[0].key);
    expect(useMissionsStore.getState().toasts).toEqual([]);
  });

  it('the Garage store feeds taps through the subscription (only when a counted stat changes)', () => {
    installMissions();
    useMissionsStore.getState().replace(today());
    let s = deserialize(null, content, garageNow()).state;
    useGarageStore.setState({ state: s });
    for (let i = 0; i < 300; i++) s = tap(s, content, s.now + i * 100).state;
    useGarageStore.setState({ state: s });
    expect(useMissionsStore.getState().save.today!.done).toContain('tap-300');
  });

  it('a finished run counts as a finish (and a sprint for the shortest length)', () => {
    installMissions();
    useMissionsStore.getState().replace(today({ ids: ['tap-300', 'sprint-1', 'races-2'] }));
    const running = createGame(pack, { playerName: 'M', founderId: 'researcher', homeRegion: 'canada', seed: 3, runLength: 'sprint' });
    useGameStore.setState({ state: running });
    const ended: GameState = { ...running, status: 'ended', ending: { endingId: 'x', kind: 'loss', score: 10, variantKey: 'x' } as unknown as GameState['ending'] };
    useGameStore.setState({ state: ended });
    const day = useMissionsStore.getState().save.today!;
    expect(day.race).toMatchObject({ raceFinish: 1, sprintFinish: 1 });
    expect(day.done).toEqual(['sprint-1']);
  });

  it('claiming grants the reward into the Garage save, starts the streak, and the crate opens once all three are claimed', async () => {
    useMissionsStore.getState().replace(today({ done: ['tap-300', 'regions-5', 'ship-or-win'] }));
    const before = deserialize(await readValue(GARAGE_SAVE_KEY), content, garageNow()).state;
    expect(await useMissionsStore.getState().claim('tap-300')).toBe(true);
    expect(await useMissionsStore.getState().claim('tap-300')).toBe(false);
    const after = deserialize(await readValue(GARAGE_SAVE_KEY), content, garageNow()).state;
    expect(after.tokens).toBeGreaterThan(before.tokens);
    expect(labRepTotal(after) - labRepTotal(before)).toBeCloseTo(content.missions!.reward.rep);
    expect(useMissionsStore.getState().save.streak).toMatchObject({ current: 1, best: 1 });
    expect(await useMissionsStore.getState().openCrate()).toBe(false);
    await useMissionsStore.getState().claim('regions-5');
    await useMissionsStore.getState().claim('ship-or-win');
    expect(useMissionsStore.getState().save.streak.current).toBe(1);
    const q = dailyRewardQuote(deserialize(await readValue(GARAGE_SAVE_KEY), content, garageNow()).state, content, 'crate', { streak: 1 });
    expect(q.streakMult).toBeCloseTo(1 + content.missions!.crate.streakBonus);
    expect(await useMissionsStore.getState().openCrate()).toBe(true);
    expect(await useMissionsStore.getState().openCrate()).toBe(false);
    expect(useMissionsStore.getState().save.today!.crate).toBe(true);
  });

  it('claims into the open Garage when it is loaded', async () => {
    const open = deserialize(null, content, garageNow()).state;
    useGarageStore.setState({ state: open });
    useMissionsStore.getState().replace(today({ done: ['tap-300'] }));
    await useMissionsStore.getState().claim('tap-300');
    expect(useGarageStore.getState().state!.tokens).toBeGreaterThan(open.tokens);
  });

  it('a new UTC day picks a fresh set from the player\'s progress', async () => {
    useMissionsStore.getState().replace({ ...today(), today: { ...today().today!, day: 1 } });
    await useMissionsStore.getState().ensureDay();
    const day = useMissionsStore.getState().save.today!;
    expect(day.day).toBe(utcDay(garageNow()));
    expect(day.ids).toHaveLength(3);
    expect(day.claimed).toEqual([]);
  });
});
