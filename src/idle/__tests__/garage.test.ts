import { calmFixture, fixture } from '../__fixtures__/content';
import {
  advance,
  buy,
  buyMax,
  buyUpgrade,
  canAfford,
  claimOffer,
  collectGolden,
  createGarage,
  dismissOffline,
  offerStatus,
  offlineEarnings,
  prestige,
  prestigePreview,
  shipThreshold,
  tap,
  tapIncident,
  DAY_MS,
} from '../garage';
import { bulkCost, comboMultiplier, generatorRate, maxAffordable, tapValue, totalRate, unitCost } from '../rates';
import type { GarageState } from '../types';

const T0 = 1_700_000_000_000;
const c = fixture();
const calm = calmFixture();

function withTokens(s: GarageState, tokens: number): GarageState {
  return { ...s, tokens, genLifetime: Math.max(s.genLifetime, tokens) };
}

function owning(content = calm, gens: Record<string, number> = { a: 10, b: 5 }): GarageState {
  return { ...createGarage(content, T0, 1), generators: gens };
}

describe('createGarage', () => {
  it('starts empty at generation 0 with events scheduled from now', () => {
    const s = createGarage(c, T0, 7);
    expect(s.tokens).toBe(0);
    expect(s.generation).toBe(0);
    expect(s.now).toBe(T0);
    expect(s.nextGoldenAt).toBe(T0 + c.golden.firstAfterMs);
    expect(s.nextIncidentAt).toBe(T0 + c.incidents.firstAfterMs);
  });
});

describe('tapping', () => {
  it('a tap earns the base value and counts', () => {
    const r = tap(createGarage(calm, T0), calm, T0);
    expect(r.gained).toBe(1);
    expect(r.state.tokens).toBe(1);
    expect(r.state.stats.taps).toBe(1);
    expect(r.combo).toBe(1);
  });
  it('builds a combo inside the window and resets outside it', () => {
    let s = createGarage(calm, T0);
    let t = T0;
    for (let i = 0; i < 25; i++) s = tap(s, calm, (t += 100)).state;
    expect(s.combo.count).toBe(25);
    expect(s.stats.bestCombo).toBe(25);
    const after = tap(s, calm, t + 600);
    expect(after.combo).toBe(1);
    expect(after.state.stats.bestCombo).toBe(25);
  });
  it('the combo multiplier steps every comboStep taps and caps', () => {
    const s = createGarage(calm, T0);
    expect(comboMultiplier(s, calm, 9)).toBe(1);
    expect(comboMultiplier(s, calm, 10)).toBeCloseTo(1.1);
    expect(comboMultiplier(s, calm, 1000)).toBeCloseTo(1.5);
  });
  it('tap upgrades multiply and tap-from-rate adds a share of production', () => {
    let s = withTokens(owning(), 1000);
    const before = tapValue(s, calm, T0, 1);
    s = buyUpgrade(s, calm, 'tapRate', T0).state;
    expect(tapValue(s, calm, T0, 1)).toBeCloseTo(before + 0.1 * totalRate(s, calm, T0));
  });
  it('multi-finger taps at the same instant each count', () => {
    let s = createGarage(calm, T0);
    for (let i = 0; i < 3; i++) s = tap(s, calm, T0).state;
    expect(s.stats.taps).toBe(3);
    expect(s.tokens).toBe(3);
  });
});

describe('generators', () => {
  it('cost rises geometrically and bulk cost is the sum of unit costs', () => {
    const def = calm.generators[0];
    expect(unitCost(def, 0)).toBe(10);
    expect(unitCost(def, 2)).toBeCloseTo(10 * 1.15 ** 2);
    let sum = 0;
    for (let i = 3; i < 13; i++) sum += unitCost(def, i);
    expect(bulkCost(def, 3, 10)).toBeCloseTo(sum, 6);
  });
  it('maxAffordable is exact at the boundary', () => {
    const def = calm.generators[1];
    for (const tokens of [0, 99, 100, 1234, 1e6, 1e12]) {
      const n = maxAffordable(def, 4, tokens);
      expect(bulkCost(def, 4, n)).toBeLessThanOrEqual(tokens);
      expect(bulkCost(def, 4, n + 1)).toBeGreaterThan(tokens);
    }
  });
  it('buy spends tokens and adds production; refuses when poor, locked or unknown', () => {
    const s = withTokens(createGarage(calm, T0), 25);
    const r = buy(s, calm, 'a', 2, T0);
    expect(r.ok).toBe(true);
    expect(r.state.generators.a).toBe(2);
    expect(r.state.tokens).toBeCloseTo(25 - 10 - 11.5);
    expect(totalRate(r.state, calm)).toBe(2);
    expect(buy(r.state, calm, 'b', 1, T0).reason).toBe('cantAfford');
    expect(buy(withTokens(s, 1e9), calm, 'c', 1, T0).reason).toBe('locked');
    expect(buy(s, calm, 'zzz', 1, T0).reason).toBe('unknownId');
    expect(s.tokens).toBe(25); // input untouched
  });
  it('buyMax buys as many as affordable', () => {
    const s = withTokens(createGarage(calm, T0), 1000);
    const r = buyMax(s, calm, 'a', T0);
    expect(r.state.generators.a).toBe(maxAffordable(calm.generators[0], 0, 1000));
    expect(canAfford(r.state, calm, 'a')).toBe(false);
  });
});

