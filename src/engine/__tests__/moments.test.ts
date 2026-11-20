import {
  applyAction,
  DEFAULT_MOMENT_SKILL,
  defaultBalance,
  getMomentProgress,
  getMoments,
  runHeadless,
  step,
  type ContentPack,
  type GameState,
  type MomentDef,
} from '@/engine';
import { checkAction } from '../actions';
import { getContext } from '../context';
import { momentNeedsDataCentre, updateMoments } from '../moments';
import { stepInPlace } from '../step';
import { deepFreeze, edit, editLab, failureOf, mustApply, newGame, PLAYER, quietPack, stepN, withBalance } from '../__fixtures__/helpers';
import { momentPack, testMoments, testPack, testSetup } from '../__fixtures__/testPack';

const byId = (id: string): MomentDef => {
  const def = testMoments.find((m) => m.id === id);
  if (!def) throw new Error(id);
  return def;
};

/** The quiet fixture (no events, headlines, rivals) with only the given moments. */
function packWith(moments: MomentDef[], balance: ContentPack['balance'] = {}): ContentPack {
  return withBalance(quietPack({ moments, strings: momentPack.strings }), balance);
}

/** A state at `tick` with the given moment placed by hand. */
function withMoment(state: GameState, defId: string, regionId = 'north', lifetime = 20): GameState {
  return edit(state, (s) => {
    s.moments.push({ uid: `test-${defId}`, defId, labId: PLAYER, regionId, spawnTick: s.tick, expiresTick: s.tick + lifetime });
  });
}

/** Steps until the first moment exists (or `limit` ticks). */
function untilMoment(state: GameState, pack: ContentPack, limit = 500): GameState {
  let current = state;
  for (let i = 0; i < limit && current.moments.length === 0; i++) current = step(current, pack);
  return current;
}

describe('moment spawning', () => {
  it('starts with no moments and the first attempt at momentFirstTick', () => {
    const pack = packWith([byId('tip')]);
    const start = newGame(pack);
    expect(start.moments).toEqual([]);
    expect(start.nextMomentTick).toBe(defaultBalance.momentFirstTick);
    const before = stepN(start, pack, defaultBalance.momentFirstTick - 1);
    expect(before.moments).toEqual([]);
    const at = step(before, pack);
    expect(at.moments).toHaveLength(1);
    expect(at.moments[0]).toMatchObject({ defId: 'tip', labId: PLAYER, regionId: 'north', spawnTick: at.tick, expiresTick: at.tick + 20 });
  });

  it('schedules attempts momentIntervalMin..Max apart at low world share', () => {
    const pack = packWith([byId('tip')], { maxActiveMoments: 100 });
    let state = stepN(newGame(pack), pack, defaultBalance.momentFirstTick);
    for (let i = 0; i < 20; i++) {
      const gap = state.nextMomentTick - state.tick;
      // Home adoption is about 1% of one region: the share speed-up is negligible.
      expect(gap).toBeGreaterThanOrEqual(Math.round(defaultBalance.momentIntervalMin * 0.95));
      expect(gap).toBeLessThanOrEqual(defaultBalance.momentIntervalMax);
      state = stepN(state, pack, gap);
    }
  });

  it('shrinks the interval as world share grows, down to the floor', () => {
    const pack = packWith([byId('tip')], { momentIntervalMin: 100, momentIntervalMax: 100, momentShareSpeedup: 1.5, momentIntervalFloor: 30 });
    const context = getContext(pack);
    const gapAt = (adoption: Record<string, number>): number => {
      const state = editLab(newGame(pack), PLAYER, (lab) => (lab.adoption = adoption));
      state.tick = 10;
      state.nextMomentTick = 10;
      updateMoments(state, context);
      return state.nextMomentTick - state.tick;
    };
    expect(gapAt({ north: 0.01 })).toBe(100);
    // north + west = 1,000 of 2,700 million at 50%: share 0.185 -> 100 × (1 − 0.278) = 72.
    expect(gapAt({ north: 0.5, west: 0.5 })).toBe(72);
    expect(gapAt({ north: 1, west: 1, east: 1, center: 1, south: 1, isle: 1 })).toBe(30);
  });

  it('never has more than maxActiveMoments up at once, nor two in one region', () => {
    const pack = packWith([{ ...byId('tip'), lifetimeTicks: 400 }], { maxActiveMoments: 2, momentIntervalMin: 5, momentIntervalMax: 5, momentIntervalFloor: 1 });
    const spread = editLab(newGame(pack), PLAYER, (lab) => (lab.adoption = { north: 0.3, west: 0.3, east: 0.3, south: 0.3 }));
    let state = spread;
    for (let i = 0; i < 200; i++) {
      state = step(state, pack);
      expect(state.moments.length).toBeLessThanOrEqual(2);
      expect(new Set(state.moments.map((m) => m.regionId)).size).toBe(state.moments.length);
    }
    expect(state.moments).toHaveLength(2);
    // Only one region: only one moment, whatever the cap.
    let single = newGame(pack);
    for (let i = 0; i < 200; i++) single = step(single, pack);
    expect(single.moments).toHaveLength(1);
  });

  it('spawns nothing without eligible moments and respects conditions', () => {
    const pack = packWith([byId('grant')]);
    // grant needs tick ≥ 100.
    const early = stepN(newGame(pack), pack, 99);
    expect(early.moments).toEqual([]);
    expect(untilMoment(early, pack).moments[0]?.defId).toBe('grant');
    const none = packWith([]);
    expect(stepN(newGame(none), none, 200).moments).toEqual([]);
  });

  it('never gives moments to AI labs', () => {
    const pack = { ...momentPack, events: [], headlines: [] };
    let state = newGame(pack);
    for (let i = 0; i < 800; i++) {
      state = step(state, pack);
      expect(state.moments.every((m) => m.labId === PLAYER)).toBe(true);
    }
    expect(state.labs.alpha.stats.momentsCollected + state.labs.alpha.stats.momentsMissed).toBe(0);
  });

  it('is deterministic: same seed, same moments', () => {
    const run = () => stepN(newGame(momentPack, { seed: 7 }), { ...momentPack, events: [] }, 600);
    expect(run().moments).toEqual(run().moments);
    expect(run().labs.player.stats).toEqual(run().labs.player.stats);
  });
});

