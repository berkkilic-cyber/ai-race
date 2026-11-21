/** Seeded PRNG (mulberry32). The state is one 32-bit integer kept in GarageState.rng. */
export function nextRandom(seed: number): { value: number; seed: number } {
  let s = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(s ^ (s >>> 15), 1 | s);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  s = s | 0;
  return { value: ((r ^ (r >>> 14)) >>> 0) / 4294967296, seed: s };
}

/** A seed from any number (time, user input); never 0-length or NaN. */
export function seedFrom(n: number): number {
  const v = Number.isFinite(n) ? Math.floor(Math.abs(n)) : 1;
  return (v % 2147483647) | 0 || 1;
}
