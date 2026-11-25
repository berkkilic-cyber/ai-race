import { emptyStats, validateGarage, type MissionsConfig } from '@/idle';
import { aiLabGarage } from '@/content/packs/ai-lab/garage';

import {
  ALL_COUNTERS,
  DAY_MS,
  EMPTY_STREAK,
  badgeCount,
  canClaim,
  canOpenCrate,
  counterValue,
  dayProgress,
  garageCounters,
  msToNextDay,
  newDay,
  newlyDone,
  pickMissions,
  readSave,
  streakOnClaim,
  streakView,
  utcDay,
  withGarage,
  withRace,
  writeSave,
  type Streak,
} from '../logic';

const cfg = aiLabGarage.missions as MissionsConfig;
const D = 20_000; // a UTC day number
const NEW = { stage: 0, generation: 0 };
const LATE = { stage: 4, generation: 9 };

describe('mission content', () => {
  it('validates, uses only counters the tracker knows, and has every placeholder filled', () => {
    expect(validateGarage(aiLabGarage)).toEqual([]);
    for (const d of cfg.defs) for (const g of d.goals) expect({ id: d.id, counter: g.counter, known: ALL_COUNTERS.includes(g.counter) }).toEqual({ id: d.id, counter: g.counter, known: true });
    for (const d of cfg.defs) {
      const text = aiLabGarage.strings[d.titleKey];
      expect(text).toBeTruthy();
      if (text.includes('{b}')) expect(d.goals.length).toBe(2);
    }
  });

  it('no training-run mission before the Office', () => {
    for (const d of cfg.defs) if (d.goals.some((g) => g.counter === 'training')) expect(d.minStage ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe('UTC days', () => {
  it('counts whole UTC days and the time to the next one', () => {
    const t = Date.UTC(2026, 10, 25, 23, 30);
    expect(utcDay(t)).toBe(utcDay(Date.UTC(2026, 10, 25, 0, 0)));
    expect(utcDay(t) + 1).toBe(utcDay(Date.UTC(2026, 10, 26, 0, 0)));
    expect(msToNextDay(t)).toBe(30 * 60_000);
    expect(utcDay(NaN)).toBe(0);
    expect(msToNextDay(Infinity)).toBe(DAY_MS);
  });
});

describe('picking the day\'s missions', () => {
  it('one garage, one race, one stretch, the same for the same day and progress', () => {
    const ids = pickMissions(cfg, D, NEW);
    expect(ids).toHaveLength(3);
    expect(ids.map((id) => cfg.defs.find((d) => d.id === id)!.slot)).toEqual(['garage', 'race', 'stretch']);
    expect(pickMissions(cfg, D, NEW)).toEqual(ids);
  });

  it('varies from day to day', () => {
    const sets = new Set<string>();
    for (let d = 0; d < 30; d++) sets.add(pickMissions(cfg, D + d, NEW).join());
    expect(sets.size).toBeGreaterThan(10);
  });

  it('offers only what the player can do, and later progress widens the pool', () => {
    const seenNew = new Set<string>();
    const seenLate = new Set<string>();
    for (let d = 0; d < 200; d++) {
      for (const id of pickMissions(cfg, D + d, NEW)) seenNew.add(id);
      for (const id of pickMissions(cfg, D + d, LATE)) seenLate.add(id);
    }
    for (const id of seenNew) {
      const def = cfg.defs.find((x) => x.id === id)!;
      expect({ id, stage: def.minStage ?? 0, gen: def.minGeneration ?? 0 }).toEqual({ id, stage: 0, gen: 0 });
    }
    expect(seenNew.has('training-2')).toBe(false);
    expect(seenLate.has('training-2')).toBe(true);
    expect(seenLate.size).toBeGreaterThan(seenNew.size);
  });

  it('the stretch avoids a counter already used that day', () => {
    for (let d = 0; d < 100; d++) {
      const defs = pickMissions(cfg, D + d, LATE).map((id) => cfg.defs.find((x) => x.id === id)!);
      const stretch = defs[2].goals.map((g) => g.counter);
      for (const c of [...defs[0].goals, ...defs[1].goals].map((g) => g.counter)) expect(stretch).not.toContain(c);
    }
  });
});

describe('progress', () => {
  const stats = (taps: number, extra: Partial<ReturnType<typeof emptyStats>> = {}) => ({ ...emptyStats(), taps, ...extra });
  const fixed = (ids: string[]) => ({ ...newDay(cfg, D, NEW, stats(1000)), ids });

  it('Garage counters count from the day\'s baseline; auto-buys do not count as purchases', () => {
    expect(garageCounters(stats(5, { generatorsBought: 30, autoBought: 12 })).bought).toBe(18);
    let day = fixed(['tap-300', 'regions-5', 'ship-or-win']);
    expect(counterValue(day, 'taps')).toBe(0);
    day = withGarage(day, stats(1120));
    expect(counterValue(day, 'taps')).toBe(120);
    const p = dayProgress(cfg, day)[0];
    expect(p).toMatchObject({ value: 120, goal: 300, done: false });
    expect(p.progress).toBeCloseTo(0.4);
    expect(withGarage(day, stats(1120))).toBe(day);
  });

  it('a day started before the Garage was seen takes its baseline at first sight', () => {
    let day = { ...newDay(cfg, D, NEW, null), ids: ['tap-300'] };
    expect(counterValue(day, 'taps')).toBe(0);
    day = withGarage(day, stats(5000));
    expect(counterValue(day, 'taps')).toBe(0);
    day = withGarage(day, stats(5300));
    expect(newlyDone(cfg, day)).toEqual(['tap-300']);
  });

  it('a reset Garage (lower counts) restarts the day\'s count instead of going negative', () => {
    let day = withGarage(fixed(['tap-300']), stats(1100));
    day = withGarage(day, stats(10));
    expect(counterValue(day, 'taps')).toBe(0);
  });

  it('race counters add up; the model tier keeps the best of the day', () => {
    let day = fixed(['tap-300', 'regions-5', 'ship-or-win']);
    for (let i = 0; i < 4; i++) day = withRace(day, 'regions', 1);
    expect(counterValue(day, 'regions')).toBe(4);
    day = withRace(day, 'raceTier', 3);
    day = withRace(day, 'raceTier', 2);
    expect(counterValue(day, 'raceTier')).toBe(3);
    expect(withRace(day, 'regions', NaN)).toBe(day);
  });

  it('an either-or mission is done when either goal is reached', () => {
    let day = fixed(['tap-300', 'regions-5', 'ship-or-win']);
    expect(newlyDone(cfg, day)).toEqual([]);
    day = withRace(day, 'raceWin', 1);
    expect(newlyDone(cfg, day)).toEqual(['ship-or-win']);
    const other = withGarage(fixed(['ship-or-win']), stats(1000, { modelsShipped: 1 }));
    expect(newlyDone(cfg, other)).toEqual(['ship-or-win']);
  });

  it('claims, the badge and the crate', () => {
    let day = fixed(['tap-300', 'regions-5', 'ship-or-win']);
    day = withGarage(day, stats(1300));
    day = { ...day, done: newlyDone(cfg, day) };
    expect(canClaim(cfg, day, 'tap-300')).toBe(true);
    expect(canClaim(cfg, day, 'regions-5')).toBe(false);
    expect(canClaim(cfg, day, 'not-today')).toBe(false);
    expect(badgeCount(cfg, day)).toBe(1);
    day = { ...day, claimed: ['tap-300'] };
    expect(canClaim(cfg, day, 'tap-300')).toBe(false);
    expect(badgeCount(cfg, day)).toBe(0);
    expect(canOpenCrate(day)).toBe(false);
    day = { ...day, claimed: ['tap-300', 'regions-5', 'ship-or-win'] };
    expect(canOpenCrate(day)).toBe(true);
    expect(badgeCount(cfg, day)).toBe(1);
    expect(canOpenCrate({ ...day, crate: true })).toBe(false);
  });
});

describe('the streak', () => {
  const claim = (s: Streak, day: number) => streakOnClaim(s, day, 7);

  it('grows by one per day with a claim; a second claim the same day changes nothing', () => {
    let s = claim(EMPTY_STREAK, D).streak;
    expect(s).toMatchObject({ current: 1, best: 1, lastDay: D });
    const again = claim(s, D);
    expect(again.changed).toBe(false);
    expect(again.streak).toBe(s);
    s = claim(s, D + 1).streak;
    s = claim(s, D + 2).streak;
    expect(s.current).toBe(3);
    expect(streakView(s, D + 2)).toMatchObject({ current: 3, countedToday: true });
    expect(streakView(s, D + 3)).toMatchObject({ current: 3, countedToday: false });
  });

  it('one missed day is covered by the day off, which recharges seven days later', () => {
    let s = claim(claim(EMPTY_STREAK, D).streak, D + 1).streak;
    // D + 2 missed.
    expect(streakView(s, D + 3)).toMatchObject({ current: 2, coveringYesterday: true, dayOffReady: true });
    const r = claim(s, D + 3);
    expect(r.usedDayOff).toBe(true);
    s = r.streak;
    expect(s).toMatchObject({ current: 3, coveredDay: D + 2, dayOffFrom: D + 9 });
    expect(streakView(s, D + 4)).toMatchObject({ dayOffReady: false, dayOffInDays: 5 });
    // Another miss before it recharges ends the streak (shown as 0, best kept).
    s = claim(s, D + 4).streak;
    expect(streakView(s, D + 6)).toMatchObject({ current: 0, best: 4, coveringYesterday: false });
    const restart = claim(s, D + 6);
    expect(restart.usedDayOff).toBe(false);
    expect(restart.streak).toMatchObject({ current: 1, best: 4 });
  });

  it('the day off is ready again once a week has passed', () => {
    let s = claim(EMPTY_STREAK, D).streak;
    s = claim(s, D + 2).streak; // covers D + 1
    expect(s.dayOffFrom).toBe(D + 8);
    for (let d = D + 3; d <= D + 8; d++) s = claim(s, d).streak;
    const r = claim(s, D + 10); // covers D + 9 (>= D + 8)
    expect(r.usedDayOff).toBe(true);
    expect(r.streak.current).toBe(s.current + 1);
  });

  it('two missed days start it again', () => {
    const s = claim(EMPTY_STREAK, D).streak;
    expect(streakView(s, D + 3).current).toBe(0);
    expect(claim(s, D + 3).streak.current).toBe(1);
  });
});

describe('saves', () => {
  it('round-trips and repairs what it cannot trust', () => {
    const day = withRace({ ...newDay(cfg, D, NEW, emptyStats()), claimed: ['x'] }, 'regions', 2);
    const save = { v: 1 as const, today: day, streak: { current: 3, best: 5, lastDay: D, dayOffFrom: D + 3, coveredDay: D - 4 } };
    expect(readSave(writeSave(save))).toEqual(save);
    expect(readSave('nope')).toEqual(readSave(null));
    expect(readSave(JSON.stringify({ v: 2 })).today).toBeNull();
    const bad = readSave(JSON.stringify({ v: 1, streak: { current: 'x', best: -3 }, today: { day: 'y', ids: [1, 'a'], race: { regions: NaN } } }));
    expect(bad.streak).toEqual({ ...EMPTY_STREAK, best: 0 });
    expect(bad.today).toMatchObject({ day: 0, ids: ['a'], base: null, race: { regions: 0 } });
  });
});