describe('upgrades', () => {
  it('need their requirements, cost tokens and apply their effect', () => {
    let s = withTokens(owning(calm, { a: 4 }), 1000);
    expect(buyUpgrade(s, calm, 'a2', T0).reason).toBe('locked');
    s = { ...s, generators: { a: 5 } };
    const rate = generatorRate(s, calm, 'a');
    const r = buyUpgrade(s, calm, 'a2', T0);
    expect(r.ok).toBe(true);
    expect(generatorRate(r.state, calm, 'a')).toBeCloseTo(rate * 2);
    expect(r.state.tokens).toBe(950);
    expect(buyUpgrade(r.state, calm, 'a2', T0).reason).toBe('owned');
  });
  it('global multipliers scale every tier and generation perks apply from their generation', () => {
    const s = { ...owning(), generation: 2 };
    expect(totalRate(s, calm)).toBeCloseTo((10 * 1 + 5 * 10) * 2);
  });
});

describe('advance', () => {
  it('produces rate × time while online', () => {
    const s = owning();
    const r = advance(s, calm, T0 + 30_000);
    expect(r.tokens).toBeCloseTo(60 * 30);
    expect(r.offline).toBeNull();
  });
  it('one big step equals many small steps, events included', () => {
    const s = owning(c);
    const big = advance(s, c, T0 + 59_000);
    let small = s;
    for (let t = 1000; t <= 59_000; t += 1000) small = advance(small, c, T0 + t);
    expect(small.tokens).toBeCloseTo(big.tokens, 6);
    expect(small.incident).toEqual(big.incident);
    expect(small.golden).toEqual(big.golden);
    // Achievements are checked when the state is touched, so their ticker lines follow the step size.
    const events = (st: GarageState) => st.news.filter((n) => n.kind !== 'achievement').map(({ key, kind, at, params }) => ({ key, kind, at, params }));
    expect(events(small)).toEqual(events(big));
    expect(small.rng).toBe(big.rng);
  });
  it('the same seed and times give the same state (deterministic)', () => {
    const run = () => {
      let s = owning(c);
      for (let t = 1; t <= 40; t++) s = advance(tap(s, c, T0 + t * 5000).state, c, T0 + t * 5000 + 2500);
      return s;
    };
    expect(run()).toEqual(run());
  });
  it('time away earns at the offline rate up to the cap and reports it', () => {
    const s = owning();
    const r = advance(s, calm, T0 + 10 * 3_600_000);
    const expected = 60 * 4 * 3600 * 0.5;
    expect(r.tokens).toBeCloseTo(expected);
    expect(r.offline).toEqual({ awayMs: 10 * 3_600_000, creditedMs: 4 * 3_600_000, tokens: r.tokens, doubled: false });
    expect(dismissOffline(r).offline).toBeNull();
  });
  it('offline catch-up equals the same time integrated in steps (a boost ending midway)', () => {
    const s = { ...owning(), boostUntil: T0 + 37 * 60_000 };
    const closed = offlineEarnings(s, calm, 3 * 3_600_000);
    let stepped = 0;
    for (let t = 0; t < 3 * 3_600_000; t += 1000) stepped += totalRate({ ...s, now: T0 + t }, calm, T0 + t) * 1 * 0.5;
    expect(closed).toBeCloseTo(stepped, 3);
    expect(advance(s, calm, T0 + 3 * 3_600_000).tokens).toBeCloseTo(closed, 6);
  });
  it('offline upgrades extend the cap and raise the rate', () => {
    const s = { ...owning(), upgrades: ['off'] };
    const r = advance(s, calm, T0 + 10 * 3_600_000);
    expect(r.offline!.creditedMs).toBe(6 * 3_600_000);
    expect(r.tokens).toBeCloseTo(60 * 6 * 3600 * 0.75);
  });
  it('a clock that goes backwards earns nothing and keeps timers', () => {
    const s = { ...owning(), boostUntil: T0 + 600_000, offers: { ...owning().offers, boost: [T0 - 1000] } };
    const r = advance(s, calm, T0 - 3_600_000);
    expect(r.tokens).toBe(0);
    expect(r.now).toBe(T0 - 3_600_000);
    expect(r.boostUntil - r.now).toBe(600_000);
    expect(r.offers.boost[0]).toBe(T0 - 1000 - 3_600_000);
  });
  it('absurd jumps and bad clocks stay finite and bounded', () => {
    const s = owning();
    const r = advance(s, calm, T0 + 1e15);
    expect(Number.isFinite(r.tokens)).toBe(true);
    expect(r.tokens).toBeCloseTo(60 * 4 * 3600 * 0.5);
    expect(advance(s, calm, Number.NaN)).toBe(s);
    expect(advance(s, calm, T0)).toBe(s);
  });
  it('accumulates play time online only', () => {
    const s = owning();
    expect(advance(s, calm, T0 + 30_000).stats.playMs).toBe(30_000);
    expect(advance(s, calm, T0 + 3_600_000).stats.playMs).toBe(0);
  });
});

