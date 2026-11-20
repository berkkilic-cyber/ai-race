import { nextRandom, pickDistinct, random, randomInt, seedToRng, weightedPick } from '../rng';

describe('seeded PRNG', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const a = { rng: seedToRng(42) };
    const b = { rng: seedToRng(42) };
    for (let i = 0; i < 1000; i++) {
      const value = random(a);
      expect(value).toBe(random(b));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('random() follows the same sequence as nextRandom()', () => {
    const holder = { rng: 123 };
    const [value, next] = nextRandom(123);
    expect(random(holder)).toBe(value);
    expect(holder.rng).toBe(next);
  });

  it('different seeds give different sequences', () => {
    const a = { rng: seedToRng(1) };
    const b = { rng: seedToRng(2) };
    const seqA = Array.from({ length: 5 }, () => random(a));
    const seqB = Array.from({ length: 5 }, () => random(b));
    expect(seqA).not.toEqual(seqB);
  });

  it('randomInt covers the inclusive range', () => {
    const holder = { rng: 7 };
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randomInt(holder, 3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('weightedPick respects weights and ignores non-positive ones', () => {
    const holder = { rng: 9 };
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 2000; i++) {
      const item = weightedPick(holder, ['a', 'b', 'c'], (x) => (x === 'a' ? 3 : x === 'b' ? 1 : 0));
      if (item) counts[item]++;
    }
    expect(counts.c).toBe(0);
    expect(counts.a).toBeGreaterThan(counts.b * 2);
    expect(weightedPick(holder, ['x'], () => 0)).toBeUndefined();
  });

  it('pickDistinct returns distinct items, at most the pool size', () => {
    const holder = { rng: 5 };
    const picked = pickDistinct(holder, [1, 2, 3, 4], 3);
    expect(new Set(picked).size).toBe(3);
    expect(pickDistinct(holder, [1, 2], 5)).toHaveLength(2);
  });
});
