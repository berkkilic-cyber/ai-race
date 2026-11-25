/**
 * The lab room: every stage is a pixel room drawn from a handful of images (and nothing at
 * a bad size), the model stands on its stage's plinth, each stage has its own accent, and
 * the bubbles' layout helpers keep clear of the tap target.
 */
import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import { clearSpan, overlaps, spotPosition } from '../LabRoom';
import { hasPlinth, ModelPlinth, PixelRoom } from '../PixelRoom';
import { hasPixelArt, pixelLevels } from '../pixelLevels';
import { stageAccent, stageColour } from '../stageColors';

// The room only needs Reanimated to load (the loops' styles are inert here).
jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual('react-native');
  const Animated = { View: RN.View, Text: RN.Text, createAnimatedComponent: (c: unknown) => c };
  return { __esModule: true, default: Animated, ...Animated, useAnimatedStyle: () => ({}), useReducedMotion: () => false, useSharedValue: (v: unknown) => ({ get: () => v, set: () => undefined }) };
});

const SCENES = ['garage', 'office', 'datacentre', 'town', 'latent'];

const imageNodes = (node: TestInstance): TestInstance[] => [...(node.type === 'Image' ? [node] : []), ...node.children.flatMap((c) => (typeof c === 'string' ? [] : imageNodes(c)))];
const images = (node: TestInstance): number => (node.type === 'Image' ? 1 : 0) + node.children.reduce<number>((a, c) => a + (typeof c === 'string' ? 0 : images(c)), 0);

describe('lab room', () => {
  it('each stage has its own accent and palette; none is the alarm red', () => {
    const accents = SCENES.map((s) => stageAccent(s));
    expect(new Set(accents).size).toBe(SCENES.length);
    for (const a of accents) expect(a).not.toMatch(/^#FF(2D|3B|6B|00)/i);
    expect(new Set(SCENES.map((s) => stageColour(s, 'w'))).size).toBe(SCENES.length);
    expect(stageAccent('nowhere')).toBeNull();
    expect(stageColour('nowhere', 'w')).toBeNull();
  });

  it('every stage is a pixel room from a handful of images (at most 13, plus the plinth), and nothing at a bad size', () => {
    expect(SCENES.filter(hasPixelArt)).toEqual(SCENES);
    const full = pixelLevels({ intern: 200, gpu: 200, closet: 200, scraper: 200, hall: 200, chips: 200, power: 200, robotics: 200, orbital: 200, universe: 200 });
    for (const scene of SCENES) {
      const root = createRoot();
      act(() => root.render(<PixelRoom scene={scene} levels={pixelLevels({})} w={349} h={290} />));
      const empty = images(root.container);
      act(() => root.render(<PixelRoom scene={scene} levels={full} w={349} h={290} />));
      const most = images(root.container);
      expect([scene, empty >= 2]).toEqual([scene, true]);
      expect([scene, most > empty]).toEqual([scene, true]);
      expect([scene, most]).toEqual([scene, Math.min(most, 13)]);
      for (const bad of [Number.NaN, 0, -5, Infinity]) {
        act(() => root.render(<PixelRoom scene={scene} levels={full} w={bad} h={290} />));
        expect(images(root.container)).toBe(0);
      }
      act(() => root.unmount());
    }
    const root = createRoot();
    act(() => root.render(<PixelRoom scene="nowhere" levels={full} w={349} h={290} />));
    expect(images(root.container)).toBe(0);
    act(() => root.unmount());
  });

  it('the model stands on its stage\'s plinth: one image under its feet, whole dp, nothing at a bad size', () => {
    for (const scene of SCENES) {
      expect(hasPlinth(scene)).toBe(true);
      const root = createRoot();
      act(() => root.render(<ModelPlinth scene={scene} size={150} mascot={93} />));
      const found = imageNodes(root.container);
      expect(found).toHaveLength(1);
      const style = Object.assign({}, ...[found[0].props.style].flat(2).filter(Boolean)) as { left: number; top: number; width: number };
      expect(Number.isInteger(style.left) && Number.isInteger(style.top)).toBe(true);
      // Centred under the model, its top face just under the feet (the model's feet are at 30/32 of its height).
      expect(Math.abs(style.left + style.width / 2 - 112.5)).toBeLessThanOrEqual(1);
      expect(style.top).toBeGreaterThan(75 + 93 * 0.4375 - 12);
      expect(style.top).toBeLessThan(75 + 93 * 0.4375);
      for (const bad of [Number.NaN, 0, -1, Infinity]) {
        act(() => root.render(<ModelPlinth scene={scene} size={bad} mascot={93} />));
        expect(imageNodes(root.container)).toHaveLength(0);
      }
      act(() => root.unmount());
    }
    expect(hasPlinth('nowhere')).toBe(false);
  });

  it('bubbles keep to their side of the tap target', () => {
    const ring = { x: 96, y: 105, w: 156, h: 156 };
    const w = 349;
    const left = clearSpan(spotPosition('desk', 0.5, 0.5, w, 290).x, w, ring);
    expect(left.hi).toBeLessThanOrEqual(ring.x);
    const right = clearSpan(spotPosition('rack', 0.5, 0.5, w, 290).x, w, ring);
    expect(right.lo).toBeGreaterThanOrEqual(ring.x + ring.w);
    expect(right.hi).toBeLessThanOrEqual(w);
    expect(clearSpan(10, w, null)).toEqual({ lo: 2, hi: w - 2 });
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
  });
});
