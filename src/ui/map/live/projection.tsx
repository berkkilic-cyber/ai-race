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

/** The container and map sizes plus the side panel's inset, mirrored for worklets. */
export interface Frame {
  cw: number;
  ch: number;
  mw: number;
  mh: number;
  insetRight: number;
}

export interface TapTarget {
  /** Map point of the anchor. */
  mx: number;
  my: number;
  /** Offset from the anchor in points. */
  dx: number;
  dy: number;
  /** Hit radius in points. */
  r: number;
  onTap(): void;
  /**
   * When the point is off the visible map, an edge indicator stands for it (EDGE_INSET in
   * from the nearest edge); a tap on the indicator calls this instead.
   */
  onEdgeTap?(): void;
}

/** Indicators of off-screen things sit this far in from the edge (centre, points). */
export const EDGE_INSET = 26;
/** A point closer than this to the visible map's edge (or beyond it) counts as off-screen. */
export const EDGE_MARGIN = 6;
const EDGE_HIT = 22;

/** Where the edge indicator of a screen point stands, or null when the point is on screen. */
export function edgePoint(px: number, py: number, right: number, bottom: number): [number, number] | null {
  'worklet';
  if (px >= EDGE_MARGIN && px <= right - EDGE_MARGIN && py >= EDGE_MARGIN && py <= bottom - EDGE_MARGIN) return null;
  const x = Math.min(Math.max(px, EDGE_INSET), Math.max(EDGE_INSET, right - EDGE_INSET));
  const y = Math.min(Math.max(py, EDGE_INSET), Math.max(EDGE_INSET, bottom - EDGE_INSET));
  return [x, y];
}

/** Things on top of the map that take taps before the regions do. Keyed by id; nearest wins. */
export class TapTargets {
  private items = new Map<string, TapTarget>();
  set(id: string, target: TapTarget): void {
    this.items.set(id, target);
  }
  delete(id: string): void {
    this.items.delete(id);
  }
  get size(): number {
    return this.items.size;
  }
  /** The target under a touch-view point, if any (the nearest when several overlap). */
  hit(layout: Layout, v: MapView, px: number, py: number): { id: string; target: TapTarget; edge: boolean } | null {
    let best: { id: string; target: TapTarget; edge: boolean } | null = null;
    let bestD = Infinity;
    const right = Math.max(1, layout.cw - (layout.insetRight ?? 0));
    for (const [id, t] of this.items) {
      const [sx, sy] = toScreenPoint(layout, v.s, v.tx, v.ty, t.mx, t.my);
      const x = sx + t.dx;
      const y = sy + t.dy;
      const edge = t.onEdgeTap ? edgePoint(x, y, right, layout.ch) : null;
      const d = edge ? Math.hypot(edge[0] - px, edge[1] - py) : Math.hypot(x - px, y - py);
      if (d <= (edge ? EDGE_HIT : t.r) && d < bestD) {
        bestD = d;
        best = { id, target: t, edge: !!edge };
      }
    }
    return best;
  }
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
