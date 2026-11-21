import { calmFixture, fixture } from '../__fixtures__/content';
import { advance, buy, buyMax, buyUpgrade, claimOffer, collectGolden, createGarage, GARAGE_VERSION, prestige, tap, tapIncident } from '../garage';
import { formatAmount, formatDuration, MAX_AMOUNT } from '../num';
import { bulkCost, generatorRate, maxAffordable, tapValue, totalRate, unitCost } from '../rates';
import { nextRandom } from '../rng';
import { deserialize, serialize } from '../save';
import { availableUpgrades, buyQuote, generatorRows, labPerks, nextLabPerk, nextUnlocks } from '../selectors';
import { OFFER_IDS, type GarageState } from '../types';
import { validateGarage } from '../validate';

const T0 = 1_700_000_000_000;
const c = fixture();
const calm = calmFixture();

describe('save and load', () => {
  it('round-trips a played state exactly', () => {
    let s = createGarage(c, T0, 5);
    for (let i = 0; i < 30; i++) s = tap(s, c, T0 + i * 200).state;
    s = buy(s, c, 'a', 2, T0 + 7000).state;
    s = advance(s, c, T0 + 50_000);
    const back = deserialize(serialize(s), c, T0 + 1e9);
    expect(back.error).toBeUndefined();
    expect(back.migratedFrom).toBeUndefined();
    // The combo is not kept across a reload; everything else is.
    expect(back.state).toEqual({ ...s, combo: { count: 0, lastAt: 0 } });
  });
  it('migrates a version 1 save', () => {
    const v1 = { version: 1, tokens: 1234, lifetime: 50_000, owned: { a: 7, b: 2, gone: 4 }, upgrades: { a2: true, tap2: false, nope: true }, models: 2, hype: 9, lastSeen: T0 - 5000, taps: 321 };
    const r = deserialize(JSON.stringify(v1), c, T0);
    expect(r.migratedFrom).toBe(1);
    expect(r.state.version).toBe(GARAGE_VERSION);
    expect(r.state.tokens).toBe(1234);
    expect(r.state.genLifetime).toBe(50_000);
    expect(r.state.generators).toEqual({ a: 7, b: 2 });
    expect(r.state.upgrades).toEqual(['a2']);
    expect(r.state.generation).toBe(2);
    expect(r.state.hype).toBe(9);
    expect(r.state.now).toBe(T0 - 5000);
    expect(r.state.stats.taps).toBe(321);
    // A migrated save plays on: advancing pays the time since lastSeen.
    expect(advance(r.state, c, T0).tokens).toBeGreaterThan(1234);
  });
  it('repairs bad numbers and unknown ids, and falls back on garbage', () => {
    const s = createGarage(c, T0);
    const bad = JSON.parse(serialize(s));
    bad.state.tokens = -5;
    bad.state.hype = 'lots';
    bad.state.generators = { a: 1e400, x: 3 };
    bad.state.achievements = ['tap1', 'tap1', 'unknown'];
    bad.state.offers = { boost: [1, 'x', null] };
    const r = deserialize(JSON.stringify(bad).replace('1e+400', '1e400'), c, T0);
    expect(r.state.tokens).toBe(0);
    expect(r.state.hype).toBe(0);
    expect(Object.keys(r.state.generators)).toEqual(['a']);
    expect(r.state.achievements).toEqual(['tap1']);
    expect(r.state.offers.boost).toEqual([1]);
    for (const id of OFFER_IDS) expect(Array.isArray(r.state.offers[id])).toBe(true);
    expect(deserialize('{nope', c, T0).error).toBe('unreadable');
    expect(deserialize(JSON.stringify({ v: 99, state: {} }), c, T0).error).toBe('newerVersion');
    expect(deserialize(null, c, T0).state.tokens).toBe(0);
  });
});

/** Every number a screen or save could show is finite and non-negative. */
function expectSane(s: GarageState) {
  const nums: [string, number][] = [
    ['tokens', s.tokens],
    ['genLifetime', s.genLifetime],
    ['hype', s.hype],
    ['rate', totalRate(s, c, s.now)],
    ['tap', tapValue(s, c, s.now)],
    ...Object.entries(s.stats),
    ...Object.entries(s.generators),
  ];
  for (const [name, v] of nums) expect([name, Number.isFinite(v) && v >= 0]).toEqual([name, true]);
}

