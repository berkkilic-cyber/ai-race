import {
  appBackgrounded,
  appForegrounded,
  appStarted,
  createRetention,
  dayIndex,
  DAY_MS,
  localDay,
  newInstallId,
  parseRetention,
  reduceEvent,
  retentionReport,
  SESSION_RESUME_MS,
  type RetentionState,
  type TrackedEvent,
} from '..';

/** 2026-01-05 00:00 UTC. */
const T0 = Date.UTC(2026, 0, 5);
const H = 3_600_000;
const ev = (name: TrackedEvent['name'], t: number, params: TrackedEvent['params'] = {}): TrackedEvent => ({ name, params, t, s: 1 });

/** A session from `start` lasting `minutes`, then the app goes to the background for good. */
function session(s: RetentionState, start: number, minutes: number): RetentionState {
  const fg = appForegrounded(s, start, 0).state;
  return appBackgrounded(fg, start + minutes * 60_000);
}

describe('install and days', () => {
  it('makes a random hex install id from the random source', () => {
    let i = 0;
    const seq = [0, 0.5, 0.99, 0.0625];
    const id = newInstallId(() => seq[i++ % seq.length]);
    expect(id).toMatch(/^i-[0-9a-f]{16}$/);
    expect(id.slice(2, 6)).toBe('08f1');
    expect(newInstallId(Math.random)).not.toBe(newInstallId(Math.random));
  });

  it('counts local calendar days, honouring the timezone offset', () => {
    expect(localDay(T0, 0)).toBe(localDay(T0 + DAY_MS - 1, 0));
    expect(localDay(T0 + DAY_MS, 0)).toBe(localDay(T0, 0) + 1);
    // 23:30 UTC on day 0 is already the next day at UTC+1 (offset -60).
    expect(localDay(T0 + 23.5 * H, -60)).toBe(localDay(T0, 0) + 1);
    // 00:30 UTC is still the previous day at UTC-5 (offset 300).
    expect(localDay(T0 + 0.5 * H, 300)).toBe(localDay(T0, 0) - 1);
  });

  it('day index: install day is D0, the next local day D1, even a few hours later', () => {
    const s = createRetention('i-x', T0 + 22 * H, 0);
    expect(dayIndex(s, T0 + 23 * H, 0)).toBe(0);
    expect(dayIndex(s, T0 + 25 * H, 0)).toBe(1);
    expect(dayIndex(s, T0 + 7 * DAY_MS + H, 0)).toBe(7);
  });
});

describe('sessions', () => {
  it('starts session 1 on launch', () => {
    const r = appStarted(createRetention('i-x', T0, 0), T0, 0);
    expect(r.started).toBe(1);
    expect(r.ended).toBeNull();
    expect(r.state.days[0].sessions).toBe(1);
  });

  it('a short trip to the background keeps the session; a long one ends it and starts another', () => {
    let s = appStarted(createRetention('i-x', T0, 0), T0, 0).state;
    s = appBackgrounded(s, T0 + 60_000);
    let r = appForegrounded(s, T0 + 60_000 + SESSION_RESUME_MS, 0);
    expect(r.started).toBeNull();
    expect(r.ended).toBeNull();
    s = appBackgrounded(r.state, T0 + 10 * 60_000);
    r = appForegrounded(s, T0 + 10 * 60_000 + SESSION_RESUME_MS + 1, 0);
    expect(r.ended).toEqual({ n: 1, seconds: 600 });
    expect(r.started).toBe(2);
    expect(r.state.days[0]).toEqual({ sessions: 2, closed: 1, seconds: 600 });
  });

  it('foreground without a background is a no-op', () => {
    const s = appStarted(createRetention('i-x', T0, 0), T0, 0).state;
    expect(appForegrounded(s, T0 + 5000, 0).state).toBe(s);
  });

  it('a session left open by a killed app ends at its last use on the next launch', () => {
    let s = appStarted(createRetention('i-x', T0, 0), T0, 0).state;
    s = reduceEvent(s, ev('node_buy', T0 + 90_000));
    const r = appStarted(s, T0 + 5 * H, 0);
    expect(r.ended).toEqual({ n: 1, seconds: 90 });
    expect(r.started).toBe(2);
  });

  it('measures session length from start to background', () => {
    let s = createRetention('i-x', T0, 0);
    s = session(s, T0 + H, 4);
    s = session(s, T0 + 2 * H, 6);
    s = appStarted(s, T0 + 3 * H, 0).state;
    const rep = retentionReport(s, T0 + 3 * H + 30_000, 0);
    expect(rep.recent).toEqual([240, 360]);
    expect(rep.avgSessionSeconds).toBe(300);
    expect(rep.currentSessionSeconds).toBe(30);
  });
});

