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
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

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

/**
 * Web: things that change every frame on their own (pulsing bubbles, banners and floating
 * lines on the move) get a compositor layer, so they never repaint the map under them. The
 * anchor plane and edge markers do not (they move only while panning, and extra layers
 * cost more there than they save). Native moves views on the UI thread anyway.
 */
export const MOVING: ViewStyle | null = Platform.OS === 'web' ? ({ willChange: 'transform, opacity' } as unknown as ViewStyle) : null;

/** Screen point (container coordinates) of a map point, in a worklet. */
export function project(f: Frame, s: number, x: number, y: number, mx: number, my: number): [number, number] {
  'worklet';
  const l = { cw: f.cw, ch: f.ch, mw: f.mw, mh: f.mh };
  const [px, py] = toScreenPoint(l, s, x, y, mx, my);
  return [finiteOr(px, -9999), finiteOr(py, -9999)];
}

/**
 * Anchors are split in two so panning is cheap: screen = plane + local, where the plane
 * offset (t + c(1 - s)) depends on the pan and the local point (s(o + m k)) only on the
 * zoom. One AnchorPlane carries the pan for all its children; a child's own style reads only
 * the scale, so a pan moves one view instead of every anchor.
 */
export function planeOffset(f: Frame, s: number, x: number, y: number): [number, number] {
  'worklet';
  return [finiteOr(x + (f.cw / 2) * (1 - s), 0), finiteOr(y + (f.ch / 2) * (1 - s), 0)];
}

/** A map point relative to the anchor plane (see planeOffset), in a worklet. */
export function local(f: Frame, s: number, mx: number, my: number): [number, number] {
  'worklet';
  const raw = Math.min(f.cw / f.mw, f.ch / f.mh);
  const k = Number.isFinite(raw) && raw > 0 ? raw : 1;
  const ox = (f.cw - f.mw * k) / 2;
  const oy = (f.ch - f.mh * k) / 2;
  return [finiteOr(s * (ox + mx * k), -9999), finiteOr(s * (oy + my * k), -9999)];
}

/** The view that carries the pan for anchors inside it. */
export function AnchorPlane({ p, children }: { p: MapProjection; children: ReactNode }) {
  const { scale, tx, ty, frame } = p;
  const style = useAnimatedStyle(() => {
    const [x, y] = planeOffset(frame.get(), scale.get(), tx.get(), ty.get());
    return { transform: [{ translateX: x }, { translateY: y }] };
  });
  return (
    <Animated.View style={[styles.plane, style]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

/**
 * Animated style that centres a box of `size` points on a map point plus an offset in
 * points, for a view inside an AnchorPlane (`position: absolute; left: 0; top: 0`).
 */
export function useAnchorStyle(p: MapProjection, mx: number, my: number, dx: number, dy: number, w: number, h: number = w) {
  const { scale, frame } = p;
  return useAnimatedStyle(() => {
    const [lx, ly] = local(frame.get(), scale.get(), mx, my);
    return { transform: [{ translateX: lx + dx - w / 2 }, { translateY: ly + dy - h / 2 }] };
  });
}

const styles = StyleSheet.create({
  plane: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' },
});
