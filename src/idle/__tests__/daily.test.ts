import { calmFixture, labFixture } from '../__fixtures__/content';
import { addLabRep, claimDailyReward, dailyRewardQuote } from '../daily';
import { createGarage, shipThreshold } from '../garage';
import { labRepTotal } from '../race';
import { baseRate } from '../rates';
import type { GarageContent, GarageState, MissionsConfig } from '../types';
import { validateGarage } from '../validate';

const T0 = 1_700_000_000_000;

const missions: MissionsConfig = {
  reward: { minutes: 10, minTaps: 40, shipShareCap: 0.15, rep: 0.2 },
  crate: { minutes: 30, minTaps: 150, shipShareCap: 0.3, rep: 0.5, trainingRuns: 1, streakBonus: 0.1, streakCap: 7 },
  dayOffEveryDays: 7,
  defs: [
    { id: 'g', slot: 'garage', titleKey: 'g.a', goals: [{ counter: 'taps', goal: 10 }] },
    { id: 'r', slot: 'race', titleKey: 'g.a', goals: [{ counter: 'raceWin', goal: 1 }] },
    { id: 's', slot: 'stretch', titleKey: 'g.a', goals: [{ counter: 'ships', goal: 1 }, { counter: 'raceWin', goal: 1 }] },
  ],
};

function withMissions(c: GarageContent): GarageContent {
  return { ...c, missions };
}

/** A save producing exactly 10 tokens a second (ten "a" generators). */
function producing(c: GarageContent, extra: Partial<GarageState> = {}): GarageState {
  return { ...createGarage(c, T0, 3), generators: { a: 10 }, ...extra };
}

describe('daily mission rewards', () => {
  const c = withMissions(calmFixture());

  it('validates, and refuses broken mission content', () => {
    expect(validateGarage(c)).toEqual([]);
    const bad = withMissions(calmFixture());
    bad.missions = { ...missions, defs: [{ id: 'x', slot: 'garage', titleKey: 'g.a', goals: [{ counter: 'taps', goal: 0 }] }] };
    const problems = validateGarage(bad).join('\n');
    expect(problems).toMatch(/positive integers/);
    expect(problems).toMatch(/no race mission/);
    expect(problems).toMatch(/no stretch mission/);
  });

  it('a mission grants minutes of production, at least some taps, capped by a share of the next ship', () => {
    const s = producing(c);
    expect(baseRate(s, c)).toBe(10);
    const q = dailyRewardQuote(s, c, 'mission');
    // 10 tokens/s × 600 s = 6000, but capped at 15% of the 10K needed for the next model.
    expect(q.tokens).toBe(Math.min(6000, shipThreshold(c, 1) * 0.15));
    expect(q.rep).toBe(0.2);
    expect(q.trainingRuns).toBe(0);
    // Without generators it is the taps' worth (40 taps of 1 token).
    expect(dailyRewardQuote(createGarage(c, T0, 3), c, 'mission').tokens).toBe(40);
  });

  it('the crate grows with the streak, capped at seven days, and a multiplier scales it', () => {
    const s = producing(c, { generation: 1 });
    const q0 = dailyRewardQuote(s, c, 'crate', { streak: 0 });
    const q3 = dailyRewardQuote(s, c, 'crate', { streak: 3 });
    const q30 = dailyRewardQuote(s, c, 'crate', { streak: 30 });
    expect(q3.tokens / q0.tokens).toBeCloseTo(1.3);
    expect(q30.streakMult).toBeCloseTo(1.7);
    expect(dailyRewardQuote(s, c, 'crate', { streak: 3, crateMult: 2 }).tokens).toBeCloseTo(q3.tokens * 2);
    expect(dailyRewardQuote(s, c, 'crate', { streak: NaN }).streakMult).toBe(1);
  });

  it('claiming grants the tokens and the Lab Rep progress, whole points rolling over', () => {
    const s = producing(c, { generation: 1 });
    const q = dailyRewardQuote(s, c, 'mission');
    let r = claimDailyReward(s, c, 'mission', T0);
    expect(r.ok).toBe(true);
    expect(r.gained).toBeCloseTo(q.tokens);
    expect(r.state.tokens).toBeCloseTo(q.tokens);
    expect(r.state.genLifetime).toBeCloseTo(q.tokens);
    expect(labRepTotal(r.state)).toBeCloseTo(0.2);
    for (let i = 0; i < 4; i++) r = claimDailyReward(r.state, c, 'mission', T0);
    expect(r.state.labRep).toBe(1);
    expect(r.state.race!.repProgress).toBeCloseTo(0);
  });

  it('the crate adds a training run once training is on, past the queue cap', () => {
    const lab = withMissions(labFixture());
    const office = { ...createGarage(lab, T0, 3), stage: 1, training: { charges: lab.training!.queueMax, nextChargeAt: 0, candidates: null } };
    const r = claimDailyReward(office, lab, 'crate', T0, { streak: 1 });
    expect(r.state.training.charges).toBe(lab.training!.queueMax + 1);
    const garage = claimDailyReward(createGarage(lab, T0, 3), lab, 'crate', T0);
    expect(garage.state.training.charges).toBe(0);
  });

  it('without missions content nothing is granted', () => {
    const plain = calmFixture();
    expect(claimDailyReward(createGarage(plain, T0), plain, 'mission', T0).ok).toBe(false);
    expect(dailyRewardQuote(createGarage(plain, T0), plain, 'crate').tokens).toBe(0);
  });

  it('addLabRep ignores bad amounts', () => {
    const s = createGarage(c, T0);
    addLabRep(s, NaN);
    addLabRep(s, -1);
    expect(labRepTotal(s)).toBe(0);
  });
});