describe('property checks', () => {
  it('costs and rates never go NaN, negative or infinite', () => {
    for (const def of c.generators) {
      for (const owned of [0, 1, 10, 100, 500, 1000, 5000]) {
        const unit = unitCost(def, owned);
        expect(Number.isFinite(unit) && unit > 0).toBe(true);
        expect(bulkCost(def, owned, 10)).toBeGreaterThanOrEqual(unit);
        expect(unit).toBeLessThanOrEqual(MAX_AMOUNT);
        const n = maxAffordable(def, owned, 1e20);
        expect(Number.isInteger(n) && n >= 0).toBe(true);
        const s = { ...createGarage(c, T0), generators: { [def.id]: owned }, generation: 5, hype: 1e6 };
        const r = generatorRate(s, c, def.id);
        expect(Number.isFinite(r) && r >= 0).toBe(true);
      }
    }
  });
  it('random play at random times keeps every number sane', () => {
    let seed = 99;
    const rnd = () => {
      const r = nextRandom(seed);
      seed = r.seed;
      return r.value;
    };
    for (let game = 0; game < 12; game++) {
      let s = createGarage(c, T0, game + 1);
      let now = T0;
      for (let step = 0; step < 300; step++) {
        const roll = rnd();
        // Mostly small steps; sometimes hours away, sometimes the clock jumps back.
        now += roll < 0.05 ? -rnd() * 3_600_000 : roll < 0.1 ? rnd() * 20 * 3_600_000 : rnd() * 3000;
        const pick = Math.floor(rnd() * 10);
        const id = c.generators[Math.floor(rnd() * c.generators.length)].id;
        if (pick < 4) s = tap(s, c, now).state;
        else if (pick === 4) s = buy(s, c, id, 1 + Math.floor(rnd() * 10), now).state;
        else if (pick === 5) s = buyMax(s, c, id, now).state;
        else if (pick === 6) s = buyUpgrade(s, c, c.upgrades[Math.floor(rnd() * c.upgrades.length)].id, now).state;
        else if (pick === 7) s = collectGolden(tapIncident(s, c, now).state, c, now).state;
        else if (pick === 8) s = claimOffer(s, c, OFFER_IDS[Math.floor(rnd() * OFFER_IDS.length)], now).state;
        else s = prestige(advance(s, c, now), c, now).state;
        expectSane(s);
      }
      expect(deserialize(serialize(s), c, now).state.tokens).toBe(s.tokens);
    }
  });
  it('huge Hype and counts stay below the cap', () => {
    const s = { ...createGarage(c, T0), generators: { a: 1e9, b: 1e9, c: 1e9 }, hype: 1e290, generation: 3 };
    const r = advance(s, c, T0 + 59_000);
    expect(r.tokens).toBeLessThanOrEqual(MAX_AMOUNT);
    expectSane(r);
  });
});

describe('selectors', () => {
  it('reveal owned tiers, the next one to buy and a teaser', () => {
    const rows = generatorRows(createGarage(calm, T0), calm);
    expect(rows.map((r) => [r.def.id, r.revealed, r.unlocked])).toEqual([
      ['a', true, true],
      ['b', false, true],
      ['c', false, false],
    ]);
    const later = generatorRows({ ...createGarage(calm, T0), generators: { a: 3 } }, calm);
    expect(later.map((r) => r.revealed)).toEqual([true, true, false]);
  });
  it('quote x1, x10 and max', () => {
    const s = { ...createGarage(calm, T0), tokens: 1000 };
    const def = calm.generators[0];
    expect(buyQuote(s, def, 1)).toEqual({ count: 1, cost: 10 });
    expect(buyQuote(s, def, 10).count).toBe(10);
    expect(buyQuote(s, def, 'max').count).toBe(maxAffordable(def, 0, 1000));
    expect(buyQuote({ ...s, tokens: 0 }, def, 'max')).toEqual({ count: 1, cost: 10 });
  });
  it('list upgrades on offer and the ones coming next', () => {
    const s = { ...createGarage(calm, T0), generators: { a: 3 } };
    expect(availableUpgrades(s, calm).map((u) => u.id)).toEqual(['off', 'tapRate']);
    const next = nextUnlocks(s, calm);
    expect(next[0]).toMatchObject({ def: { id: 'a2' }, progress: 0.6 });
  });
  it('Lab Rep perks are data with a pure lookup', () => {
    expect(labPerks(calm, 0)).toEqual([]);
    expect(labPerks(calm, 3).map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(nextLabPerk(calm, 1)?.id).toBe('p2');
    expect(nextLabPerk(calm, 5)).toBeUndefined();
  });
});

describe('formatting', () => {
  it('formats amounts compactly up to and past the named suffixes', () => {
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(7.25)).toBe('7.3');
    expect(formatAmount(950)).toBe('950');
    expect(formatAmount(1234)).toBe('1.23K');
    expect(formatAmount(12_345)).toBe('12.3K');
    expect(formatAmount(999_999)).toBe('1M');
    expect(formatAmount(4.2e9)).toBe('4.2B');
    expect(formatAmount(1e15)).toBe('1Qa');
    expect(formatAmount(3.21e72)).toBe('3.21e72');
    expect(formatAmount(1e300)).toBe('1e300');
    expect(formatAmount(Number.NaN)).toBe('0');
  });
  it('formats durations', () => {
    expect(formatDuration(12_000)).toBe('12s');
    expect(formatDuration(245_000)).toBe('4m 05s');
    expect(formatDuration(3 * 3_600_000 + 12 * 60_000)).toBe('3h 12m');
    expect(formatDuration(-5)).toBe('0s');
  });
});

describe('validateGarage', () => {
  it('accepts the fixture', () => {
    expect(validateGarage(c)).toEqual([]);
  });
  it('reports broken content', () => {
    const bad = fixture();
    bad.generators[1].costGrowth = 1;
    bad.upgrades[0].requires = [{ type: 'owned', generator: 'zzz', count: 1 }];
    bad.generations[2].shipAt = 5;
    bad.offers = bad.offers.filter((o) => o.id !== 'crate');
    delete bad.strings['g.a'];
    const problems = validateGarage(bad).join('\n');
    expect(problems).toMatch(/costGrowth/);
    expect(problems).toMatch(/unknown generator "zzz"/);
    expect(problems).toMatch(/shipAt must rise/);
    expect(problems).toMatch(/offer crate is missing/);
    expect(problems).toMatch(/missing string "g.a"/);
  });
});
