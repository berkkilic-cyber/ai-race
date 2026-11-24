/**
 * The lab room drawing: every stage's room stays within the node budget at its fullest,
 * passes only finite numbers and drawable paths to SVG (even with a bad ceiling), and the
 * bubbles' layout helpers keep clear of the tap target.
 */
import type { ReactElement, ReactNode } from 'react';
import { act, Fragment, isValidElement } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import { isDrawablePath } from '../../map/svgSafe';
import { clearSpan, overlaps, roomTint, RoomDrawing, spotPosition } from '../LabRoom';
import { PixelRoom } from '../PixelRoom';
import { hasPixelArt, pixelLevels } from '../pixelLevels';
import { stageAccent, stageColour } from '../stageColors';

jest.mock('react-native-svg', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const host = (type: string) => {
    const C = (props: Record<string, unknown>) => React.createElement(type, props);
    C.displayName = type;
    return C;
  };
  const mod: Record<string, unknown> = { __esModule: true, default: host('Svg') };
  for (const n of ['Svg', 'G', 'Path', 'Circle', 'Rect', 'Line']) mod[n] = host(n);
  return mod;
});

// The drawing itself uses no animation; the module only needs Reanimated to load.
jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual('react-native');
  const Animated = { View: RN.View, Text: RN.Text, createAnimatedComponent: (c: unknown) => c };
  return { __esModule: true, default: Animated, ...Animated, useAnimatedStyle: () => ({}), useReducedMotion: () => false, useSharedValue: (v: unknown) => ({ get: () => v, set: () => undefined }) };
});

interface JsonNode {
  type: string;
  props: Record<string, unknown>;
  children: JsonNode[];
}

/** Renders hook-free components (memo unwrapped) down to the mocked SVG host elements. */
function toJson(node: ReactNode): JsonNode[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(toJson);
  if (!isValidElement(node)) throw new Error(`unexpected child: ${String(node)}`);
  const el = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === Fragment) return toJson(el.props.children);
  const t = el.type as unknown as { type?: unknown };
  const fn = typeof el.type === 'function' ? el.type : typeof t === 'object' && t && typeof t.type === 'function' ? t.type : null;
  if (fn) return toJson((fn as (p: unknown) => ReactNode)(el.props));
  if (typeof el.type !== 'string') throw new Error('unexpected element type');
  const { children, ...props } = el.props;
  return [{ type: el.type, props, children: toJson(children) }];
}

function all(nodes: JsonNode[]): JsonNode[] {
  return nodes.flatMap((n) => [n, ...all(n.children)]);
}

const SCENES = ['garage', 'office', 'datacentre', 'town', 'latent'];
const FULL = { desks: 5, racks: 8, shelf: [] };
const SIZES = [
  [349, 290],
  [390, 330],
  [700, 170],
];

describe('lab room', () => {
  it.each(SCENES)('%s: at most 80 SVG nodes at its fullest, all numbers finite, all paths drawable', (scene) => {
    for (const [w, h] of SIZES) {
      for (const ceiling of [0, 86, Number.NaN, 5000]) {
        const nodes = all(toJson(<RoomDrawing scene={scene} buckets={FULL} w={w} h={h} ceiling={ceiling} />));
        expect(nodes.length).toBeGreaterThan(5);
        expect(nodes.length).toBeLessThanOrEqual(80);
        for (const n of nodes) {
          for (const [k, v] of Object.entries(n.props)) {
            if (typeof v === 'number') expect([scene, k, Number.isFinite(v)]).toEqual([scene, k, true]);
            if (typeof v === 'string') expect([scene, k, /NaN|undefined|Infinity/.test(v)]).toEqual([scene, k, false]);
            if (k === 'd') expect([scene, isDrawablePath(v as string)]).toEqual([scene, true]);
          }
        }
      }
    }
  });

  it('an empty room still draws its walls; a zero size draws nothing', () => {
    expect(all(toJson(<RoomDrawing scene="garage" buckets={{ desks: 0, racks: 0, shelf: [] }} w={349} h={290} ceiling={90} />)).length).toBeGreaterThan(4);
    expect(toJson(<RoomDrawing scene="garage" buckets={FULL} w={0} h={290} ceiling={90} />)).toEqual([]);
  });

  it('the drawn stages take their palette: each looks like its own place', () => {
    const tints = SCENES.map((scene) => roomTint(scene));
    expect(new Set(tints.map((t) => t.surface)).size).toBe(SCENES.length);
    expect(new Set(tints.map((t) => t.player)).size).toBe(SCENES.length);
    expect(roomTint('datacentre').player).toBe(stageColour('datacentre', 'a'));
    expect(roomTint('town').second).toBe(stageColour('town', 's'));
    // An unknown scene falls back to the theme.
    expect(roomTint('nowhere').surface).toMatch(/^#/);
    expect(stageAccent('nowhere')).toBeNull();
    // Accents are distinct per stage and none is the alarm red.
    const accents = SCENES.map((s) => stageAccent(s));
    expect(new Set(accents).size).toBe(SCENES.length);
    for (const a of accents) expect(a).not.toMatch(/^#FF(2D|3B|6B|00)/i);
  });

  it('the pixel room draws the garage and the office from a handful of images, and nothing at a bad size', () => {
    expect(SCENES.filter(hasPixelArt)).toEqual(['garage', 'office']);
    const images = (node: TestInstance): number => (node.type === 'Image' ? 1 : 0) + node.children.reduce<number>((a, c) => a + (typeof c === 'string' ? 0 : images(c)), 0);
    const full = pixelLevels({ intern: 200, gpu: 200, closet: 200, scraper: 200, hall: 200, chips: 1, power: 1, robotics: 1, orbital: 1, universe: 1 });
    for (const scene of ['garage', 'office']) {
      const root = createRoot();
      act(() => root.render(<PixelRoom scene={scene} levels={pixelLevels({})} w={349} h={290} />));
      const empty = images(root.container);
      act(() => root.render(<PixelRoom scene={scene} levels={full} w={349} h={290} />));
      const most = images(root.container);
      expect(empty).toBeGreaterThanOrEqual(2);
      expect(most).toBeGreaterThan(empty);
      expect(most).toBeLessThanOrEqual(12);
      for (const bad of [Number.NaN, 0, -5, Infinity]) {
        act(() => root.render(<PixelRoom scene={scene} levels={full} w={bad} h={290} />));
        expect(images(root.container)).toBe(0);
      }
      act(() => root.unmount());
    }
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