describe('retention report', () => {
  it('D1 / D7 / D30: null while ahead, then true on a session that day, false otherwise', () => {
    let s = createRetention('i-x', T0 + 10 * H, 0);
    s = session(s, T0 + 10 * H, 5);
    let rep = retentionReport(s, T0 + 11 * H, 0);
    expect(rep.dayIndex).toBe(0);
    expect(rep.returned).toEqual({ 1: null, 7: null, 30: null });

    s = session(s, T0 + DAY_MS + 9 * H, 5); // D1
    s = session(s, T0 + 3 * DAY_MS, 5); // D3 counts for nothing
    rep = retentionReport(s, T0 + 8 * DAY_MS, 0);
    expect(rep.dayIndex).toBe(8);
    expect(rep.returned).toEqual({ 1: true, 7: false, 30: null });
    expect(rep.activeDays).toBe(3);

    s = session(s, T0 + 30 * DAY_MS + H, 5); // D30
    rep = retentionReport(s, T0 + 31 * DAY_MS, 0);
    expect(rep.returned).toEqual({ 1: true, 7: false, 30: true });
  });

  it('sessions today and sessions per active day', () => {
    let s = createRetention('i-x', T0, 0);
    for (let i = 0; i < 3; i++) s = session(s, T0 + i * H, 1);
    s = session(s, T0 + DAY_MS + H, 1);
    const rep = retentionReport(s, T0 + DAY_MS + 2 * H, 0);
    expect(rep.sessions).toBe(4);
    expect(rep.sessionsToday).toBe(1);
    expect(rep.sessionsPerDay).toBe(2);
  });

  it('records the first time of each funnel step only', () => {
    let s = appStarted(createRetention('i-x', T0, 0), T0, 0).state;
    s = reduceEvent(s, ev('app_open', T0));
    s = reduceEvent(s, ev('tutorial_step', T0 + 5000, { step: 2, id: 'strip' }));
    s = reduceEvent(s, ev('tutorial_step', T0 + 10_000, { step: 1, id: 'home' }));
    s = reduceEvent(s, ev('run_start', T0 + 8000));
    s = reduceEvent(s, ev('tutorial_complete', T0 + 120_000));
    s = reduceEvent(s, ev('run_end', T0 + 1_500_000));
    s = reduceEvent(s, ev('run_start', T0 + 1_600_000));
    const rows = retentionReport(s, T0 + 1_700_000, 0).funnel;
    expect(rows.map((r) => [r.step, r.sinceInstall])).toEqual([
      ['app_open', 0],
      ['tutorial_start', 10],
      ['tutorial_complete', 120],
      ['run_start', 8],
      ['run_end', 1500],
    ]);
  });

  it('reduceEvent returns the same state when nothing changes', () => {
    const s = createRetention('i-x', T0, 0);
    expect(reduceEvent(s, ev('node_buy', T0))).toBe(s);
  });

  it('round-trips through storage and rejects foreign data', () => {
    let s = createRetention('i-x', T0, 0);
    s = session(s, T0, 3);
    s = reduceEvent(s, ev('app_open', T0));
    expect(parseRetention(JSON.stringify(s))).toEqual(s);
    expect(parseRetention(null)).toBeNull();
    expect(parseRetention('{"v":2}')).toBeNull();
    expect(parseRetention('nope')).toBeNull();
  });
});