describe('golden moments', () => {
  it('appear on schedule and expire if missed', () => {
    const s = createGarage(c, T0, 3);
    const a = advance(s, c, T0 + c.golden.firstAfterMs);
    expect(a.golden).not.toBeNull();
    expect(a.golden!.expiresAt).toBe(T0 + c.golden.firstAfterMs + c.golden.lifetimeMs);
    const b = advance(a, c, a.golden!.expiresAt);
    expect(b.golden).toBeNull();
    expect(b.stats.goldenMissed).toBe(1);
  });
  it('rewards: a burst of production, a frenzy, or a tap frenzy', () => {
    const base = owning(c);
    const at = (id: string) => ({ ...base, golden: { uid: 9, id, spawnedAt: T0, expiresAt: T0 + 10_000, x: 0.5, y: 0.5 } });
    const burst = collectGolden(at('burst'), c, T0);
    expect(burst.gained).toBeCloseTo(60 * 60);
    expect(burst.state.stats.goldenCaught).toBe(1);
    const frenzy = collectGolden(at('frenzy'), c, T0).state;
    expect(totalRate(frenzy, c, T0)).toBeCloseTo(60 * 7);
    expect(totalRate(frenzy, c, T0 + 20_000)).toBeCloseTo(60);
    const tf = collectGolden(at('tapf'), c, T0).state;
    expect(tapValue(tf, c, T0, 1)).toBeCloseTo(5);
    expect(collectGolden(base, c, T0).reason).toBe('none');
  });
});

describe('incidents', () => {
  it('halve one owned tier until fixed by taps', () => {
    const s = owning(c, { a: 10, b: 5 });
    const a = advance(s, c, T0 + c.incidents.firstAfterMs);
    expect(a.incident).not.toBeNull();
    const id = a.incident!.generator;
    const full = generatorRate({ ...a, incident: null }, c, id);
    expect(generatorRate(a, c, id)).toBeCloseTo(full * 0.5);
    let f = a;
    for (let i = 0; i < 3; i++) f = tapIncident(f, c, a.now + 500).state;
    expect(f.incident).toBeNull();
    expect(f.stats.incidentsFixed).toBe(1);
    expect(f.achievements).toContain('fast');
  });
  it('end on their own and never hit tiers below minOwned', () => {
    const lone = advance(owning(c, { a: 1 }), c, T0 + c.incidents.firstAfterMs);
    expect(lone.incident).toBeNull();
    const a = advance(owning(c), c, T0 + c.incidents.firstAfterMs);
    const b = advance(a, c, a.incident!.until);
    expect(b.incident).toBeNull();
  });
});

describe('prestige', () => {
  it('is refused before the threshold', () => {
    expect(prestige(withTokens(createGarage(calm, T0), 9_999), calm, T0).reason).toBe('notReady');
  });
  it('gives Hype by the root of lifetime, resets progress and keeps kept upgrades', () => {
    let s = withTokens({ ...owning(), upgrades: ['off', 'tap2'] }, 40_000);
    const pv = prestigePreview(s, calm);
    expect(pv.canShip).toBe(true);
    expect(pv.gain).toBe(Math.floor(Math.sqrt(40_000 / 1000)));
    s = prestige(s, calm, T0).state;
    expect(s.generation).toBe(1);
    expect(s.hype).toBe(6);
    expect(s.tokens).toBe(0);
    expect(s.generators).toEqual({});
    expect(s.upgrades).toEqual(['off']);
    expect(s.labRep).toBe(1);
    expect(s.news.find((n) => n.kind === 'launch')).toMatchObject({ key: 'm.1.h', params: { n: 2 } });
    expect(s.lastShip).toMatchObject({ generation: 1, hypeGained: 6 });
    // Hype multiplies production
    const after = { ...s, generators: { a: 10 } };
    expect(totalRate(after, calm)).toBeCloseTo(10 * 1.6);
  });
  it('shipping with no upgrade bought unlocks the secret', () => {
    const s = prestige(withTokens(createGarage(calm, T0), 20_000), calm, T0).state;
    expect(s.achievements).toContain('clean');
  });
  it('thresholds continue geometrically after the named generations', () => {
    expect(shipThreshold(calm, 2)).toBe(100_000);
    expect(shipThreshold(calm, 3)).toBe(1_000_000);
    expect(shipThreshold(calm, 5)).toBe(100_000_000);
  });
  it('the prestige bonus offer adds its share once per use', () => {
    const s = withTokens(createGarage(calm, T0), 40_000);
    const r = prestige(s, calm, T0, { bonus: true });
    expect(r.state.hype).toBe(Math.ceil(6 * 1.25));
    expect(r.state.offers.prestigeBonus).toEqual([T0]);
  });
});