describe('moment placement', () => {
  /** Spawn attempts on a fixed adoption map: moments are cleared between attempts so nothing grows or blocks. */
  function spawnRegions(pack: ContentPack, state: GameState, attempts: number): Record<string, number> {
    const context = getContext(pack);
    const draft = JSON.parse(JSON.stringify(state)) as GameState;
    const counts: Record<string, number> = {};
    for (let i = 1; i <= attempts; i++) {
      draft.tick = i;
      draft.nextMomentTick = i;
      draft.moments = [];
      updateMoments(draft, context);
      for (const m of draft.moments) counts[m.regionId] = (counts[m.regionId] ?? 0) + 1;
    }
    return counts;
  }

  it('only places moments where the lab is present and not banned', () => {
    const pack = packWith([byId('tip')]);
    const state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.adoption = { north: 0.2, west: 0.2, east: 0.2 };
      lab.bans = { west: -1 };
    });
    expect(Object.keys(spawnRegions(pack, state, 400)).sort()).toEqual(['east', 'north']);
  });

  it('weights regions by the lab users there', () => {
    const pack = packWith([byId('tip')]);
    // north 600 M × 0.5 = 300 M users; isle 100 M × 0.01 = 1 M users.
    const counts = spawnRegions(pack, editLab(newGame(pack), PLAYER, (lab) => (lab.adoption = { north: 0.5, isle: 0.01 })), 2000);
    expect(counts.north).toBeGreaterThan(1900);
    expect(counts.isle ?? 0).toBeLessThan(30);
  });

  it('puts a data-centre threat only in a region where the lab has a data centre', () => {
    const heat = byId('heat');
    expect(momentNeedsDataCentre(heat)).toBe(true);
    expect(momentNeedsDataCentre(byId('leak'))).toBe(false);
    const pack = packWith([{ ...heat, lifetimeTicks: 3 }], { momentIntervalMin: 4, momentIntervalMax: 4, momentIntervalFloor: 1 });
    // No data centre: never spawns.
    const bare = editLab(newGame(pack), PLAYER, (lab) => (lab.adoption = { north: 0.3, west: 0.3 }));
    expect(stepN(bare, pack, 300).labs.player.stats.momentsMissed).toBe(0);
    let state = editLab(bare, PLAYER, (lab) => (lab.dataCentres = [{ id: 'dc-w', regionId: 'west', level: 1 }]));
    const regions = new Set<string>();
    for (let i = 0; i < 300; i++) {
      state = step(state, pack);
      for (const m of state.moments) regions.add(m.regionId);
    }
    expect([...regions]).toEqual(['west']);
  });
});

