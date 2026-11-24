import palettes from './art/palettes.json';

/**
 * Each Garage stage's palette (src/ui/garage/art/palettes.json, shared with the sprite
 * generator in scripts/pixel) and its accent: the colour of the stage's name in the
 * header, the "next stage" goal bar and the stage card. Buy buttons stay in the brand
 * colour, and red stays for danger: an accent is never used for a warning.
 */

export type PaletteRole = (typeof palettes.roles)[number];

interface StagePalette {
  accent: string;
  colours: Record<string, string>;
}

const STAGES = palettes.stages as Record<string, StagePalette>;

/** The stage's accent, by scene id (garage, office, datacentre, town, latent); null for an unknown scene. */
export function stageAccent(scene: string | undefined | null): string | null {
  return (scene && STAGES[scene]?.accent) || null;
}

/** A colour of the stage's palette by role letter (see palettes.json `roleNames`); null if unknown. */
export function stageColour(scene: string | undefined | null, role: string): string | null {
  return (scene && STAGES[scene]?.colours[role]) || null;
}

/** Scene ids that have a palette. */
export const PALETTE_SCENES = Object.keys(STAGES);
