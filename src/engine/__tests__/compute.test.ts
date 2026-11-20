import { defaultBalance, getCapabilityLevel, getCompute, step } from '@/engine';
import { capabilityCapFor, computeForCapability } from '../derived';
import { editLab, newGame, PLAYER, quietPack, withBalance } from '../__fixtures__/helpers';

const pack = withBalance(quietPack(), { seedChance: 0 });

describe('compute and capability', () => {
  it('compute = Σ online levels × computePerLevel × computeCapacity + computeBonus', () => {
    const boosted = { ...pack, founders: pack.founders.map((f) => ({ ...f, modifiers: [{ stat: 'computeCapacity' as const, op: 'add' as const, value: 0.5 }] })) };
    const state = editLab(newGame(boosted), PLAYER, (lab) => {
      lab.dataCentres = [
        { id: 'a', regionId: 'north', level: 2 },
        { id: 'b', regionId: 'west', level: 3, disabledUntilTick: 99 },
      ];
      lab.computeBonus = 4;
    });
    expect(getCompute(state, boosted, PLAYER)).toBeCloseTo(2 * defaultBalance.computePerLevel * 1.5 + 4, 9);
  });

  it('compute never goes below zero', () => {
    const state = editLab(newGame(pack), PLAYER, (lab) => (lab.computeBonus = -50));
    expect(getCompute(state, pack, PLAYER)).toBe(0);
  });

  it('capability is the highest owned capabilityLevel, capped by compute', () => {
    const base = newGame(pack);
    expect(getCapabilityLevel(base, pack, PLAYER)).toBe(0);
    const owned = editLab(base, PLAYER, (lab) => (lab.ownedNodes = ['c1', 'c2', 'c3']));
    expect(getCapabilityLevel(owned, pack, PLAYER)).toBe(0); // no compute
    const oneLevel = editLab(owned, PLAYER, (lab) => (lab.dataCentres = [{ id: 'a', regionId: 'north', level: 1 }]));
    expect(getCapabilityLevel(oneLevel, pack, PLAYER)).toBe(1); // one data centre level ≈ one capability level early on
    const lots = editLab(owned, PLAYER, (lab) => (lab.computeBonus = 1000));
    expect(getCapabilityLevel(lots, pack, PLAYER)).toBe(3);
  });

  it('later capability levels need more compute (computePerCapabilityLevel × L^exponent)', () => {
    const b = defaultBalance;
    for (let level = 1; level <= 5; level++) {
      const needed = computeForCapability(level, b);
      expect(needed).toBeCloseTo(b.computePerCapabilityLevel * Math.pow(level, b.capabilityComputeExponent), 9);
      expect(capabilityCapFor(needed, b)).toBe(level);
      expect(capabilityCapFor(needed - 0.01, b)).toBe(level - 1);
    }
    expect(capabilityCapFor(computeForCapability(2, b), { ...b, capabilityComputeExponent: 1 })).toBe(2);
    expect(capabilityCapFor(25, { ...b, capabilityComputeExponent: 1 })).toBe(2);
  });

  it('AGI progress += agiBase × capability^agiExponent × (1 + compute × agiComputeFactor) × agiRate', () => {
    const state = editLab(newGame(pack, { founderId: 'dealer' }), PLAYER, (lab) => {
      lab.ownedNodes = ['c1', 'c2'];
      lab.dataCentres = [{ id: 'a', regionId: 'north', level: 3 }];
      lab.cash = 1000;
    });
    const next = step(state, pack);
    const b = defaultBalance;
    const compute = 3 * b.computePerLevel;
    const expected = b.agiBase * Math.pow(2, b.agiExponent) * (1 + compute * b.agiComputeFactor) * 1.1; // c2: agiRate +0.1
    expect(next.labs[PLAYER].agiProgress).toBeCloseTo(expected, 12);
  });

  it('no AGI progress at capability 0', () => {
    const state = editLab(newGame(pack), PLAYER, (lab) => (lab.dataCentres = [{ id: 'a', regionId: 'north', level: 5 }]));
    expect(step(state, pack).labs[PLAYER].agiProgress).toBe(0);
  });
});