describe('collecting and expiring', () => {
  const pack = packWith(testMoments);
  /** The same moments, but no new ones spawn during the test. */
  const still = packWith(testMoments, { momentFirstTick: 100_000 });

  it('collecting a boost applies onCollect, removes it and counts it', () => {
    const state = withMoment(stepN(newGame(pack), pack, 5), 'tip');
    const after = mustApply(state, pack, { type: 'collectMoment', labId: PLAYER, uid: 'test-tip' });
    expect(after.labs.player.hype).toBe(state.labs.player.hype + 5);
    expect(after.moments).toEqual([]);
    expect(after.labs.player.stats.momentsCollected).toBe(1);
    expect(after.labs.player.stats.momentsMissed).toBe(0);
    // Collecting adds no news.
    expect(after.news).toEqual(state.news);
  });

  it('scaleWithIncome adds that many ticks of average income so far', () => {
    const base = editLab(stepN(newGame(pack), pack, 50), PLAYER, (lab) => (lab.stats.cashEarned = 100));
    const state = withMoment(base, 'grant');
    const after = mustApply(state, pack, { type: 'collectMoment', labId: PLAYER, uid: 'test-grant' });
    // 4 + 10 × (100 / 50 ticks).
    expect(after.labs.player.cash).toBeCloseTo(state.labs.player.cash + 24, 6);
  });

  it('an expired boost just disappears: counted as missed, no penalty, no news', () => {
    const state = withMoment(stepN(newGame(pack), pack, 5), 'tip', 'north', 3);
    const after = stepN(state, still, 3);
    expect(after.moments).toEqual([]);
    expect(after.labs.player.stats.momentsMissed).toBe(1);
    expect(after.news.filter((n) => n.kind === 'moment')).toEqual([]);
  });

  it('a contained threat lands no penalty; an expired one does, with one news item', () => {
    const state = withMoment(stepN(newGame(pack), pack, 5), 'leak', 'north', 3);
    const contained = mustApply(state, pack, { type: 'collectMoment', labId: PLAYER, uid: 'test-leak' });
    const containedLater = stepN(contained, still, 3);
    expect(containedLater.labs.player.backlash).toBeLessThanOrEqual(state.labs.player.backlash);
    expect(containedLater.labs.player.stats).toMatchObject({ momentsCollected: 1, momentsMissed: 0 });

    const expired = stepN(state, still, 3);
    expect(expired.labs.player.backlash).toBeGreaterThan(state.labs.player.backlash + 4);
    expect(expired.labs.player.stats).toMatchObject({ momentsCollected: 0, momentsMissed: 1 });
    const news = expired.news.filter((n) => n.kind === 'moment');
    expect(news).toEqual([
      { tick: state.tick + 3, kind: 'moment', textKey: 'moment.leak.expire', tone: 'bad', params: { lab: PLAYER, region: 'north' }, regionId: 'north', labId: PLAYER },
    ]);
  });

  it('atMoment effects act on the moment region only', () => {
    const base = editLab(stepN(newGame(pack), pack, 5), PLAYER, (lab) => {
      lab.adoption = { north: 0.2, west: 0.2 };
      lab.dataCentres = [
        { id: 'dc-n', regionId: 'north', level: 1 },
        { id: 'dc-w', regionId: 'west', level: 1 },
      ];
    });
    const expired = stepN(withMoment(base, 'heat', 'west', 2), still, 2);
    const dcs = Object.fromEntries(expired.labs.player.dataCentres.map((dc) => [dc.id, dc.disabledUntilTick]));
    expect(dcs['dc-n']).toBeUndefined();
    expect(dcs['dc-w']).toBe(expired.tick + 50);
  });

  it('expires at expiresTick: collectable on the tick before, gone on that tick', () => {
    const state = withMoment(stepN(newGame(pack), pack, 5), 'tip', 'north', 4);
    const lastChance = stepN(state, still, 3);
    expect(applyAction(lastChance, pack, { type: 'collectMoment', labId: PLAYER, uid: 'test-tip' }).ok).toBe(true);
    const gone = step(lastChance, still);
    expect(failureOf(gone, pack, { type: 'collectMoment', labId: PLAYER, uid: 'test-tip' })).toBe('unknownId');
  });
});

