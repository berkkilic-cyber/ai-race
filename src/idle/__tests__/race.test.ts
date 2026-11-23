import { calmFixture } from '../__fixtures__/content';
import { advance, buy, createGarage, offlineEarnings } from '../garage';
import { emptyRaceLink, grantRaceReward, labRepTotal, markRaceNoteSeen, raceBoostLeftMs, raceRewardQuote } from '../race';
import { baseRate, totalRate } from '../rates';
import { deserialize, serialize } from '../save';
import type { GarageContent, GarageState, RaceRewardInput } from '../types';
import { validateGarage } from '../validate';

const T0 = 1_700_000_000_000;
const MIN = 60_000;
const base = calmFixture();
const content: GarageContent = {
  ...base,
  raceReward: {
    baseRep: 2,
    lossFactor: 0.4,
    difficulty: { easy: 0.5, hard: 2 },
    runLength: { short: 0.5, long: 1 },
    scoreBonus: 0.5,
    scoreForBest: 1000,
    repeatFactor: 0.5,
    seedMemory: 3,
    boostMult: 1.5,
    boostMsPerRep: 10 * MIN,
    boostCapMs: 60 * MIN,
  },
};
const win: RaceRewardInput = { won: true, difficulty: 'hard', runLength: 'long', score: 0, seed: 1 };

/** A garage with some production and no random events. */
function garage(): GarageState {
  let s = createGarage(content, T0, 7);
  s = { ...s, tokens: 1e6, nextHeadlineAt: 1e15 };
  s = buy(s, content, 'a', 10, T0).state;
  return { ...s, tokens: 0 };
}

