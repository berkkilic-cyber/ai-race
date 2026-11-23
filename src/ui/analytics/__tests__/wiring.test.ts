import { analyticsErrors, resetAnalytics, type StorageAdapter, type TrackedEvent } from '@/analytics';
import { chooseAiActions, chooseEventChoice } from '@/engine';

import { useAdStore } from '../../ads/store';
import { logError } from '../../diagnostics/log';
import { useGarageStore } from '../../garage/store';
import { useGameStore } from '../../store/game';
import { setStorageBackend } from '../../tutorial/storage';
import { resetTutorialStore, useTutorialStore } from '../../tutorial/store';
import { STEPS } from '../../tutorial/machine';
import { routeEvents } from '../AnalyticsRoot';
import { eventLine, fmtSeconds, summaryLines } from '../AnalyticsDebugSection';
import { getAnalyticsRuntime, installAnalytics, type AnalyticsRuntime } from '../install';
import { flushTaps, resetSubscriptionState } from '../subscriptions';

const SETUP = { playerName: 'Secret Player Name', founderId: 'researcher', homeRegion: 'canada', seed: 42 };

let writes: string[] = [];
const map = new Map<string, string>();
const storage: StorageAdapter = {
  getItem: async (k) => map.get(k) ?? null,
  setItem: async (k, v) => {
    writes.push(k);
    map.set(k, v);
  },
};

let rt: AnalyticsRuntime;
const names = () => rt.memory.events.map((e) => e.name);
const last = (name: TrackedEvent['name']) => [...rt.memory.events].reverse().find((e) => e.name === name);
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  getAnalyticsRuntime()?.dispose();
  resetAnalytics();
  resetSubscriptionState();
  setStorageBackend(null);
  map.clear();
  writes = [];
  useGameStore.getState().reset();
  rt = installAnalytics({ storage, console: false });
  await settle();
  await settle();
  rt.memory.clear();
});

afterEach(async () => {
  await rt.flush();
  resetSubscriptionState();
});

afterAll(() => getAnalyticsRuntime()?.dispose());

