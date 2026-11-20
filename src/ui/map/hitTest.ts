import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

type Ring = number[]; // flat [x0, y0, x1, y1, ...]

interface RegionShape {
  id: string;
  bbox: [number, number, number, number];
  rings: Ring[];
  centroid: [number, number];
  area: number;
}

/** Parses the M/L/Z path data written by the geometry script into rings. */
export function parseRings(d: string): Ring[] {
  const rings: Ring[] = [];
  let current: Ring | null = null;
  const re = /([MLZ])([^MLZ]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase();
    const nums = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === 'M') {
      current = [];
      rings.push(current);
    }
    if (cmd === 'Z') {
      current = null;
      continue;
    }
    if (!current) {
      current = [];
      rings.push(current);
    }
    for (let i = 0; i + 1 < nums.length; i += 2) current.push(nums[i], nums[i + 1]);
  }
  return rings.filter((r) => r.length >= 6);
}

function insideRing(ring: Ring, x: number, y: number): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = ring[i];
    const yi = ring[i + 1];
    const xj = ring[j];
    const yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface HitTester {
  /** Region at a map point: small regions within `radius` of their centroid first, then shapes (even-odd). */
  at(x: number, y: number): string | null;
}

export function createHitTester(geometry: MapGeometry, smallArea: number, radius: number): HitTester {
  const shapes: RegionShape[] = Object.entries(geometry.regions).map(([id, g]) => ({
    id,
    bbox: g.bbox,
    rings: parseRings(g.d),
    centroid: g.centroid,
    area: g.area,
  }));
  const small = shapes.filter((s) => s.area < smallArea);
  return {
    at(x, y) {
      let best: string | null = null;
      let bestDist = radius * radius;
      for (const s of small) {
        const dx = s.centroid[0] - x;
        const dy = s.centroid[1] - y;
        const dist = dx * dx + dy * dy;
        if (dist <= bestDist) {
          bestDist = dist;
          best = s.id;
        }
      }
      if (best) return best;
      for (const s of shapes) {
        const [x0, y0, x1, y1] = s.bbox;
        if (x < x0 || x > x1 || y < y0 || y > y1) continue;
        let inside = false;
        for (const ring of s.rings) if (insideRing(ring, x, y)) inside = !inside;
        if (inside) return s.id;
      }
      return null;
    },
  };
}

/** The region whose centroid is nearest to a map point, if within `maxDist` map units. */
export function nearestRegion(geometry: MapGeometry, x: number, y: number, maxDist: number): string | null {
  let best: string | null = null;
  let bestDist = maxDist * maxDist;
  for (const [id, g] of Object.entries(geometry.regions)) {
    const dx = g.centroid[0] - x;
    const dy = g.centroid[1] - y;
    const d = dx * dx + dy * dy;
    if (d <= bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}
