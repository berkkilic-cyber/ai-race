import type { GarageContent } from '../types';

/** A small, theme-free content pack for the idle engine's tests. */
export function fixture(): GarageContent {
  const strings: Record<string, string> = {};
  const k = (key: string) => {
    strings[key] = key;
    return key;
  };
  return {
    id: 'fixture',
    generators: [
      { id: 'a', nameKey: k('g.a'), descKey: k('g.a.d'), icon: 'x', baseCost: 10, costGrowth: 1.15, baseRate: 1, unlockGeneration: 0 },
      { id: 'b', nameKey: k('g.b'), descKey: k('g.b.d'), icon: 'x', baseCost: 100, costGrowth: 1.15, baseRate: 10, unlockGeneration: 0 },
      { id: 'c', nameKey: k('g.c'), descKey: k('g.c.d'), icon: 'x', baseCost: 5000, costGrowth: 1.2, baseRate: 200, unlockGeneration: 1 },
    ],
    upgrades: [
      { id: 'a2', nameKey: k('u.a2'), descKey: k('u.a2.d'), icon: 'x', cost: 50, effects: [{ kind: 'generatorMult', generator: 'a', mult: 2 }], requires: [{ type: 'owned', generator: 'a', count: 5 }] },
      { id: 'tap2', nameKey: k('u.tap2'), descKey: k('u.tap2.d'), icon: 'x', cost: 20, effects: [{ kind: 'tapMult', mult: 2 }], requires: [{ type: 'taps', count: 10 }] },
      { id: 'tapRate', nameKey: k('u.tr'), descKey: k('u.tr.d'), icon: 'x', cost: 30, effects: [{ kind: 'tapFromRate', share: 0.1 }], requires: [] },
      { id: 'glob', nameKey: k('u.g'), descKey: k('u.g.d'), icon: 'x', cost: 1000, effects: [{ kind: 'globalMult', mult: 1.5 }], requires: [{ type: 'lifetime', tokens: 500 }] },
      { id: 'off', nameKey: k('u.o'), descKey: k('u.o.d'), icon: 'x', cost: 10, effects: [{ kind: 'offlineCap', hours: 2 }, { kind: 'offlineRate', add: 0.25 }], requires: [], keep: true },
      { id: 'late', nameKey: k('u.l'), descKey: k('u.l.d'), icon: 'x', cost: 10, effects: [{ kind: 'globalMult', mult: 2 }], requires: [{ type: 'generation', min: 1 }, { type: 'upgrade', id: 'off' }] },
    ],
    generations: [
      { id: 'g0', nameKey: k('m.0'), headlineKey: k('m.0.h'), unlockKey: k('m.0.u'), shipAt: 0, perks: [] },
      { id: 'g1', nameKey: k('m.1'), headlineKey: k('m.1.h'), unlockKey: k('m.1.u'), shipAt: 10_000, perks: [] },
      { id: 'g2', nameKey: k('m.2'), headlineKey: k('m.2.h'), unlockKey: k('m.2.u'), shipAt: 100_000, perks: [{ kind: 'globalMult', mult: 2 }] },
    ],
    endlessNameKey: k('m.n'),
    endlessHeadlineKey: k('m.n.h'),
    prestige: { scale: 1000, exponent: 0.5, hypePerPoint: 0.1, endlessGrowth: 10 },
    tap: { base: 1, comboWindowMs: 500, comboStep: 10, comboMaxStacks: 5, comboStackBonus: 0.1 },
    golden: {
      firstAfterMs: 30_000,
      intervalMinMs: 60_000,
      intervalMaxMs: 90_000,
      lifetimeMs: 10_000,
      defs: [
        { id: 'burst', textKey: k('go.b'), labelKey: k('go.b.l'), icon: 'x', weight: 1, reward: { kind: 'burst', seconds: 60, minTaps: 10 } },
        { id: 'frenzy', textKey: k('go.f'), labelKey: k('go.f.l'), icon: 'x', weight: 1, reward: { kind: 'frenzy', mult: 7, seconds: 20 } },
        { id: 'tapf', textKey: k('go.t'), labelKey: k('go.t.l'), icon: 'x', weight: 1, reward: { kind: 'tapFrenzy', mult: 5, seconds: 10 } },
      ],
    },
    incidents: {
      firstAfterMs: 20_000,
      intervalMinMs: 40_000,
      intervalMaxMs: 50_000,
      minOwned: 2,
      minGeneration: 0,
      defs: [{ id: 'i', textKey: k('i.t'), fixKey: k('i.f'), icon: 'x', weight: 1, mult: 0.5, durationMs: 15_000, tapsToFix: 3 }],
    },
    offline: { thresholdMs: 60_000, rate: 0.5, capHours: 4, reportMinMs: 120_000 },
    offers: [
      { id: 'offlineDouble', cooldownMs: 0, dailyCap: 3, offlineMult: 2 },
      { id: 'boost', cooldownMs: 0, dailyCap: 10, boostMult: 2, boostMs: 30 * 60_000, boostCapMs: 4 * 3_600_000 },
      { id: 'frenzyExtend', cooldownMs: 60_000, dailyCap: 5, extendMs: 30_000 },
      { id: 'incidentFix', cooldownMs: 60_000, dailyCap: 5 },
      { id: 'crate', cooldownMs: 3 * 3_600_000, dailyCap: 2, crateSeconds: 600, crateMinTaps: 50 },
      { id: 'prestigeBonus', cooldownMs: 0, dailyCap: 2, prestigeBonus: 0.25 },
    ],
    achievements: [
      { id: 'tap1', nameKey: k('a.t'), descKey: k('a.t.d'), icon: 'x', rule: { type: 'stat', stat: 'taps', gte: 1 } },
      { id: 'own10', nameKey: k('a.o'), descKey: k('a.o.d'), icon: 'x', rule: { type: 'owned', generator: 'a', gte: 10 } },
      { id: 'pure', nameKey: k('a.p'), descKey: k('a.p.d'), icon: 'x', secret: true, rule: { type: 'pureTaps', gte: 20 } },
      { id: 'clean', nameKey: k('a.c'), descKey: k('a.c.d'), icon: 'x', secret: true, rule: { type: 'shipNoUpgrades' } },
      { id: 'fast', nameKey: k('a.f'), descKey: k('a.f.d'), icon: 'x', secret: true, rule: { type: 'fastFix', ms: 2000 } },
      { id: 'exact', nameKey: k('a.e'), descKey: k('a.e.d'), icon: 'x', secret: true, rule: { type: 'exactOwned', count: 3 } },
    ],
    labRep: {
      perShip: 1,
      perGeneration: 0,
      perks: [
        { id: 'p1', rep: 1, textKey: k('p.1'), effect: { kind: 'startCash', amount: 50 } },
        { id: 'p2', rep: 3, textKey: k('p.2'), effect: { kind: 'startHype', amount: 20 } },
      ],
    },
    news: {
      intervalMinMs: 20_000,
      intervalMaxMs: 30_000,
      keep: 6,
      achievementKey: k('n.a'),
      headlines: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((h) => ({ key: k(`h.${h}`) })),
    },
    strings,
  };
}

/** The same pack with no random events (for exact production checks). */
export function calmFixture(): GarageContent {
  const c = fixture();
  const far = 1e15;
  return { ...c, golden: { ...c.golden, firstAfterMs: far }, incidents: { ...c.incidents, firstAfterMs: far }, news: { ...c.news } };
}