describe('analytics wiring', () => {
  it('starts a session on install: app_open and session_start, user props without personal data', async () => {
    await rt.flush();
    getAnalyticsRuntime()?.dispose();
    resetAnalytics();
    map.clear();
    rt = installAnalytics({ storage, console: false });
    await settle();
    await settle();
    expect(names()).toEqual(['app_open', 'session_start']);
    const props = rt.memory.userProps;
    expect(Object.keys(props).sort()).toEqual(['build', 'installId', 'locale', 'platform', 'theme']);
    expect(props.installId).toMatch(/^i-[0-9a-f]{16}$/);
  });

  it('1,000 game ticks produce no events and no storage writes', async () => {
    useGameStore.getState().newGame(SETUP);
    const s = useGameStore.getState().state!;
    // Keep event cards away so the ticks are only ticks.
    useGameStore.setState({ state: { ...s, nextEventTick: 1e9 } });
    await rt.flush();
    const events = rt.memory.events.length;
    const w = writes.length;
    const bufferWrites = rt.buffer.writes;
    for (let i = 0; i < 1000; i++) useGameStore.getState().tick();
    expect(useGameStore.getState().state!.tick).toBe(1000);
    expect(useGameStore.getState().state!.status).toBe('running');
    await new Promise((r) => setTimeout(r, 20));
    expect(rt.memory.events.length).toBe(events);
    expect(writes.length).toBe(w);
    expect(rt.buffer.writes).toBe(bufferWrites);
    await rt.flush();
    expect(writes.length).toBe(w);
  });

  it('a whole bot run: run_start, actions, event cards and choices, moments, run_end; never the lab name', () => {
    useGameStore.getState().newGame(SETUP);
    const store = useGameStore.getState;
    for (let i = 0; i < 6000; i++) {
      const { state, pack, dispatch } = store();
      if (!state || state.status === 'ended') break;
      if (state.pendingEvent) {
        const choice = chooseEventChoice(state, pack, state.playerLabId);
        if (choice) dispatch({ type: 'resolveEvent', labId: state.playerLabId, choiceId: choice });
        continue;
      }
      for (const m of state.moments) if (m.labId === state.playerLabId && state.tick >= m.spawnTick + 3) store().dispatch({ type: 'collectMoment', labId: state.playerLabId, uid: m.uid });
      if (state.tick % 10 === 0) for (const a of chooseAiActions(store().state!, pack, state.playerLabId)) store().dispatch(a);
      store().tick();
    }
    const n = names();
    expect(n[0]).toBe('run_start');
    expect(rt.memory.events[0].params).toEqual(expect.objectContaining({ founder: 'researcher', homeRegion: 'canada' }));
    expect(n).toContain('node_buy');
    expect(n).toContain('event_shown');
    expect(n).toContain('event_choice');
    expect(n).toContain('moment_collect');
    expect(n.filter((x) => x === 'run_end')).toHaveLength(1);
    const end = last('run_end')!;
    expect(end.params).toEqual(expect.objectContaining({ ticks: store().state!.tick, won: expect.any(Boolean), score: expect.any(Number) }));
    expect(n.filter((x) => x === 'event_shown').length).toBe(n.filter((x) => x === 'event_choice').length);
    const moment = last('moment_collect')!;
    expect(moment.params.momentId).not.toBe('unknown');
    expect(['boost', 'threat']).toContain(moment.params.kind);
    expect(last('node_buy')!.params.kind).toMatch(/^(capability|reach|shadow)$/);
    expect(JSON.stringify(rt.memory.events)).not.toContain('Secret Player Name');
    // Far fewer events than ticks.
    expect(rt.memory.events.length).toBeLessThan(store().state!.tick / 5);
  });

  it('region launches, quits by restart and by dropping the run', () => {
    const g = useGameStore.getState;
    g().newGame(SETUP);
    const s = g().state!;
    const target = g().pack.regions.find((r) => r.id !== 'canada' && !s.labs[s.playerLabId].adoption?.[r.id])!;
    useGameStore.setState({ state: { ...s, labs: { ...s.labs, [s.playerLabId]: { ...s.labs[s.playerLabId], cash: 1e9 } } } });
    expect(g().dispatch({ type: 'launchInRegion', labId: s.playerLabId, regionId: target.id }).ok).toBe(true);
    expect(last('region_launch')!.params).toEqual({ regionId: target.id });
    for (let i = 0; i < 5; i++) g().tick();
    g().newGame({ ...SETUP, seed: 7 });
    expect(last('run_quit')!.params).toEqual({ ticks: 5, how: 'restart' });
    g().tick();
    g().reset();
    expect(last('run_quit')!.params).toEqual({ ticks: 1, how: 'menu' });
    expect(names().filter((x) => x === 'run_start')).toHaveLength(2);
  });

  it('tutorial: one tutorial_step per step, complete at the end, skip with its step', () => {
    resetTutorialStore();
    const tut = useTutorialStore.getState;
    tut().replayNow(1);
    useTutorialStore.setState({ tutorial: { ...tut().tutorial, runSeed: 1 } });
    useTutorialStore.setState({ tutorial: { ...tut().tutorial, step: 1 } });
    useTutorialStore.setState({ tutorial: { ...tut().tutorial, step: 2 } });
    tut().skip();
    expect(rt.memory.events.map((e) => [e.name, e.params])).toEqual([
      ['tutorial_step', { step: 1, id: 'home' }],
      ['tutorial_step', { step: 2, id: 'strip' }],
      ['tutorial_step', { step: 3, id: 'buyModel' }],
      ['tutorial_skip', { step: 3 }],
    ]);
    rt.memory.clear();
    tut().replayNow(2);
    useTutorialStore.setState({ tutorial: { ...tut().tutorial, step: STEPS.length - 1 } });
    useTutorialStore.setState({ tutorial: { ...tut().tutorial, status: 'done' } });
    expect(names()).toEqual(['tutorial_step', 'tutorial_step', 'tutorial_complete']);
  });

  it('garage: taps are batched into one event, purchases and the setting are tracked', async () => {
    await useGarageStore.getState().load();
    const gs = useGarageStore.getState;
    rt.memory.clear();
    for (let i = 0; i < 25; i++) gs().tap();
    expect(names()).toEqual([]);
    flushTaps();
    expect(rt.memory.events.map((e) => [e.name, e.params])).toEqual([['garage_tap_batch', { taps: 25 }]]);
    gs().replace({ ...gs().state!, tokens: 1e15 });
    const first = gs().content.generators[0].id;
    expect(gs().buy(first)).toBe(true);
    expect(last('garage_generator_buy')!.params).toEqual({ tier: 1, count: 1 });
    gs().setHaptics(false);
    expect(last('settings_change')!.params).toEqual({ key: 'haptics', value: false });
    gs().setHaptics(true);
  });

  it('ads: started and completed per placement, remove-ads switch; nothing on load', async () => {
    await useAdStore.getState().load();
    rt.memory.clear();
    useAdStore.getState().count('boost', 'requested');
    useAdStore.getState().count('boost', 'shown');
    useAdStore.getState().count('boost', 'rewarded');
    useAdStore.getState().setAdsRemoved(true);
    useAdStore.getState().setAdsRemoved(false);
    expect(rt.memory.events.map((e) => [e.name, e.params])).toEqual([
      ['ad_started', { placement: 'boost' }],
      ['ad_completed', { placement: 'boost' }],
      ['remove_ads_tap', { on: true }],
      ['remove_ads_tap', { on: false }],
    ]);
  });

  it('logged errors become error events, and analytics never throws into the game', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    logError('garage save', new Error('disk full'));
    spy.mockRestore();
    expect(last('error')!.params).toEqual({ where: 'garage save', message: 'Error: disk full' });
    const before = analyticsErrors();
    rt.memory.track = () => {
      throw new Error('broken provider');
    };
    expect(() => useGameStore.getState().newGame(SETUP)).not.toThrow();
    expect(analyticsErrors()).toBeGreaterThan(before);
  });
});