describe('offers', () => {
  it('boost doubles production, stacks and caps', () => {
    let s = owning();
    s = claimOffer(s, calm, 'boost', T0).state;
    expect(totalRate(s, calm, T0)).toBeCloseTo(120);
    for (let i = 0; i < 20; i++) s = claimOffer(s, calm, 'boost', T0).state;
    expect(s.boostUntil).toBe(T0 + 4 * 3_600_000);
    expect(offerStatus(s, calm, 'boost', T0).reason).toBe('notApplicable');
  });
  it('respect cooldowns and a rolling daily cap', () => {
    let s = withTokens(owning(), 1);
    s = claimOffer(s, calm, 'crate', T0).state;
    expect(offerStatus(s, calm, 'crate', T0 + 1000)).toMatchObject({ available: false, reason: 'cooldown', readyAt: T0 + 3 * 3_600_000 });
    s = claimOffer(s, calm, 'crate', T0 + 3 * 3_600_000).state;
    expect(offerStatus(s, calm, 'crate', T0 + 7 * 3_600_000)).toMatchObject({ available: false, reason: 'dailyCap', readyAt: T0 + DAY_MS });
    expect(offerStatus(s, calm, 'crate', T0 + DAY_MS + 1).available).toBe(true);
  });
  it('crate grants production seconds (at least some taps)', () => {
    const r = claimOffer(owning(), calm, 'crate', T0);
    expect(r.gained).toBeCloseTo(60 * 600);
    expect(r.state.stats.cratesOpened).toBe(1);
  });
  it('double offline earnings once per report', () => {
    const away = advance(owning(), calm, T0 + 3 * 3_600_000);
    const before = away.tokens;
    expect(offerStatus(owning(), calm, 'offlineDouble', T0).reason).toBe('notApplicable');
    const r = claimOffer(away, calm, 'offlineDouble', away.now);
    expect(r.state.tokens).toBeCloseTo(before * 2);
    expect(r.state.offline!.doubled).toBe(true);
    expect(offerStatus(r.state, calm, 'offlineDouble', away.now).reason).toBe('notApplicable');
  });
  it('extend a frenzy and fix an incident', () => {
    const s = { ...owning(c), frenzy: { mult: 7, tapMult: 1, until: T0 + 5000 } };
    const r = claimOffer(s, c, 'frenzyExtend', T0);
    expect(r.state.frenzy!.until).toBe(T0 + 35_000);
    expect(offerStatus(owning(c), c, 'frenzyExtend', T0).reason).toBe('notApplicable');
    const inc = advance(owning(c), c, T0 + c.incidents.firstAfterMs);
    const fixed = claimOffer(inc, c, 'incidentFix', inc.now);
    expect(fixed.state.incident).toBeNull();
    expect(fixed.state.stats.incidentsFixed).toBe(1);
  });
});

describe('achievements', () => {
  it('unlock once, with a ticker line', () => {
    let s = tap(createGarage(calm, T0), calm, T0).state;
    expect(s.achievements).toEqual(['tap1']);
    expect(s.news.some((n) => n.kind === 'achievement' && n.params?.name === 'a.t')).toBe(true);
    s = tap(s, calm, T0 + 1).state;
    expect(s.achievements.filter((a) => a === 'tap1')).toHaveLength(1);
  });
  it('secret rules: pure taps and exact ownership', () => {
    let s = createGarage(calm, T0);
    for (let i = 0; i < 20; i++) s = tap(s, calm, T0 + i * 1000).state;
    expect(s.achievements).toContain('pure');
    s = buy(withTokens(s, 1000), calm, 'a', 3, s.now).state;
    expect(s.achievements).toContain('exact');
  });
});
