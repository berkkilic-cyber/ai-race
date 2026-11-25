import { calmFixture, labFixture } from '../__fixtures__/content';
import { advance, createGarage, offlineCapMs } from '../garage';
import { HOUR_MS } from '../rates';
import { deserialize, serialize } from '../save';
import { awayStorage, nextStorage, storageFill } from '../storage';
import type { GarageContent, GarageState } from '../types';
import { validateGarage } from '../validate';

const T0 = 1_700_000_000_000;

/** The calm fixture with a 2 h base, a +1 h upgrade chain, a +1 h perk at Rep 2 and a paid 12 h field. */
function content(): GarageContent {
  const c = calmFixture();
  return {
    ...c,
    offline: { ...c.offline, capHours: 2, paidCapHours: 12 },
    upgrades: [
      ...c.upgrades.filter((u) => u.id !== 'off' && u.id !== 'late'),
      { id: 'disk', nameKey: 'g.a', descKey: 'g.a', icon: 'x', cost: 100, effects: [{ kind: 'offlineCap', hours: 1 }], requires: [], keep: true },
      { id: 'intern', nameKey: 'g.a', descKey: 'g.a', icon: 'x', cost: 1000, effects: [{ kind: 'offlineCap', hours: 1 }], requires: [{ type: 'generation', min: 1 }], keep: true },
    ],
    labRep: { ...c.labRep, perks: [...c.labRep.perks, { id: 'unit', rep: 4, textKey: 'p.1', effect: { kind: 'awayHours', amount: 1 } }] },
  };
}

function save(c: GarageContent, extra: Partial<GarageState> = {}): GarageState {
  return { ...createGarage(c, T0, 3), generators: { a: 10 }, ...extra };
}

describe('away storage', () => {
  const c = content();

  it('validates', () => {
    expect(validateGarage(c)).toEqual([]);
    expect(validateGarage({ ...c, offline: { ...c.offline, paidCapHours: 1 } }).join()).toMatch(/paidCapHours/);
  });

  it('holds the base 2 hours, then each upgrade and the Lab Rep perk add theirs', () => {
    expect(offlineCapMs(save(c), c)).toBe(2 * HOUR_MS);
    expect(offlineCapMs(save(c, { upgrades: ['disk'] }), c)).toBe(3 * HOUR_MS);
    expect(offlineCapMs(save(c, { upgrades: ['disk', 'intern'] }), c)).toBe(4 * HOUR_MS);
    expect(offlineCapMs(save(c, { upgrades: ['disk', 'intern'], labRep: 3 }), c)).toBe(4 * HOUR_MS);
    expect(offlineCapMs(save(c, { upgrades: ['disk', 'intern'], labRep: 4 }), c)).toBe(5 * HOUR_MS);
  });

  it('a kept model with an offline-cap strength extends it too', () => {
    const lab = labFixture();
    const s = { ...createGarage(lab, T0, 3), models: [{ uid: 1, prefix: 0, suffix: 0, version: 1, rarity: lab.training!.rarities[0].id, desc: 0, boons: [{ trait: 'toc', value: 1.5 }] }] };
    expect(offlineCapMs(s, lab) - offlineCapMs({ ...s, models: [] }, lab)).toBe(1.5 * HOUR_MS);
  });

  it('the reserved paid extension sets a floor at paidCapHours and is kept in the save', () => {
    const paid = save(c, { paidStorage: true });
    expect(offlineCapMs(paid, c)).toBe(12 * HOUR_MS);
    expect(awayStorage(paid, c).sources.find((x) => x.kind === 'paid')?.hours).toBe(10);
    expect(deserialize(serialize(paid), c, T0).state.paidStorage).toBe(true);
    expect(deserialize(serialize(save(c)), c, T0).state.paidStorage).toBeUndefined();
    expect(offlineCapMs({ ...paid, paidStorage: false }, c)).toBe(2 * HOUR_MS);
  });

  it('lists what fills it, summing to the capacity', () => {
    const s = save(c, { upgrades: ['disk', 'intern'], labRep: 5 });
    const st = awayStorage(s, c);
    expect(st.sources.map((x) => [x.kind, x.id, x.hours])).toEqual([
      ['base', '', 2],
      ['upgrade', 'disk', 1],
      ['upgrade', 'intern', 1],
      ['perk', 'unit', 1],
    ]);
    expect(st.sources.reduce((sum, x) => sum + x.hours, 0) * HOUR_MS).toBe(st.capMs);
  });

  it('points to the cheapest storage upgrade, then the perk, then nothing', () => {
    expect(nextStorage(save(c), c)).toEqual({ kind: 'upgrade', id: 'disk', hours: 1, cost: 100, available: true });
    expect(nextStorage(save(c, { upgrades: ['disk'] }), c)).toMatchObject({ id: 'intern', available: false });
    expect(nextStorage(save(c, { upgrades: ['disk'], generation: 1 }), c)).toMatchObject({ id: 'intern', available: true });
    expect(nextStorage(save(c, { upgrades: ['disk', 'intern'] }), c)).toEqual({ kind: 'perk', id: 'unit', hours: 1, cost: 4, available: false });
    expect(nextStorage(save(c, { upgrades: ['disk', 'intern'], labRep: 9 }), c)).toBeNull();
  });

  it('a return past the cap reports "capped" with the capacity; a shorter one does not', () => {
    const s = save(c);
    const long = advance(s, c, T0 + 5 * HOUR_MS).offline!;
    expect(long).toMatchObject({ capped: true, capMs: 2 * HOUR_MS, creditedMs: 2 * HOUR_MS, awayMs: 5 * HOUR_MS });
    const short = advance(s, c, T0 + HOUR_MS).offline!;
    expect(short).toMatchObject({ capped: false, capMs: 2 * HOUR_MS, creditedMs: HOUR_MS });
    // Earnings stop at the cap: 5 h away pays the same as 2 h.
    expect(long.tokens).toBeCloseTo(advance(s, c, T0 + 2 * HOUR_MS).offline!.tokens);
  });

  it('storageFill is a clamped share and survives bad input', () => {
    expect(storageFill(2 * HOUR_MS, HOUR_MS)).toBe(0.5);
    expect(storageFill(2 * HOUR_MS, 9 * HOUR_MS)).toBe(1);
    expect(storageFill(0, HOUR_MS)).toBe(0);
    expect(storageFill(HOUR_MS, NaN)).toBe(0);
  });
});
