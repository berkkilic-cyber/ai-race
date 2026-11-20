import { defaultBalance, ENGINE_NEWS_KEYS, getCompute, getIncome, step } from '@/engine';
import { editLab, newGame, PLAYER, quietPack, withBalance } from '../__fixtures__/helpers';

const pack = withBalance(quietPack(), { seedChance: 0, baseSpread: 0, hypeBase: 0 });
const north = pack.regions.find((r) => r.id === 'north')!;
const west = pack.regions.find((r) => r.id === 'west')!;

describe('income and upkeep', () => {
  it('cash += Σ users × wealth × cashPerUser − upkeep (levels × powerCost × dataCentreUpkeep)', () => {
    const state = editLab(newGame(pack, { founderId: 'thinker' }), PLAYER, (lab) => {
      lab.adoption = { north: 0.5 };
      lab.dataCentres = [{ id: 'a', regionId: 'west', level: 2 }];
      lab.cash = 100;
    });
    const next = step(state, pack);
    const income = 0.5 * north.population * north.wealth * defaultBalance.cashPerUser;
    const upkeep = 2 * west.powerCost * defaultBalance.dataCentreUpkeep;
    expect(next.labs[PLAYER].cash).toBeCloseTo(100 + income - upkeep, 9);
    expect(getIncome(state, pack, PLAYER).cash).toBeCloseTo(income - upkeep, 9);
    expect(next.labs[PLAYER].stats.cashEarned).toBeCloseTo(income, 9);
  });

  it('the cashIncome stat (founder perk) multiplies income', () => {
    const state = editLab(newGame(pack, { founderId: 'dealer' }), PLAYER, (lab) => (lab.adoption = { north: 0.5 }));
    expect(getIncome(state, pack, PLAYER).cash).toBeCloseTo(0.5 * north.population * north.wealth * defaultBalance.cashPerUser * 1.15, 9);
  });

  it('banned regions earn nothing', () => {
    const state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.adoption = { north: 0.5 };
      lab.bans = { north: -1 };
    });
    expect(getIncome(state, pack, PLAYER).cash).toBe(0);
  });

  it('cash never goes negative: unpaid data centres go offline for unpaidOfflineTicks, costliest first', () => {
    const state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.adoption = {};
      lab.cash = 0;
      lab.dataCentres = [
        { id: 'cheap', regionId: 'south', level: 1 },
        { id: 'dear', regionId: 'isle', level: 3 },
      ];
    });
    const next = step(state, pack);
    const lab = next.labs[PLAYER];
    expect(lab.cash).toBe(0);
    expect(lab.dataCentres.find((d) => d.id === 'dear')!.disabledUntilTick).toBe(next.tick + defaultBalance.unpaidOfflineTicks);
    expect(lab.dataCentres.find((d) => d.id === 'cheap')!.disabledUntilTick).toBe(next.tick + defaultBalance.unpaidOfflineTicks);
    expect(getCompute(next, pack, PLAYER)).toBe(0);
    expect(next.news.filter((n) => n.textKey === ENGINE_NEWS_KEYS.dataCentreUnpaid)).toHaveLength(2);
  });

  it('only as many data centres go offline as needed', () => {
    const state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.adoption = {};
      lab.cash = 0.07;
      lab.dataCentres = [
        { id: 'cheap', regionId: 'south', level: 1 }, // 0.2 × 0.06 = 0.012
        { id: 'dear', regionId: 'isle', level: 3 }, // 3 × 0.7 × 0.06 = 0.126
      ];
    });
    const lab = step(state, pack).labs[PLAYER];
    expect(lab.dataCentres.find((d) => d.id === 'dear')!.disabledUntilTick).toBeDefined();
    expect(lab.dataCentres.find((d) => d.id === 'cheap')!.disabledUntilTick).toBeUndefined();
    expect(lab.cash).toBeCloseTo(0.07 - 0.012, 9);
  });

  it('offline data centres come back after their timer and cost no upkeep meanwhile', () => {
    let state = editLab(newGame(pack), PLAYER, (lab) => {
      lab.cash = 50;
      lab.adoption = {};
      lab.dataCentres = [{ id: 'a', regionId: 'north', level: 1, disabledUntilTick: 2 }];
    });
    state = step(state, pack);
    expect(state.labs[PLAYER].cash).toBe(50);
    expect(getCompute(state, pack, PLAYER)).toBe(0);
    state = step(state, pack);
    expect(state.labs[PLAYER].dataCentres[0].disabledUntilTick).toBeUndefined();
    expect(getCompute(state, pack, PLAYER)).toBe(defaultBalance.computePerLevel);
  });

  it('hype += (hypeBase + hypePerNewUser × new users) × hypeIncome', () => {
    const hypePack = withBalance(quietPack(), { seedChance: 0 });
    const state = newGame(hypePack);
    const next = step(state, hypePack);
    const newUsers = (next.labs[PLAYER].adoption.north - state.labs[PLAYER].adoption.north) * north.population;
    const expected = defaultBalance.hypeBase + defaultBalance.hypePerNewUser * newUsers;
    expect(next.labs[PLAYER].hype - state.labs[PLAYER].hype).toBeCloseTo(expected, 9);
    expect(getIncome(state, hypePack, PLAYER).hype).toBeCloseTo(defaultBalance.hypeBase, 9);
  });
});
