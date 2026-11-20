/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { aiLabPack } from '@/content';
import { aiLabGeometry } from '@/content/packs/ai-lab/geometry';

import { asDotGeometry } from '../map/dotGeometry';

const ROOT = path.join(__dirname, '..', '..', '..');

describe('map geometry', () => {
  it('is up to date with the build script', () => {
    // Throws (non-zero exit) when geometry.json differs from a fresh build.
    const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'map', 'build-geometry.js'), '--check'], { encoding: 'utf8' });
    expect(out).toContain('up to date');
  }, 60000);

  it('has a path, centroid and bounding box for every region', () => {
    expect(aiLabPack.regions).toHaveLength(40);
    for (const region of aiLabPack.regions) {
      const g = aiLabGeometry.regions[region.id];
      expect(g).toBeDefined();
      expect(g.d.startsWith('M')).toBe(true);
      const [x0, y0, x1, y1] = g.bbox;
      expect(x1).toBeGreaterThan(x0);
      expect(y1).toBeGreaterThan(y0);
      expect(g.centroid[0]).toBeGreaterThanOrEqual(0);
      expect(g.centroid[0]).toBeLessThanOrEqual(aiLabGeometry.width);
      expect(g.centroid[1]).toBeGreaterThanOrEqual(0);
      expect(g.centroid[1]).toBeLessThanOrEqual(aiLabGeometry.height);
    }
    expect(Object.keys(aiLabGeometry.regions).sort()).toEqual(aiLabPack.regions.map((r) => r.id).sort());
  });

  it('stays under 400 KB with the dot matrix', () => {
    const bytes = readFileSync(path.join(ROOT, 'src', 'content', 'packs', 'ai-lab', 'geometry.json')).length;
    expect(bytes).toBeLessThan(400 * 1024);
  });

  it('has a dot matrix: every region has its dots in a fixed number of buckets on the grid', () => {
    const dots = asDotGeometry(aiLabGeometry);
    expect(dots).not.toBeNull();
    const { pitch, buckets } = dots!.dots;
    expect(buckets).toBeGreaterThanOrEqual(8);
    expect(buckets).toBeLessThanOrEqual(12);
    const cols = Math.floor(aiLabGeometry.width / pitch);
    const rows = Math.floor(aiLabGeometry.height / pitch);
    const seen = new Set<string>();
    let total = 0;
    for (const region of aiLabPack.regions) {
      const g = dots!.regions[region.id];
      expect(g.dots).toHaveLength(buckets);
      expect(g.dotCount).toBeGreaterThanOrEqual(3);
      let count = 0;
      for (const d of g.dots) {
        for (const m of d.matchAll(/M(\d+) (\d+)h0/g)) {
          const [gx, gy] = [Number(m[1]), Number(m[2])];
          expect(gx).toBeLessThan(cols);
          expect(gy).toBeLessThan(rows);
          // A grid point belongs to one region only.
          expect(seen.has(`${gx},${gy}`)).toBe(false);
          seen.add(`${gx},${gy}`);
          count++;
        }
      }
      expect(count).toBe(g.dotCount);
      total += count;
    }
    // Enough dots for the world to read at the 788x322 whole-world view.
    expect(total).toBeGreaterThan(5000);
  });

  it('orders each region outward from its marker point (first bucket nearer than the last)', () => {
    const dots = asDotGeometry(aiLabGeometry)!;
    const { pitch } = dots.dots;
    const mean = (d: string, [mx, my]: [number, number]) => {
      const pts = [...d.matchAll(/M(\d+) (\d+)h0/g)].map((m) => Math.hypot((Number(m[1]) + 0.5) * pitch - mx, (Number(m[2]) + 0.5) * pitch - my));
      return pts.reduce((a, b) => a + b, 0) / pts.length;
    };
    for (const id of ['usa', 'russia', 'brazil', 'australia']) {
      const g = dots.regions[id];
      expect(mean(g.dots[0], g.centroid)).toBeLessThan(mean(g.dots[g.dots.length - 1], g.centroid));
    }
  });

  it('keeps the polar region a thin strip at the bottom', () => {
    const [, y0, , y1] = aiLabGeometry.regions['far-south'].bbox;
    expect(y1 - y0).toBeLessThan(aiLabGeometry.height * 0.12);
    expect(y0).toBeGreaterThan(aiLabGeometry.height * 0.8);
  });
});
