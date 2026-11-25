import { createMemoryProvider, resetAnalytics, setAnalyticsProvider, type MemoryProvider } from '@/analytics';
import { advance, deserialize } from '@/idle';

import { garageNow } from '../../garage/clock';
import { garageContent } from '../../garage/content';
import { useGarageStore } from '../../garage/store';
import { EMPTY_STREAK, utcDay } from '../../missions/logic';
import { resetMissionsForTests, useMissionsStore } from '../../missions/store';
import { setStorageBackend } from '../../tutorial/storage';
import { subscribeHabits } from '../habits';

const content = garageContent();
const HOUR = 3_600_000;
let mem: MemoryProvider;
let off: () => void;

beforeAll(() => setStorageBackend(null));
beforeEach(() => {
  resetAnalytics();
  resetMissionsForTests();
  mem = createMemoryProvider(100);
  setAnalyticsProvider(mem);
  useGarageStore.setState({ state: null });
  off = subscribeHabits();
});
afterEach(() => off());

const names = () => mem.events.map((e) => e.name);

describe('habits analytics', () => {
  it('away_return once per return, with the hours, the cap and the capacity; ticks send nothing', () => {
    const s = { ...deserialize(null, content, garageNow()).state, generators: { intern: 5 } };
    useGarageStore.setState({ state: s });
    for (let i = 1; i <= 20; i++) useGarageStore.setState({ state: advance(useGarageStore.getState().state!, content, s.now + i * 250) });
    expect(names()).toEqual([]);
    const back = advance(useGarageStore.getState().state!, content, s.now + 5 * HOUR);
    useGarageStore.setState({ state: back });
    expect(mem.events).toHaveLength(1);
    expect(mem.events[0]).toMatchObject({ name: 'away_return', params: { capped: true, capacityHours: 2 } });
    expect(mem.events[0].params!.hoursAway).toBeCloseTo(5, 0);
    useGarageStore.setState({ state: advance(back, content, back.now + 250) });
    expect(mem.events).toHaveLength(1);
  });

  it('mission_complete, mission_claim, daily_crate_claim and streak_day on their changes', () => {
    const day = utcDay(garageNow());
    const base = { taps: 0, bought: 0, happenings: 0, golden: 0, upgrades: 0, training: 0, incidents: 0, ships: 0 };
    const today = { day, ids: ['a', 'b', 'c'], base, garage: base, race: {}, done: [], claimed: [], crate: false };
    useMissionsStore.setState({ loaded: true, save: { v: 1, today, streak: EMPTY_STREAK } });
    useMissionsStore.setState({ save: { v: 1, today: { ...today, done: ['a'] }, streak: EMPTY_STREAK } });
    useMissionsStore.setState({ save: { v: 1, today: { ...today, done: ['a'], claimed: ['a'] }, streak: { ...EMPTY_STREAK, current: 2, best: 2, lastDay: day } }, lastUsedDayOff: true });
    useMissionsStore.setState({ save: { v: 1, today: { ...today, done: ['a'], claimed: ['a'], crate: true }, streak: { ...EMPTY_STREAK, current: 2, best: 2, lastDay: day } } });
    expect(mem.events.map((e) => [e.name, e.params])).toEqual([
      ['mission_complete', { id: 'a' }],
      ['mission_claim', { id: 'a' }],
      ['streak_day', { streak: 2, usedDayOff: true }],
      ['daily_crate_claim', { streak: 2 }],
    ]);
  });
});
