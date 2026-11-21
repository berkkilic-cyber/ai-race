/**
 * Screen-space things pinned to the map ("anchors"): moment bubbles, data-centre racks,
 * robots, route icons, edge indicators. They keep a constant on-screen size at any zoom
 * because they are not inside the map's scaled layer at all: each is an absolutely
 * positioned view whose position is projected from map units on the UI thread, from the
 * same shared values that drive the map's own transform. Panning or zooming moves them
 * with no React render.
 *
 * Taps: nothing here takes a touch. Things that can be tapped register a target in the
 * map's tap registry (TapTargets); the map's single touch view hit-tests them in JS before
 * the regions.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { finiteOr } from '../svgSafe';
import type { MapView } from '../touchController';
import { toScreenPoint, type Layout } from '../viewTransform';
import type { TapTargets } from './targets';

export { EDGE_INSET, EDGE_MARGIN, TapTargets, edgePoint, type TapTarget } from './targets';

/** The container and map sizes plus the side panel's inset, mirrored for worklets. */
export interface Frame {
  cw: number;
  ch: number;
  mw: number;
  mh: number;
  insetRight: number;
}

export interface MapProjection {
  scale: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  frame: SharedValue<Frame>;
  /** The view and layout of this moment (JS thread), for one-off projections. */
  view(): MapView;
  layout(): Layout;
  targets: TapTargets;
  /** Bring a region into view (centred). */
  focus(regionId: string): void;
}

const ProjectionContext = createContext<MapProjection | null>(null);

export function ProjectionProvider({ value, children }: { value: MapProjection; children: ReactNode }) {
  return <ProjectionContext.Provider value={value}>{children}</ProjectionContext.Provider>;
}

export function useProjection(): MapProjection | null {
  return useContext(ProjectionContext);
}

/** Screen point (container coordinates) of a map point, in a worklet. */
export function project(f: Frame, s: number, x: number, y: number, mx: number, my: number): [number, number] {
  'worklet';
  const l = { cw: f.cw, ch: f.ch, mw: f.mw, mh: f.mh };
  const [px, py] = toScreenPoint(l, s, x, y, mx, my);
  return [finiteOr(px, -9999), finiteOr(py, -9999)];
}

/**
 * Animated style that centres a box of `size` points on a map point plus an offset in
 * points. The view itself must be `position: absolute; left: 0; top: 0`.
 */
export function useAnchorStyle(p: MapProjection, mx: number, my: number, dx: number, dy: number, w: number, h: number = w) {
  const { scale, tx, ty, frame } = p;
  return useAnimatedStyle(() => {
    const [sx, sy] = project(frame.get(), scale.get(), tx.get(), ty.get(), mx, my);
    return { transform: [{ translateX: sx + dx - w / 2 }, { translateY: sy + dy - h / 2 }] };
  });
}