describe('race reward (race -> Garage)', () => {
  it('content with a race reward validates; a bad repeat factor does not', () => {
    expect(validateGarage(content)).toEqual([]);
    expect(validateGarage({ ...content, raceReward: { ...content.raceReward!, repeatFactor: 0.8 } })).toContainEqual(expect.stringContaining('repeatFactor'));
  });

  it('scales by result, difficulty, run length and score', () => {
    const s = garage();
    const q = (i: Partial<RaceRewardInput>) => raceRewardQuote(s, content, { ...win, ...i }).rep;
    expect(q({})).toBe(4); // 2 × 1 × 2 × 1
    expect(q({ won: false })).toBe(1.6);
    expect(q({ difficulty: 'easy' })).toBe(1);
    expect(q({ difficulty: 'unknown' })).toBe(2);
    expect(q({ runLength: 'short' })).toBe(2);
    expect(q({ score: 1000 })).toBe(6);
    expect(q({ score: 7000 })).toBe(6); // the score bonus stops at scoreForBest
    expect(q({ score: Number.NaN })).toBe(4);
    expect(q({ won: false })).toBeLessThan(q({}));
    expect(q({ runLength: 'short' })).toBeLessThan(q({ runLength: 'long' }));
  });

  it('grants nothing without race reward content', () => {
    const s = garage();
    const r = grantRaceReward(s, base, win, T0);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
  });

  it('adds whole Lab Rep points and keeps the fraction', () => {
    const s = garage();
    const a = grantRaceReward(s, content, { ...win, won: false }, T0).state; // 1.6
    expect(a.labRep).toBe(s.labRep + 1);
    expect(a.race!.repProgress).toBeCloseTo(0.6, 9);
    const b = grantRaceReward(a, content, { ...win, won: false, seed: 2 }, T0).state; // +1.6 = 2.2
    expect(b.labRep).toBe(s.labRep + 3);
    expect(b.race!.repProgress).toBeCloseTo(0.2, 9);
    expect(labRepTotal(b)).toBeCloseTo(s.labRep + 3.2, 9);
    expect(b.race!.repFromRaces).toBe(3.2);
    expect(b.race!.races).toBe(2);
  });

  it('a replayed seed grants half, then a quarter, so a seed cannot be farmed', () => {
    let s = garage();
    const reps: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = grantRaceReward(s, content, win, T0).state;
      reps.push(s.race!.last!.rep);
    }
    expect(reps).toEqual([4, 2, 1, 0.5]);
    expect(s.race!.last!.repeat).toBe(true);
    // Another seed is full value again.
    s = grantRaceReward(s, content, { ...win, seed: 99 }, T0).state;
    expect(s.race!.last!.rep).toBe(4);
  });

  it('remembers only the last seedMemory seeds', () => {
    let s = garage();
    for (const seed of [1, 2, 3, 4]) s = grantRaceReward(s, content, { ...win, seed }, T0).state;
    expect(s.race!.seeds.map((e) => e.seed)).toEqual([2, 3, 4]);
  });

  it('blueprints boost production for rep × boostMsPerRep, extend a running boost and stop at the cap', () => {
    const s = garage();
    const r = grantRaceReward(s, content, win, T0).state; // 4 rep -> 40 min
    expect(r.race!.boostFrom).toBe(T0);
    expect(r.race!.boostUntil).toBe(T0 + 40 * MIN);
    expect(raceBoostLeftMs(r, T0)).toBe(40 * MIN);
    expect(totalRate(r, content, T0)).toBeCloseTo(totalRate(s, content, T0) * 1.5, 6);
    expect(totalRate(r, content, T0 + 41 * MIN)).toBeCloseTo(totalRate(s, content, T0), 6);
    // Calm rates leave it out.
    expect(baseRate(r, content)).toBeCloseTo(baseRate(s, content), 6);
    const again = grantRaceReward(r, content, { ...win, seed: 5 }, T0 + 10 * MIN).state; // +40 min, capped at 60 min left
    expect(again.race!.boostFrom).toBe(T0);
    expect(again.race!.boostUntil).toBe(T0 + 10 * MIN + 60 * MIN);
  });

  it('does not advance the Garage clock; time away later credits the boost only from its start', () => {
    const s = garage();
    const later = T0 + 30 * MIN;
    const r = grantRaceReward(s, content, win, later).state;
    expect(r.now).toBe(s.now);
    expect(r.tokens).toBe(s.tokens);
    // Away for 2 h: the boost covers 40 of the 120 minutes (from minute 30 to 70).
    const credited = 120 * MIN;
    const plain = offlineEarnings(s, content, credited);
    const boosted = offlineEarnings(r, content, credited);
    expect(boosted / plain).toBeCloseTo((80 + 40 * 1.5) / 120, 6);
  });

  it('online play crosses the boost start and end exactly', () => {
    const s = garage();
    const r = grantRaceReward(s, content, { ...win, won: false, difficulty: 'easy', runLength: 'short' }, T0 + 10_000).state; // 0.2 rep -> 2 min
    const after = advance(r, content, T0 + 50_000); // 50 s online, boost from 10 s
    const plain = advance(s, content, T0 + 50_000);
    const rate = totalRate(s, content, T0);
    expect(after.tokens - plain.tokens).toBeCloseTo(rate * 40 * 0.5, 4);
  });

  it('records the last reward for the Garage note and marks it seen once', () => {
    const r = grantRaceReward(garage(), content, win, T0).state;
    expect(r.race!.last).toEqual({ rep: 4, boostMs: 40 * MIN, won: true, repeat: false, at: T0, seen: false });
    const seen = markRaceNoteSeen(r);
    expect(seen.race!.last!.seen).toBe(true);
    expect(markRaceNoteSeen(seen)).toBe(seen);
    expect(markRaceNoteSeen(garage()).race).toBeUndefined();
  });

  it('is pure and deterministic', () => {
    const s = garage();
    const frozen = JSON.stringify(s);
    const a = grantRaceReward(s, content, win, T0);
    const b = grantRaceReward(s, content, win, T0);
    expect(JSON.stringify(s)).toBe(frozen);
    expect(a).toEqual(b);
  });

  it('survives a save and load; bad race data is repaired', () => {
    const r = grantRaceReward(garage(), content, win, T0).state;
    const loaded = deserialize(serialize(r), content, T0).state;
    expect(loaded.race).toEqual(r.race);
    const broken = JSON.parse(serialize(r)) as { state: Record<string, unknown> };
    broken.state.race = { repProgress: 'x', boostUntil: -5, seeds: [{ seed: 'no' }, { seed: 4, plays: 2 }], last: 7 };
    const repaired = deserialize(JSON.stringify(broken), content, T0).state;
    expect(repaired.race).toEqual({ ...emptyRaceLink(), seeds: [{ seed: 4, plays: 2 }] });
    // A save without a race link has none.
    expect(deserialize(serialize(garage()), content, T0).state.race).toBeUndefined();
  });

  it('a clock moved backwards shifts the boost window with everything else', () => {
    const r = grantRaceReward(garage(), content, win, T0).state;
    const back = advance(r, content, T0 - 5 * MIN);
    expect(back.race!.boostFrom).toBe(T0 - 5 * MIN);
    expect(back.race!.boostUntil).toBe(T0 + 35 * MIN);
  });
});