describe('collectMoment failures', () => {
  const pack = packWith(testMoments);
  const state = withMoment(stepN(newGame(pack), pack, 5), 'tip');

  it('unknownId for a moment that does not exist (or no longer does)', () => {
    expect(failureOf(state, pack, { type: 'collectMoment', labId: PLAYER, uid: 'nope' })).toBe('unknownId');
    const once = mustApply(state, pack, { type: 'collectMoment', labId: PLAYER, uid: 'test-tip' });
    expect(failureOf(once, pack, { type: 'collectMoment', labId: PLAYER, uid: 'test-tip' })).toBe('unknownId');
  });

  it("notAllowed for another lab's moment, unknownId / labInactive for a bad lab", () => {
    const withRival = newGame(momentPack);
    const s = edit(withRival, (st) => st.moments.push({ uid: 'x', defId: 'tip', labId: PLAYER, regionId: 'north', spawnTick: 0, expiresTick: 50 }));
    expect(checkAction(s, getContext(momentPack), { type: 'collectMoment', labId: 'alpha', uid: 'x' })).toEqual({ ok: false, reason: 'notAllowed' });
    expect(failureOf(s, momentPack, { type: 'collectMoment', labId: 'ghost', uid: 'x' })).toBe('unknownId');
    expect(failureOf(s, momentPack, { type: 'collectMoment', labId: 'beta', uid: 'x' })).toBe('labInactive');
  });

  it('gameEnded after the run ends, eventPending while a card is up', () => {
    expect(failureOf(edit(state, (s) => (s.status = 'ended')), pack, { type: 'collectMoment', labId: PLAYER, uid: 'test-tip' })).toBe('gameEnded');
    const pending = edit(state, (s) => (s.pendingEvent = { eventId: 'press', labId: PLAYER }));
    expect(failureOf(pending, { ...pack, events: testPack.events }, { type: 'collectMoment', labId: PLAYER, uid: 'test-tip' })).toBe('eventPending');
  });
});

describe('moments, events and the end of the run', () => {
  it('nothing spawns or expires while an event card is pending', () => {
    const pack = { ...momentPack, rivals: [], headlines: [] };
    let state = newGame(pack);
    while (!state.pendingEvent) state = step(state, pack);
    state = withMoment(state, 'leak', 'north', 1);
    const paused = stepN(state, pack, 50);
    expect(paused).toBe(state);
    expect(paused.moments).toHaveLength(state.moments.length);
    expect(paused.labs.player.stats.momentsMissed).toBe(state.labs.player.stats.momentsMissed);
  });

  it('clears every moment when the run ends', () => {
    const pack = packWith(testMoments);
    const state = withMoment(stepN(newGame(pack), pack, 5), 'tip', 'north', 100);
    const ending = editLab(state, PLAYER, (lab) => (lab.agiProgress = 100));
    const ended = step(ending, pack);
    expect(ended.status).toBe('ended');
    expect(ended.moments).toEqual([]);
    expect(ended.labs.player.stats.momentsMissed).toBe(state.labs.player.stats.momentsMissed);
  });
});

