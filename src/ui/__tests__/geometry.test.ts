/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { aiLabPack } from '@/content';
import { aiLabGeometry } from '@/content/packs/ai-lab/geometry';

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

  it('stays well under 300 KB', () => {
    const bytes = readFileSync(path.join(ROOT, 'src', 'content', 'packs', 'ai-lab', 'geometry.json')).length;
    expect(bytes).toBeLessThan(300 * 1024);
  });

  it('keeps the polar region a thin strip at the bottom', () => {
    const [, y0, , y1] = aiLabGeometry.regions['far-south'].bbox;
    expect(y1 - y0).toBeLessThan(aiLabGeometry.height * 0.12);
    expect(y0).toBeGreaterThan(aiLabGeometry.height * 0.8);
  });
});
