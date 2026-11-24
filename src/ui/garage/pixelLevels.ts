import { LEVELS, PIXEL_SCENES, SHELF_TIERS } from './art/manifest';

/**
 * What the pixel room shows, from the generator counts: a count bucket per tier and how
 * many of the later tiers sit on the shelf. Pure (no React), so the selectors and tests
 * use it directly.
 */

/** Count levels per tier (0 = none) and how many later tiers sit on the shelf. */
export interface PixelLevels {
  tiers: Record<string, number>;
  shelf: number;
}

/** The count bucket for `n` owned: 0 below the first step, else 1..LEVELS.length. */
export function levelOf(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  let level = 0;
  for (const step of LEVELS) if (n >= step) level += 1;
  return level;
}

/** Levels from generator counts: per tier, and the shelf up to the highest later tier owned. */
export function pixelLevels(generators: Record<string, number>): PixelLevels {
  const tiers: Record<string, number> = {};
  for (const [id, n] of Object.entries(generators)) tiers[id] = levelOf(n);
  let shelf = 0;
  SHELF_TIERS.forEach((id, i) => {
    if ((generators[id] ?? 0) > 0) shelf = i + 1;
  });
  return { tiers, shelf };
}

export const pixelKey = (l: PixelLevels) => `${Object.keys(l.tiers).sort().map((k) => `${k}${l.tiers[k]}`).join('')}|${l.shelf}`;

/** Whether a scene is drawn in pixel art (otherwise the SVG room draws it). */
export function hasPixelArt(scene: string): boolean {
  return !!PIXEL_SCENES[scene];
}

