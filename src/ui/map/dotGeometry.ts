import type { MapGeometry, RegionGeometry } from '@/content/packs/ai-lab/geometry';

/** Dot-matrix data the geometry script adds to each region (see scripts/map/build-geometry.js). */
export interface DotRegion extends RegionGeometry {
  dotCount: number;
  /** One path per bucket in grid units, ordered outward from the marker point. */
  dots: string[];
}

export interface DotMapGeometry extends MapGeometry {
  dots: { pitch: number; buckets: number };
  regions: Record<string, DotRegion>;
}

/** The geometry with its dot matrix, or null when the pack's geometry has none. */
export function asDotGeometry(geometry: MapGeometry): DotMapGeometry | null {
  const g = geometry as Partial<DotMapGeometry>;
  return g.dots && g.dots.buckets > 0 ? (geometry as DotMapGeometry) : null;
}

/** Grid point (gx, gy) to map units. */
export function dotPoint(geometry: DotMapGeometry, gx: number, gy: number): [number, number] {
  const p = geometry.dots.pitch;
  return [(gx + 0.5) * p, (gy + 0.5) * p];
}

/**
 * Bucket path data ready to draw: zero-length segments become a hundredth of a grid
 * step long, so every renderer draws the round cap (some skip zero-length segments).
 */
export function drawableDots(d: string): string {
  return d.replace(/h0/g, 'h.01');
}
