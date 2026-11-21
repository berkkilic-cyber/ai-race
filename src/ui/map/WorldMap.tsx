import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { logLifecycle } from '../diagnostics/log';
import { t } from '../i18n';
import { measureView, useTutorialTargetMeasure } from '../tutorial/targets';
import { colors, radius, spacing, touch, voice } from '../theme';
import { asDotGeometry } from './dotGeometry';
import { DotLayer } from './DotLayer';
import { MapDebugOverlay } from './MapDebugOverlay';
import { OverlayLayer } from './OverlayLayer';
import { createHitTester, nearestRegion } from './hitTest';
import { onMapFocus } from './mapFocus';
import { RegionLayer } from './RegionLayer';
import { RippleLayer } from './RippleLayer';
import { SitesLayer } from './SitesLayer';
import { recordTouch } from './touchDebug';
import type { MapView } from './touchController';
import { WEB_TOUCH, useMapTouch } from './useMapTouch';
import { focusScale, layoutDecision, panelDecision, roundSize, type Size } from './viewPolicy';
import { MAX_SCALE, centreOn, clampScale, clampTranslate, fit, fitWorld, toMapPoint, toScreenPoint, zoomAbout, type Layout } from './viewTransform';

export interface WorldMapProps {
  geometry: MapGeometry;
  selected: string | null;
  onSelect: (regionId: string) => void;
  /** A tap that hit no region (empty sea). */
  onTapEmpty?: () => void;
  /** Region the default view centres on (the player's home). */
  focusRegion?: string;
  /** Zoom of the reset view in 'focus' mode. Default: just enough for the map to fill the container's height. */
  defaultScale?: number;
  /**
   * Default (and reset) view: 'focus' zooms to fill the container and centres focusRegion;
   * 'world' fits the whole world into the container. Default 'focus'.
   */
  defaultView?: 'focus' | 'world';
  /**
   * Width covered on the right by an overlay (the side panel). While it is non-zero and a
   * region is selected, the map pans so the selection is centred in the uncovered part.
   */
  insetRight?: number;
  /** Where the zoom buttons sit. Default 'topRight'. */
  controls?: 'topRight' | 'bottomLeft';
  /** Another control drawn with the zoom buttons (the Regions list button). */
  extraControl?: ReactNode;
  /** Change the nonce to bring a region into view (centred, zoomed in if it is small), e.g. after picking it from a list. */
  centreRequest?: { regionId: string; nonce: number } | null;
}

/** Regions smaller than this (map units²) also take taps within HIT_RADIUS of their centroid. */
const SMALL_REGION_AREA = 150;
const HIT_RADIUS = 7;
const WHEEL_STEP = 0.0015;
const BUTTON_ZOOM = 1.6;
const CONTROL = 34;
const CONTROL_SLOP = (touch - CONTROL) / 2;
/** Largest side of the tutorial's home-region target. */
const HOME_TARGET_MAX = 96;
/** A tap that misses every shape still picks a region whose marker is this close (points). */
const NEAR_TAP_PT = 22;
/** The tutorial zooms in until the home region is at least this big on screen (points). */
const FOCUS_MIN_SIDE = 110;
const ANIM_MS = 300;
const FOCUS_MS = 450;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** `[AI-RACE] gesture view changed` at the end of a gesture (or when the wheel rests). */
function logView(source: string, v: MapView) {
  logLifecycle('gesture view changed', { source, scale: round2(v.s), tx: Math.round(v.tx), ty: Math.round(v.ty) });
}

/** A quiet round map control (zoom in, out, reset) with a full 44-point touch area. */
export function MapControl({ glyph, onPress, label, testID }: { glyph: string; onPress: () => void; label: string; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={CONTROL_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.ctrl, pressed && styles.ctrlPressed]}
    >
      <Text style={styles.ctrlGlyph}>{glyph}</Text>
    </Pressable>
  );
}

