/** Seeded PRNG (mulberry32). The whole generator state is one uint32 stored in GameState.rng. */
import { ceil, floor, imul, max, min } from './natives';

/** Returns a float in [0, 1) and the next generator state. */
export function nextRandom(rngState: number): [value: number, next: number] {
  const next = (rngState + 0x6d2b79f5) >>> 0;
  let t = next;
  t = imul(t ^ (t >>> 15), t | 1);
  t ^= t + imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Anything carrying an rng state that may be advanced in place (a draft GameState or a local generator). */
export interface RngHolder {
  rng: number;
}

/** Advances the holder's state and returns a float in [0, 1). Same sequence as nextRandom. */
export function random(holder: RngHolder): number {
  const next = (holder.rng + 0x6d2b79f5) >>> 0;
  holder.rng = next;
  let t = next;
  t = imul(t ^ (t >>> 15), t | 1);
  t ^= t + imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, max] inclusive. */
export function randomInt(holder: RngHolder, low: number, high: number): number {
  const lo = ceil(min(low, high));
  const hi = floor(max(low, high));
  return lo + floor(random(holder) * (hi - lo + 1));
}

/** Picks one item by weight; undefined when nothing has positive weight. */
export function weightedPick<T>(holder: RngHolder, items: readonly T[], weightOf: (item: T) => number): T | undefined {
  let total = 0;
  for (const item of items) total += max(0, weightOf(item));
  if (total <= 0) return undefined;
  let roll = random(holder) * total;
  for (const item of items) {
    roll -= max(0, weightOf(item));
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

/** Picks up to `count` distinct items uniformly. */
export function pickDistinct<T>(holder: RngHolder, items: readonly T[], count: number): T[] {
  const pool = items.slice();
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const index = floor(random(holder) * pool.length);
    picked.push(pool[index]);
    pool.splice(index, 1);
  }
  return picked;
}

/** Stable 32-bit hash of a string (FNV-1a), used to derive seeds. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Normalises any number to a valid uint32 seed. */
export function seedToRng(seed: number): number {
  return (floor(seed) ^ 0x9e3779b9) >>> 0;
}