describe('route events', () => {
  it('mode select, garage open and leaving', () => {
    expect(routeEvents('/', '/garage')).toEqual({ mode: 'garage', garageOpen: true, leftGarage: false, leftRaceForMenu: false });
    expect(routeEvents('/', '/game')).toEqual({ mode: 'race', garageOpen: false, leftGarage: false, leftRaceForMenu: false });
    expect(routeEvents('/garage', '/')).toEqual({ mode: null, garageOpen: false, leftGarage: true, leftRaceForMenu: false });
    expect(routeEvents('/game/trees', '/')).toEqual({ mode: null, garageOpen: false, leftGarage: false, leftRaceForMenu: true });
    expect(routeEvents('/game', '/game/news').mode).toBeNull();
    expect(routeEvents('/end', '/game').mode).toBeNull();
  });
});

describe('debug section text', () => {
  it('formats durations, event lines and the summary', () => {
    expect(fmtSeconds(75)).toBe('1:15');
    expect(fmtSeconds(3725)).toBe('1:02:05');
    expect(eventLine({ name: 'node_buy', params: { nodeId: 'a', kind: 'reach' }, t: new Date(2026, 0, 1, 14, 3, 22).getTime(), s: 1 })).toBe('14:03:22 node_buy nodeId=a kind=reach');
    const lines = summaryLines(
      {
        installId: 'i-abc',
        installedAt: 0,
        dayIndex: 8,
        sessions: 5,
        sessionsToday: 2,
        activeDays: 3,
        sessionsPerDay: 1.67,
        avgSessionSeconds: 300,
        currentSessionSeconds: 61,
        recent: [],
        returned: { 1: true, 7: false, 30: null },
        funnel: [],
      },
      120,
      9,
      0,
    );
    expect(lines).toEqual([
      'install i-abc · day D8',
      'sessions today 2 · total 5 · per active day 1.67',
      'session now 1:01 · average 5:00',
      'returned D1 yes · D7 no · D30 -',
      'stored 120 events · 9 writes · 0 errors',
    ]);
  });
});