/**
 * The living world map: the dot matrix (or region fills for a pack without dots), data
 * centres, overlays and launch ripples, moved by a view transform.
 *
 * Touch: one plain touch view above the drawing takes every touch through React Native's
 * core responder system (useMapTouch, the same system as every button) and a pure
 * controller turns them into pan, pinch, tap and double tap. Nothing of the drawing takes
 * touches (pointerEvents none); taps are hit-tested in JS. The view lives in a ref and is
 * pushed to three shared values that drive the native transform: no React state per move.
 * Web: the same touch view takes mouse drags and taps; the wheel zooms around the cursor.
 */
export function WorldMap({
  geometry,
  selected,
  onSelect,
  onTapEmpty,
  focusRegion,
  defaultScale,
  defaultView = 'focus',
  insetRight = 0,
  controls = 'topRight',
  extraControl,
  centreRequest,
}: WorldMapProps) {
  const regionIds = useMemo(() => Object.keys(geometry.regions), [geometry]);
  const dots = useMemo(() => asDotGeometry(geometry), [geometry]);
  const hitTester = useMemo(() => createHitTester(geometry, SMALL_REGION_AREA, HIT_RADIUS), [geometry]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const layout = useRef<Layout>({ cw: 1, ch: 1, mw: geometry.width, mh: geometry.height });

  // The view: the ref is the truth (read and written by touches, buttons and policies on the
  // JS thread); the shared values drive the native transform.
  const view = useRef<MapView>({ s: 1, tx: 0, ty: 0 });
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  /** Until when an animation set by applyView may still be running (ms, Date.now). */
  const animatingUntil = useRef(0);
  const home = useRef<[number, number, number]>([1, 0, 0]);
  /** True once the player has moved the view (gesture, wheel, zoom button) since the last fit or reset. */
  const custom = useRef(false);
  /** The rounded size the view was last fitted to (null before the first layout). */
  const fitted = useRef<Size | null>(null);

  const applyView = useCallback(
    (v: MapView, animateMs = 0) => {
      view.current = v;
      recordTouch({ view: v });
      if (animateMs > 0) {
        animatingUntil.current = Date.now() + animateMs + 50;
        scale.set(withTiming(v.s, { duration: animateMs }));
        tx.set(withTiming(v.tx, { duration: animateMs }));
        ty.set(withTiming(v.ty, { duration: animateMs }));
        return;
      }
      scale.set(v.s);
      tx.set(v.tx);
      ty.set(v.ty);
    },
    [scale, tx, ty],
  );

  const computeHome = useCallback(
    (l: Layout): [number, number, number] => {
      if (defaultView === 'world') return fitWorld(l);
      const focus = focusRegion ? geometry.regions[focusRegion] : undefined;
      const { k } = fit(l);
      const s = clampScale(defaultScale ?? Math.max(l.cw / (l.mw * k), l.ch / (l.mh * k)));
      if (!focus) return [s, 0, 0];
      const [x, y] = centreOn(l, s, focus.centroid[0], focus.centroid[1]);
      return [s, x, y];
    },
    [focusRegion, geometry, defaultScale, defaultView],
  );

  // The view is fitted once per real size change (whole points). Native re-measures the map
  // whenever something around it re-lays out; those repeat events with the same size, or a
  // size change while the player has a view of their own, never throw the view away.
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      const next = roundSize(width, height);
      const decision = layoutDecision(fitted.current, next, custom.current);
      if (decision === 'none' || !next) return;
      fitted.current = next;
      setSize({ w: width, h: height });
      const l: Layout = { cw: width, ch: height, mw: geometry.width, mh: geometry.height, insetRight: layout.current.insetRight ?? 0 };
      layout.current = l;
      recordTouch({ layout: { w: width, h: height } });
      const h = computeHome(l);
      home.current = h;
      if (decision === 'clamp') {
        const v = view.current;
        const [x, y] = clampTranslate(l, v.s, v.tx, v.ty);
        applyView({ s: v.s, tx: x, ty: y });
        logLifecycle('view clamped', { reason: 'resize', w: next.w, h: next.h });
        return;
      }
      applyView({ s: h[0], tx: h[1], ty: h[2] });
      logLifecycle('view refit', { reason: decision === 'first' ? 'first-layout' : 'resize', w: next.w, h: next.h });
    },
    [geometry, computeHome, applyView],
  );

  // The side panel opened, closed or changed selection: keep the selection centred in the
  // uncovered part of the map, or settle back into the full container. Only an actual change
  // of the panel moves the view; a re-render, a resize or a new geometry object does not.
  const focusId = insetRight > 0 ? selected : null;
  const shownFocus = useRef<string | null>(null);
  const hasSize = size.w > 0;
  useEffect(() => {
    if (!hasSize) return;
    const l: Layout = { ...layout.current, insetRight };
    layout.current = l;
    const decision = panelDecision(shownFocus.current, focusId);
    shownFocus.current = focusId;
    if (decision === 'none') return;
    const region = focusId ? geometry.regions[focusId] : undefined;
    const v = view.current;
    const [x, y] = region ? centreOn(l, v.s, region.centroid[0], region.centroid[1]) : clampTranslate(l, v.s, v.tx, v.ty);
    applyView({ s: v.s, tx: x, ty: y }, ANIM_MS);
    logLifecycle('view refit', { reason: decision === 'centre' ? 'panel-open' : 'panel-close', region: focusId ?? undefined });
  }, [insetRight, focusId, hasSize, geometry, applyView]);

  const resetView = useCallback(() => {
    const l = layout.current;
    const region = focusId ? geometry.regions[focusId] : undefined;
    // With the panel open, the reset view keeps the selection in sight beside it.
    let [s, x, y] = home.current;
    if (region && defaultView === 'world') {
      s = 1;
      [x, y] = centreOn(l, s, region.centroid[0], region.centroid[1]);
    }
    custom.current = false;
    applyView({ s, tx: x, ty: y }, ANIM_MS);
    logLifecycle('view refit', { reason: 'reset' });
  }, [layout, focusId, geometry, defaultView, applyView]);

  const zoomBy = useCallback(
    (factor: number, fx?: number, fy?: number) => {
      const l = layout.current;
      const v = view.current;
      const s1 = clampScale(v.s * factor);
      const [zx, zy] = zoomAbout(l, v.s, s1, v.tx, v.ty, fx ?? visibleCentre(l), fy ?? l.ch / 2);
      const [x, y] = clampTranslate(l, s1, zx, zy);
      custom.current = true;
      applyView({ s: s1, tx: x, ty: y });
    },
    [applyView],
  );
  const zoomButton = useCallback(
    (factor: number) => {
      zoomBy(factor);
      logView('button', view.current);
    },
    [zoomBy],
  );

  // Bring a region into easy reach: zoom in if it is small on screen; with `centre`, also
  // centre it when no zoom is needed. A request before the first layout waits for it.
  const pendingFocus = useRef<{ id: string; centre: boolean } | null>(null);
  const focusOn = useCallback(
    (regionId: string, centre: boolean, reason: string) => {
      const region = geometry.regions[regionId];
      if (!region) return;
      if (!fitted.current) {
        pendingFocus.current = { id: regionId, centre };
        return;
      }
      pendingFocus.current = null;
      const l = layout.current;
      const v = view.current;
      const [x0, y0] = toScreenPoint(l, v.s, v.tx, v.ty, region.bbox[0], region.bbox[1]);
      const [x1, y1] = toScreenPoint(l, v.s, v.tx, v.ty, region.bbox[2], region.bbox[3]);
      const zoomTo = focusScale(v.s, x1 - x0, y1 - y0, FOCUS_MIN_SIDE, MAX_SCALE);
      if (zoomTo === null && !centre) return;
      const target = zoomTo ?? v.s;
      const [x, y] = centreOn(l, target, region.centroid[0], region.centroid[1]);
      custom.current = true;
      applyView({ s: target, tx: x, ty: y }, FOCUS_MS);
      logLifecycle('view refit', { reason, region: regionId, scale: round2(target) });
    },
    [geometry, applyView],
  );
  useEffect(() => onMapFocus((id) => focusOn(id, false, 'tutorial-focus')), [focusOn]);
  useEffect(() => {
    if (hasSize && pendingFocus.current) focusOn(pendingFocus.current.id, pendingFocus.current.centre, 'pending-focus');
  }, [hasSize, focusOn]);
  // Declared after the panel effect, so in the commit that opens a panel and asks to centre,
  // the layout already has the panel's inset and this (later) animation wins.
  const centreNonce = centreRequest?.nonce;
  const centreId = centreRequest?.regionId;
  useEffect(() => {
    if (centreId && centreNonce !== undefined) focusOn(centreId, true, 'list-pick');
  }, [centreNonce, centreId, focusOn]);

  // A tap in touch-view points: converted with the view of this moment and hit-tested. A miss
  // within a finger's width of a region's marker still picks that region; the sea is "none".
  const handleTap = useCallback(
    (px: number, py: number) => {
      const l = layout.current;
      const v = view.current;
      const [mx, my] = toMapPoint(l, v.s, v.tx, v.ty, px, py);
      const pointsPerUnit = fit(l).k * v.s;
      let id = hitTester.at(mx, my);
      if (!id && pointsPerUnit > 0) id = nearestRegion(geometry, mx, my, NEAR_TAP_PT / pointsPerUnit);
      recordTouch({ region: id ?? 'none' });
      logLifecycle('region tapped', { region: id ?? 'none', x: Math.round(px), y: Math.round(py), scale: round2(v.s) });
      if (id) onSelect(id);
      else onTapEmpty?.();
    },
    [hitTester, geometry, onSelect, onTapEmpty],
  );

  const mapTouch = useMapTouch('game', {
    layout: () => layout.current,
    view: () => view.current,
    setView: (v) => {
      custom.current = true;
      applyView(v);
    },
    begin: () => {
      // A touch during an animation (reset, panel centring): stop it where it is and continue from there.
      if (Date.now() > animatingUntil.current) return;
      animatingUntil.current = 0;
      cancelAnimation(scale);
      cancelAnimation(tx);
      cancelAnimation(ty);
      view.current = { s: scale.get(), tx: tx.get(), ty: ty.get() };
    },
    tap: handleTap,
    doubleTap: resetView,
    gestureEnd: (kind, v) => logView(kind, v),
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  // Web: zoom with the mouse wheel around the cursor (logged once the wheel rests).
  const container = useRef<HostInstance>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = container.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    let rest: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * WHEEL_STEP), e.clientX - rect.left, e.clientY - rect.top);
      clearTimeout(rest);
      rest = setTimeout(() => logView('wheel', view.current), 250);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(rest);
      el.removeEventListener('wheel', onWheel);
    };
  }, [zoomBy]);

  // Tutorial target "map.home": a square around the focus region's marker point, in window coordinates.
  const measureHome = useMemo(() => {
    const region = focusRegion ? geometry.regions[focusRegion] : undefined;
    if (!region || !hasSize) return null;
    return async () => {
      const box = await measureView(container.current as unknown as Parameters<typeof measureView>[0]);
      if (!box) return null;
      const l = layout.current;
      const { s, tx: x, ty: y } = view.current;
      const [px, py] = toScreenPoint(l, s, x, y, region.centroid[0], region.centroid[1]);
      const [x0, y0] = toScreenPoint(l, s, x, y, region.bbox[0], region.bbox[1]);
      const [x1, y1] = toScreenPoint(l, s, x, y, region.bbox[2], region.bbox[3]);
      const side = Math.min(HOME_TARGET_MAX, Math.max(touch, Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 0.6));
      const left = Math.max(0, Math.min(box.width - side, px - side / 2));
      const top = Math.max(0, Math.min(box.height - side, py - side / 2));
      return { x: box.x + left, y: box.y + top, width: Math.min(side, box.width), height: Math.min(side, box.height) };
    };
  }, [focusRegion, geometry, hasSize]);
  useTutorialTargetMeasure('map.home', measureHome);

  const [, , vw, vh] = geometry.viewBox;
  const viewBox = `0 0 ${vw} ${vh}`;
  return (
    <View style={styles.root} pointerEvents="box-none">
      <View ref={container} style={styles.container} onLayout={onLayout} collapsable={false} pointerEvents="box-none" testID="world-map">
        {size.w > 0 ? (
          // The drawing takes no touches: every touch goes to the touch view above it.
          <Animated.View style={[styles.fill, animatedStyle]} pointerEvents="none">
            {/* Three stacked SVG canvases with the same box and viewBox. A native SVG view redraws
                all of its content when any animated prop changes, so the data-centre pulse (every
                frame) and launch ripples get canvases of their own and never redraw the ~500 dot paths. */}
            <Svg width={size.w} height={size.h} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" pointerEvents="none" style={styles.canvas}>
              {dots ? <DotLayer geometry={dots} regionIds={regionIds} selected={selected} /> : <RegionLayer geometry={geometry} regionIds={regionIds} />}
            </Svg>
            <Svg width={size.w} height={size.h} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" pointerEvents="none" style={styles.canvas}>
              <SitesLayer geometry={geometry} />
            </Svg>
            <Svg width={size.w} height={size.h} viewBox={viewBox} preserveAspectRatio="xMidYMid meet" pointerEvents="none" style={styles.canvas}>
              <OverlayLayer geometry={geometry} selected={selected} />
              <RippleLayer geometry={geometry} />
            </Svg>
          </Animated.View>
        ) : null}
        {/* The touch view: a real native view (collapsable false) with no children, above the drawing. */}
        <View style={[styles.fill, WEB_TOUCH]} collapsable={false} testID="map-touch" {...mapTouch.props} />
        <MapDebugOverlay />
      </View>
      {/* Controls sit above the touch view and keep their own Pressables. The extra control (Regions) sits beside the zoom column, towards the map. */}
      <View style={[styles.controls, controls === 'bottomLeft' ? styles.bottomLeft : styles.topRight]} pointerEvents="box-none">
        {controls === 'topRight' ? extraControl : null}
        <View style={styles.column} pointerEvents="box-none">
          <MapControl glyph="+" onPress={() => zoomButton(BUTTON_ZOOM)} label={t('ui.map.zoomIn')} testID="map-zoom-in" />
          <MapControl glyph="−" onPress={() => zoomButton(1 / BUTTON_ZOOM)} label={t('ui.map.zoomOut')} testID="map-zoom-out" />
          <MapControl glyph="↺" onPress={resetView} label={t('ui.map.reset')} testID="map-reset" />
        </View>
        {controls === 'bottomLeft' ? extraControl : null}
      </View>
    </View>
  );
}

/** Horizontal centre of the part of the map not covered by a side panel. */
function visibleCentre(l: Layout): number {
  return Math.max(1, l.cw - (l.insetRight ?? 0)) / 2;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.transparent, overflow: 'hidden' },
  container: { flex: 1, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  canvas: { position: 'absolute', top: 0, left: 0 },
  controls: { position: 'absolute', flexDirection: 'row', gap: spacing.s + 2 },
  column: { gap: spacing.s + 2 },
  topRight: { right: spacing.m, top: spacing.m, alignItems: 'flex-start' },
  bottomLeft: { left: spacing.m, bottom: spacing.m, alignItems: 'flex-end' },
  ctrl: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlPressed: { backgroundColor: colors.raised, transform: [{ scale: 0.92 }] },
  ctrlGlyph: { ...voice.calmNumber, color: colors.text, fontSize: 18, lineHeight: 21 },
});
