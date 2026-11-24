/**
 * @jest-environment node
 *
 * The Garage's pixel art: the generator (scripts/pixel) is deterministic and the files on
 * disk are a fresh render of the sources; every image the scenes reference exists at 1x,
 * 2x and 3x at whole multiples of its display size; the layers keep to their slots (no
 * two tiers draw on the same pixel, except the intern standing in the hall's doorway) and
 * clear of the model; the count buckets.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import fs from 'node:fs';
import path from 'node:path';

import { ART_FILES, DP_PER_PIXEL, LEVELS, PIXEL_SCENES, ROOM_H, ROOM_W } from '../art/manifest';
import palettes from '../art/palettes.json';
import { levelOf, pixelKey, pixelLevels } from '../pixelLevels';
import { PALETTE_SCENES, stageAccent } from '../stageColors';

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const build = require(path.join(ROOT, 'scripts', 'pixel', 'build.js'));
const { decodeIndexed } = require(path.join(ROOT, 'scripts', 'pixel', 'png.js'));
const { SCENES } = require(path.join(ROOT, 'scripts', 'pixel', 'scenes.js')) as { SCENES: { id: string }[] };

describe('pixel art generator', () => {
  const first: Map<string, Buffer> = build.renderAll();

  it('renders the same bytes twice, and the files on disk match the sources', () => {
    const second: Map<string, Buffer> = build.renderAll();
    expect([...second.keys()]).toEqual([...first.keys()]);
    for (const [file, buf] of first) {
      expect([file, second.get(file)?.equals(buf)]).toEqual([file, true]);
      const rel = path.relative(ROOT, file);
      // `npm run pixel` writes these; a stale file means the sprites changed without a render.
      expect([rel, fs.existsSync(file) && fs.readFileSync(file).equals(buf)]).toEqual([rel, true]);
    }
  });

  it('every image the scenes use exists at 1x, 2x and 3x, at whole multiples of the display size', () => {
    const dir = path.join(ROOT, 'assets', 'garage');
    expect(ART_FILES.length).toBeGreaterThan(10);
    for (const name of ART_FILES) {
      const sizes = ['', '@2x', '@3x'].map((suffix) => {
        const file = path.join(dir, `${name}${suffix}.png`);
        expect([file, fs.existsSync(file)]).toEqual([file, true]);
        const { width, height } = decodeIndexed(fs.readFileSync(file));
        return { width, height };
      });
      // 1x is the display size: a whole number of art pixels at DP_PER_PIXEL dp each.
      expect(sizes[0].width % DP_PER_PIXEL).toBe(0);
      expect(sizes[0].height % DP_PER_PIXEL).toBe(0);
      expect(sizes[1]).toEqual({ width: sizes[0].width * 2, height: sizes[0].height * 2 });
      expect(sizes[2]).toEqual({ width: sizes[0].width * 3, height: sizes[0].height * 3 });
    }
    const room = decodeIndexed(fs.readFileSync(path.join(dir, 'garage-room.png')));
    expect(room.width).toBe(ROOM_W * DP_PER_PIXEL);
    expect(room.height).toBe(ROOM_H * DP_PER_PIXEL);
  });

  it('keeps assets/garage under 1.5 MB', () => {
    const dir = path.join(ROOT, 'assets', 'garage');
    const bytes = fs.readdirSync(dir).reduce((a, f) => a + fs.statSync(path.join(dir, f)).size, 0);
    expect(bytes).toBeLessThan(1.5 * 1024 * 1024);
  });

  it('each stage has 12 to 18 colours and an accent; drawn stages use only their palette', () => {
    for (const id of PALETTE_SCENES) {
      const colours = new Set(Object.values((palettes.stages as Record<string, { colours: Record<string, string> }>)[id].colours));
      expect(colours.size).toBeGreaterThanOrEqual(12);
      expect(colours.size).toBeLessThanOrEqual(18);
      expect(stageAccent(id)).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(PALETTE_SCENES.sort()).toEqual(['datacentre', 'garage', 'latent', 'office', 'town']);
    expect(Object.keys(PIXEL_SCENES).sort()).toEqual(['garage', 'office']);
  });
});

describe('pixel scenes layout', () => {
  type Layer = { id: string; x: number; y: number; c: { w: number; h: number; px: Uint8Array } };
  const layersOf = (scene: { tiers: Record<string, { slot: { x: number; y: number }; draw: (l: number, f: number) => Layer['c'] }>; ambient: { id: string; x: number; y: number; frames: (f: number) => Layer['c'] }[] }): Layer[] => [
    ...Object.entries(scene.tiers).map(([id, t]) => ({ id, x: t.slot.x, y: t.slot.y, c: t.draw(LEVELS.length, 0) })),
    ...scene.ambient.map((a) => ({ id: a.id, x: a.x, y: a.y, c: a.frames(0) })),
  ];
  const pixels = (l: Layer) => {
    const out = new Set<number>();
    for (let j = 0; j < l.c.h; j++) for (let i = 0; i < l.c.w; i++) if (l.c.px[j * l.c.w + i]) out.add((l.y + j) * 1000 + l.x + i);
    return out;
  };

  it.each(SCENES.map((s) => [s.id, s] as [string, unknown]))('%s: no two layers draw on the same pixel at the fullest', (_id, scene) => {
    const layers = layersOf(scene as Parameters<typeof layersOf>[0]);
    const sets = layers.map(pixels);
    for (let a = 0; a < layers.length; a++)
      for (let b = a + 1; b < layers.length; b++) {
        const pair = [layers[a].id, layers[b].id].sort().join('+');
        // The intern who walks in stands in the hall's doorway on purpose.
        if (pair === 'hall+intern') continue;
        let shared = 0;
        for (const p of sets[a]) if (sets[b].has(p)) shared++;
        expect([pair, shared]).toEqual([pair, 0]);
      }
  });

  it.each(SCENES.map((s) => [s.id, s] as [string, unknown]))('%s: layers stay inside the room and clear of the model', (_id, scene) => {
    for (const l of layersOf(scene as Parameters<typeof layersOf>[0])) {
      expect(l.x >= 0 && l.y >= 0 && l.x + l.c.w <= ROOM_W && l.y + l.c.h <= ROOM_H).toBe(true);
      // The model itself (about 46 art pixels square, centred, above the combo row).
      for (const p of pixels(l)) {
        const x = p % 1000;
        const y = Math.floor(p / 1000);
        expect([l.id, x > 88 && x < 128 && y > 104 && y < 146]).toEqual([l.id, false]);
      }
    }
  });

  it('every tier slot has art at every count level from the first', () => {
    for (const [id, scene] of Object.entries(PIXEL_SCENES)) {
      for (const t of ['intern', 'gpu', 'closet', 'scraper', 'hall']) {
        const tier = scene.tiers[t];
        expect([id, t, tier.levels.length]).toEqual([id, t, LEVELS.length + 1]);
        expect(tier.levels[0]).toBeNull();
        for (let l = 1; l <= LEVELS.length; l++) expect([id, t, l, !!tier.levels[l]]).toEqual([id, t, l, true]);
      }
    }
  });
});

describe('count buckets', () => {
  it('levels follow the steps 1, 5, 10, 25, 50, 100', () => {
    expect(LEVELS).toEqual([1, 5, 10, 25, 50, 100]);
    expect([0, 1, 4, 5, 9, 10, 24, 25, 49, 50, 99, 100, 5000].map(levelOf)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
    expect([Number.NaN, -3, Infinity].map(levelOf)).toEqual([0, 0, 0]);
  });
  it('the shelf shows up to the highest later tier owned; the key changes only with a bucket', () => {
    expect(pixelLevels({ intern: 3, power: 1 }).shelf).toBe(2);
    expect(pixelLevels({ universe: 2 }).shelf).toBe(5);
    expect(pixelLevels({}).shelf).toBe(0);
    expect(pixelKey(pixelLevels({ intern: 6 }))).toBe(pixelKey(pixelLevels({ intern: 9 })));
    expect(pixelKey(pixelLevels({ intern: 9 }))).not.toBe(pixelKey(pixelLevels({ intern: 10 })));
  });
});
