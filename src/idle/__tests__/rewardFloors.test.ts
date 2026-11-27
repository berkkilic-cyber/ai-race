import { calmFixture } from '../__fixtures__/content';
import { bonusMultiplyValue, buy, claimOffer, createGarage, incidentFixValue } from '../garage';
import { crewMultiplier, generatorRate, totalRate } from '../rates';
import type { GarageContent, GarageState } from '../types';

const T0 = 1_700_000_000_000;
const base = calmFixture();
const firstGen = base.generators[0]!.id;

function withOffer(c: GarageContent, id: string, patch: object): GarageContent {
  return { ...c, offers: c.offers.map((o) => (o.id === id ? { ...o, ...patch } : o)) };
}

function lab(c: GarageContent, owned: number): GarageState {
  let s: GarageState = { ...createGarage(c, 1, T0), tokens: 1e12 };
  for (let i = 0; i < owned; i++) s = buy(s, c, firstGen, 1, T0).state;
  return { ...s, tokens: 0 };
}

describe('ad reward floors', () => {
  it('bonusMultiply pays the multiplied bonus when that is more than the minimum', () => {
    const c = withOffer(base, 'bonusMultiply', { multiplyMinSeconds: 10 });
    const s = lab(c, 5);
    const rate = totalRate(s, c, s.now);
    const big: GarageState = { ...s, bonusOffer: { reward: rate * 100, until: s.now + 5000, source: 'golden', id: 'burst', x: 0.5, y: 0.5 } };
    expect(bonusMultiplyValue(big, c)).toBeCloseTo(rate * 200, 5);
  });

  it('bonusMultiply pays at least the minimum seconds of production for a small bonus', () => {
    const c = withOffer(base, 'bonusMultiply', { multiplyMinSeconds: 600 });
    const s = lab(c, 5);
    const rate = totalRate(s, c, s.now);
    const small: GarageState = { ...s, bonusOffer: { reward: rate * 3, until: s.now + 5000, source: 'happening', id: 'x', x: 0.5, y: 0.5 } };
    expect(bonusMultiplyValue(small, c)).toBeCloseTo(rate * 600, 5);
    const r = claimOffer(small, c, 'bonusMultiply', small.now);
    expect(r.ok).toBe(true);
    expect(r.gained).toBeCloseTo(rate * 600, 5);
    expect(r.state.bonusOffer).toBeNull();
  });

  it('bonusMultiply without a minimum is the plain multiplier', () => {
    const s = lab(base, 5);
    const st: GarageState = { ...s, bonusOffer: { reward: 50, until: s.now + 5000, source: 'golden', id: 'burst', x: 0.5, y: 0.5 } };
    expect(bonusMultiplyValue(st, base)).toBeCloseTo(100, 5);
    expect(bonusMultiplyValue(s, base)).toBe(0);
  });

  it('incidentFix pays its seconds of production at full speed and clears the incident', () => {
    const c = withOffer(base, 'incidentFix', { fixSeconds: 300 });
    const s = lab(c, 5);
    const rate = totalRate(s, c, s.now);
    const inc: GarageState = { ...s, incident: { uid: 1, id: c.incidents.defs[0]!.id, generator: firstGen, startedAt: s.now, until: s.now + 60_000, taps: 0 } };
    expect(totalRate(inc, c, inc.now)).toBeLessThan(rate);
    expect(incidentFixValue(inc, c)).toBeCloseTo(rate * 300, 5);
    const r = claimOffer(inc, c, 'incidentFix', inc.now);
    expect(r.ok).toBe(true);
    expect(r.gained).toBeCloseTo(rate * 300, 5);
    expect(r.state.incident).toBeNull();
    expect(incidentFixValue(s, base)).toBe(0);
  });
});

describe('crew bonus', () => {
  const c: GarageContent = {
    ...base,
    upgrades: [...base.upgrades, { id: 'crew', nameKey: 'u.crew', descKey: 'u.crew.d', icon: 'x', cost: 1, effects: [{ kind: 'crewBonus', generator: firstGen, add: 0.01 }], requires: [] }],
  };

  it('is 1 without the upgrade and grows with every unit owned once it is bought', () => {
    const s = lab(c, 10);
    expect(crewMultiplier(s, c)).toBe(1);
    const owned: GarageState = { ...s, upgrades: [...s.upgrades, 'crew'] };
    expect(crewMultiplier(owned, c)).toBeCloseTo(1.1, 10);
    expect(generatorRate(owned, c, firstGen)).toBeCloseTo(generatorRate(s, c, firstGen) * 1.1, 6);
    const more = buy({ ...owned, tokens: 1e12 }, c, firstGen, 1, owned.now).state;
    expect(crewMultiplier(more, c)).toBeCloseTo(1.11, 10);
  });

  it('lifts every tier, not only its own', () => {
    const other = c.generators[1]!.id;
    let s = lab(c, 10);
    s = buy({ ...s, tokens: 1e12 }, c, other, 1, s.now).state;
    const owned: GarageState = { ...s, upgrades: [...s.upgrades, 'crew'] };
    expect(generatorRate(owned, c, other)).toBeCloseTo(generatorRate(s, c, other) * 1.1, 6);
  });
});
