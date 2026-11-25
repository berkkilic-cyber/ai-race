import {
  createAnalyticsSession,
  createMemoryProvider,
  DAY_MS,
  RETENTION_KEY,
  resetAnalytics,
  setAnalyticsClock,
  setAnalyticsProvider,
  track,
  type StorageAdapter,
  type Timers,
} from '..';

const T0 = Date.UTC(2026, 0, 5, 9);

function setup(stored?: Map<string, string>) {
  const map = stored ?? new Map<string, string>();
  const storage: StorageAdapter = { getItem: async (k) => map.get(k) ?? null, setItem: async (k, v) => void map.set(k, v) };
  const timers: Timers = { setTimeout: () => 1, clearTimeout: () => undefined };
  let now = T0;
  setAnalyticsClock(() => now);
  const mem = createMemoryProvider();
  setAnalyticsProvider(mem);
  const session = createAnalyticsSession({ storage, timers, random: () => 0.5 });
  return { map, mem, session, at: (t: number) => (now = t) };
}

beforeEach(() => resetAnalytics());

describe('analytics session', () => {
  it('first launch: creates the install, tracks app_open then session_start, saves once', async () => {
    const { map, mem, session } = setup();
    await session.start();
    expect(mem.events.map((e) => [e.name, e.s])).toEqual([
      ['app_open', 0],
      ['session_start', 1],
    ]);
    expect(session.state()?.installId).toBe('i-8888888888888888');
    expect(mem.userProps.installId).toBe('i-8888888888888888');
    expect(JSON.parse(map.get(RETENTION_KEY)!).sessions).toBe(1);
    expect(session.report()?.funnel[0].sinceInstall).toBe(0);
    session.dispose();
  });

  it('background past the resume window ends the session with its length and starts the next', async () => {
    const { mem, session, at } = setup();
    await session.start();
    at(T0 + 120_000);
    track({ name: 'garage_open' });
    session.background();
    at(T0 + 10 * 60_000);
    session.foreground();
    expect(mem.events.slice(-2).map((e) => [e.name, e.params, e.s])).toEqual([
      ['session_end', { seconds: 120 }, 1],
      ['session_start', {}, 2],
    ]);
    session.dispose();
  });

  it('the next launch on day 1 ends the old session and counts the return', async () => {
    const a = setup();
    await a.session.start();
    a.at(T0 + 60_000);
    track({ name: 'run_start', params: { founder: 'f', difficulty: 'd', homeRegion: 'r', daily: false } });
    await a.session.flush();
    a.session.dispose();

    resetAnalytics();
    const b = setup(a.map);
    b.at(T0 + DAY_MS);
    await b.session.start();
    expect(b.mem.events.map((e) => e.name)).toEqual(['app_open', 'session_end', 'session_start']);
    expect(b.mem.events[1].params).toEqual({ seconds: 60 });
    const rep = b.session.report()!;
    expect(rep.dayIndex).toBe(1);
    expect(rep.returned[1]).toBe(true);
    expect(rep.sessions).toBe(2);
    expect(rep.funnel.find((r) => r.step === 'run_start')?.sinceInstall).toBe(60);
    b.session.dispose();
  });

  it('events tracked before the install record loads still reach the funnel', async () => {
    const { session } = setup();
    track({ name: 'tutorial_step', params: { step: 1, id: 'home' } });
    await session.start();
    expect(session.report()?.funnel.find((r) => r.step === 'tutorial_start')?.at).toBe(T0);
    session.dispose();
  });
});