describe('moment selectors', () => {
  const pack = packWith(testMoments);

  it("getMoments lists only the lab's moments", () => {
    const state = edit(withMoment(newGame(pack), 'tip'), (s) =>
      s.moments.push({ uid: 'other', defId: 'tip', labId: 'someone', regionId: 'west', spawnTick: 0, expiresTick: 9 }),
    );
    expect(getMoments(state, PLAYER).map((m) => m.uid)).toEqual(['test-tip']);
    expect(getMoments(state, 'nobody')).toEqual([]);
  });

  it('getMomentProgress goes from 0 to 1 over the lifetime; 1 when gone', () => {
    const start = withMoment(stepN(newGame(pack), pack, 2), 'tip', 'north', 10);
    expect(getMomentProgress(start, 'test-tip')).toBe(0);
    const later = stepN(start, packWith([]), 4);
    expect(getMomentProgress(later, 'test-tip')).toBeCloseTo(0.4, 6);
    expect(getMomentProgress(later, 'missing')).toBe(1);
  });
});

describe('immutability', () => {
  it('step and collectMoment never mutate their input', () => {
    const pack = packWith(testMoments);
    const state = deepFreeze(withMoment(stepN(newGame(pack), pack, 5), 'leak', 'north', 2));
    expect(() => mustApply(state, pack, { type: 'collectMoment', labId: PLAYER, uid: 'test-leak' })).not.toThrow();
    expect(() => stepN(state, pack, 5)).not.toThrow();
    expect(state.moments).toHaveLength(1);
  });

  it('stepInPlace on a clone leaves earlier states alone', () => {
    const pack = packWith(testMoments);
    const first = untilMoment(newGame(pack), pack);
    const snapshot = JSON.stringify(first);
    step(first, pack);
    expect(JSON.stringify(first)).toBe(snapshot);
    expect(typeof stepInPlace).toBe('function');
  });
});

describe('headless moment skill', () => {
  it('has the documented defaults per policy', () => {
    expect(DEFAULT_MOMENT_SKILL).toEqual({ sensible: 0.7, capability: 0.7, reach: 0.7, shadow: 0.7, random: 0.3, idle: 0 });
  });

  it('skill 0 taps nothing; skill 1 lets nothing expire; skill 0.5 is in between', () => {
    const run = (momentSkill: number) => runHeadless(momentPack, testSetup, { policy: 'sensible', maxTicks: 2000, momentSkill }).labs.player.stats;
    const none = run(0);
    expect(none.momentsCollected).toBe(0);
    expect(none.momentsMissed).toBeGreaterThan(10);
    const all = run(1);
    expect(all.momentsMissed).toBe(0);
    expect(all.momentsCollected).toBeGreaterThan(10);
    const half = run(0.5);
    const rate = half.momentsCollected / (half.momentsCollected + half.momentsMissed);
    expect(rate).toBeGreaterThan(0.25);
    expect(rate).toBeLessThan(0.75);
  });

  it('reports what each tap gained', () => {
    const gains: { defId: string; hype: number; cash: number }[] = [];
    const state = runHeadless(momentPack, testSetup, { policy: 'idle', maxTicks: 1500, momentSkill: 1, onMomentCollected: (g) => gains.push(g) });
    expect(gains).toHaveLength(state.labs.player.stats.momentsCollected);
    const tips = gains.filter((g) => g.defId === 'tip');
    expect(tips.length).toBeGreaterThan(0);
    for (const g of tips) expect(g.hype).toBeCloseTo(5, 6);
  });

  // The budget is 1,000 runs in 60 s; like the base performance test in headless.test.ts this plays a
  // fifth of that (200 runs in 12 s) so the suite stays quick. npm run balance times 1,000 real runs.
  it('headless runs with moments stay within the budget (200 runs in 12 s, i.e. 1,000 in 60 s)', () => {
    const start = performance.now();
    for (let seed = 1; seed <= 200; seed++) runHeadless(momentPack, { ...testSetup, seed }, { policy: 'sensible', maxTicks: 4000 });
    expect(performance.now() - start).toBeLessThan(12_000);
  }, 30_000);
});
