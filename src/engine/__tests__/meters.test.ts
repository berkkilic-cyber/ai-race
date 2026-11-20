import { defaultBalance, ENGINE_NEWS_KEYS, getMeters, getWorldShare, step } from '@/engine';
import { editLab, newGame, PLAYER, quietPack, stepN, withBalance } from '../__fixtures__/helpers';
import { testPack } from '../__fixtures__/testPack';

const still = withBalance(quietPack(), { seedChance: 0, baseSpread: 0 });

describe('regulation', () => {
  it('rises with world share: regulationPerShare × share × regulationGain − decay', () => {
    const state = editLab(newGame(still), PLAYER, (lab) => {
      lab.adoption = { north: 0.5 };
      lab.regulation = 10;
    });
    const share = getWorldShare(state, still, PLAYER);
    const next = step(state, still);
    expect(next.labs[PLAYER].regulation).toBeCloseTo(10 + defaultBalance.regulationPerShare * share - defaultBalance.regulationDecay, 9);
  });

  it('rises with growth in strict regions: new users × strictness × regulationPerGrowth', () => {
    const growing = withBalance(quietPack(), { seedChance: 0, regulationPerShare: 0, regulationDecay: 0 });
    const state = editLab(newGame(growing), PLAYER, (lab) => (lab.adoption = { center: 0.2 }));
    const next = step(state, growing);
    const center = growing.regions.find((r) => r.id === 'center')!;
    const newUsers = (next.labs[PLAYER].adoption.center - 0.2) * center.population;
    expect(next.labs[PLAYER].regulation).toBeCloseTo(newUsers * center.strictness * defaultBalance.regulationPerGrowth, 9);
  });

  it('the regulationGain stat scales it, including region-tagged modifiers', () => {
    const growing = withBalance(quietPack(), { seedChance: 0, regulationPerShare: 0, regulationDecay: 0 });
    const plain = editLab(newGame(growing), PLAYER, (lab) => (lab.adoption = { center: 0.2 }));
    const shady = editLab(plain, PLAYER, (lab) => (lab.ownedNodes = ['s1', 's2'])); // ×0.8, and ×0.7 in 'strict' regions
    expect(step(shady, growing).labs[PLAYER].regulation / step(plain, growing).labs[PLAYER].regulation).toBeCloseTo(0.8 * 0.7, 6);
  });

  it('decays naturally and clamps to 0..100', () => {
    const state = editLab(newGame(still), PLAYER, (lab) => {
      lab.adoption = {};
      lab.regulation = 0.001;
    });
    expect(step(state, still).labs[PLAYER].regulation).toBe(0);
  });
});

describe('backlash', () => {
  it('rises with capability × share and data centre levels', () => {
    const state = editLab(newGame(still), PLAYER, (lab) => {
      lab.adoption = { north: 0.5 };
      lab.ownedNodes = ['c1'];
      lab.dataCentres = [{ id: 'a', regionId: 'north', level: 2 }];
      lab.cash = 100;
    });
    const share = getWorldShare(state, still, PLAYER);
    const b = defaultBalance;
    const expected = b.backlashPerCapability * 1 * share + b.backlashPerDataCentreLevel * 2 - b.backlashDecay;
    expect(step(state, still).labs[PLAYER].backlash).toBeCloseTo(expected, 9);
  });

  it('clamps at 100', () => {
    const state = editLab(newGame(still), PLAYER, (lab) => {
      lab.backlash = 99.99;
      lab.dataCentres = Array.from({ length: 10 }, (_, i) => ({ id: `d${i}`, regionId: 'north', level: 5 }));
      lab.cash = 1e6;
    });
    expect(step(state, still).labs[PLAYER].backlash).toBe(100);
  });
});

describe('meters selector', () => {
  it('reports regulation, backlash and the strongest active rival AGI progress', () => {
    let state = newGame(testPack);
    state = editLab(state, PLAYER, (lab) => {
      lab.regulation = 12;
      lab.backlash = 34;
    });
    state = editLab(state, 'alpha', (lab) => (lab.agiProgress = 40));
    state = editLab(state, 'beta', (lab) => (lab.agiProgress = 90)); // not entered yet: inactive
    expect(getMeters(state, PLAYER)).toEqual({ regulation: 12, backlash: 34, rival: 40 });
  });
});

describe('elimination', () => {
  it('regulation 100 eliminates a lab as banned; its adoption then fades away', () => {
    // Two rivals, so eliminating one does not end the run by monopoly.
    const pack = withBalance(quietPack({ rivals: testPack.rivals }), { seedChance: 0 });
    let state = editLab(newGame(pack), 'alpha', (lab) => {
      lab.regulation = 100;
      lab.adoption = { east: 0.3 };
    });
    state = step(state, pack);
    expect(state.labs.alpha.active).toBe(false);
    expect(state.labs.alpha.eliminated).toEqual({ reason: 'banned', tick: 1 });
    expect(state.news.some((n) => n.textKey === ENGINE_NEWS_KEYS.eliminatedBanned && n.labId === 'alpha')).toBe(true);
    const before = state.labs.alpha.adoption.east;
    state = step(state, pack);
    expect(state.labs.alpha.adoption.east).toBeCloseTo(before * (1 - defaultBalance.eliminatedDecayRate), 9);
    state = stepN(state, pack, 60);
    expect(state.labs.alpha.adoption).toEqual({});
  });

  it('backlash 100 eliminates a lab as revolt', () => {
    const pack = quietPack({ rivals: testPack.rivals });
    const state = step(editLab(newGame(pack), 'alpha', (lab) => (lab.backlash = 100)), pack);
    expect(state.labs.alpha.eliminated?.reason).toBe('revolt');
    expect(state.news.some((n) => n.textKey === ENGINE_NEWS_KEYS.eliminatedRevolt)).toBe(true);
  });
});
