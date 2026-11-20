import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { logLifecycle } from '../diagnostics/log';
import { t } from '../i18n';
import { measureView, useTutorialTargetMeasure } from '../tutorial/targets';
import { colors, radius, spacing, touch, voice } from '../theme';
import { asDotGeometry } from './dotGeometry';
import { DotLayer } from './DotLayer';
import { OverlayLayer } from './OverlayLayer';
import { createHitTester, nearestRegion } from './hitTest';
import { onMapFocus } from './mapFocus';
import { RegionLayer } from './RegionLayer';
import { RippleLayer } from './RippleLayer';
import { SitesLayer } from './SitesLayer';
import { focusScale, layoutDecision, panelDecision, roundSize, type Size } from './viewPolicy';
import { MAX_SCALE, centreOn, panBy, clampScale, clampTranslate, fit, fitWorld, toMapPoint, toScreenPoint, zoomAbout, type Layout } from './viewTransform';

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
/** Travel before a touch becomes a pan; until then it can still be a tap. */
const PAN_MIN_DISTANCE = 8;
/** A tap may wander this far (points) and still count. */
const TAP_SLOP = 10;
/** Each tap of a double tap is shorter than this, and the second follows within DOUBLE_TAP_DELAY_MS. */
const TAP_MAX_MS = 250;
const DOUBLE_TAP_DELAY_MS = 300;
/** A tap that misses every shape still picks a region whose marker is this close (points). */
const NEAR_TAP_PT = 22;
/** The tutorial zooms in until the home region is at least this big on screen (points). */
const FOCUS_MIN_SIDE = 110;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** `[AI-RACE] gesture view changed` at the end of a gesture (or when the wheel rests). */
function logView(source: string, s: number, x: number, y: number) {
  logLifecycle('gesture view changed', { source, scale: round2(s), tx: Math.round(x), ty: Math.round(y) });
}

/** A quiet round map control (zoom in, out, reset) with a full 44-point touch area. */
function MapControl({ glyph, onPress, label, testID }: { glyph: string; onPress: () => void; label: string; testID?: string }) {
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
 * centres, overlays and launch ripples in one SVG,
 * moved by a view transform. Pan and pinch on touch, drag and wheel on web,
 * double tap or the reset button to return to the default view.
 */
export function WorldMap({ geometry, selected, onSelect, onTapEmpty, focusRegion, defaultScale, defaultView = 'focus', insetRight = 0, controls = 'topRight' }: WorldMapProps) {
  const regionIds = useMemo(() => Object.keys(geometry.regions), [geometry]);
  const dots = useMemo(() => asDotGeometry(geometry), [geometry]);
  const hitTester = useMemo(() => createHitTester(geometry, SMALL_REGION_AREA, HIT_RADIUS), [geometry]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const layout = useSharedValue<Layout>({ cw: 1, ch: 1, mw: geometry.width, mh: geometry.height });

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const lastPan = useSharedValue<[number, number]>([0, 0]);
  const panAnchor = useSharedValue<[number, number]>([0, 0]);
  const home = useSharedValue<[number, number, number]>([1, 0, 0]);
  /** True once the player has moved the view (gesture, wheel, zoom button) since the last fit or reset. */
  const custom = useSharedValue(false);
  /** The rounded size the view was last fitted to (null before the first layout). */
  const fitted = useRef<Size | null>(null);

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
      const decision = layoutDecision(fitted.current, next, custom.get());
      if (decision === 'none' || !next) return;
      fitted.current = next;
      setSize({ w: width, h: height });
      const l: Layout = { cw: width, ch: height, mw: geometry.width, mh: geometry.height, insetRight: layout.get().insetRight ?? 0 };
      layout.set(l);
      const h = computeHome(l);
      home.set(h);
      if (decision === 'clamp') {
        const [x, y] = clampTranslate(l, scale.get(), tx.get(), ty.get());
        tx.set(x);
        ty.set(y);
        logLifecycle('view clamped', { reason: 'resize', w: next.w, h: next.h });
        return;
      }
      scale.set(h[0]);
      tx.set(h[1]);
      ty.set(h[2]);
      logLifecycle('view refit', { reason: decision === 'first' ? 'first-layout' : 'resize', w: next.w, h: next.h });
    },
    [geometry, computeHome, layout, home, scale, tx, ty, custom],
  );

  // The side panel opened, closed or changed selection: keep the selection centred in the
  // uncovered part of the map, or settle back into the full container. Only an actual change
  // of the panel moves the view; a re-render, a resize or a new geometry object does not.
  const focusId = insetRight > 0 ? selected : null;
  const shownFocus = useRef<string | null>(null);
  const hasSize = size.w > 0;
  useEffect(() => {
    if (!hasSize) return;
    const l: Layout = { ...layout.get(), insetRight };
    layout.set(l);
    const decision = panelDecision(shownFocus.current, focusId);
    shownFocus.current = focusId;
    if (decision === 'none') return;
    const region = focusId ? geometry.regions[focusId] : undefined;
    const [x, y] = region ? centreOn(l, scale.get(), region.centroid[0], region.centroid[1]) : clampTranslate(l, scale.get(), tx.get(), ty.get());
    tx.set(withTiming(x));
    ty.set(withTiming(y));
    logLifecycle('view refit', { reason: decision === 'centre' ? 'panel-open' : 'panel-close', region: focusId ?? undefined });
  }, [insetRight, focusId, hasSize, geometry, layout, scale, tx, ty]);

  const resetView = useCallback(() => {
    const l = layout.get();
    const region = focusId ? geometry.regions[focusId] : undefined;
    // With the panel open, the reset view keeps the selection in sight beside it.
    let [s, x, y] = home.get();
    if (region && defaultView === 'world') {
      s = 1;
      [x, y] = centreOn(l, s, region.centroid[0], region.centroid[1]);
    }
    custom.set(false);
    scale.set(withTiming(s));
    tx.set(withTiming(x));
    ty.set(withTiming(y));
    logLifecycle('view refit', { reason: 'reset' });
  }, [home, scale, tx, ty, layout, focusId, geometry, defaultView, custom]);

  const zoomBy = useCallback(
    (factor: number, fx?: number, fy?: number) => {
      const l = layout.get();
      const s0 = scale.get();
      const s1 = clampScale(s0 * factor);
      const [zx, zy] = zoomAbout(l, s0, s1, tx.get(), ty.get(), fx ?? l.cw / 2, fy ?? l.ch / 2);
      const [x, y] = clampTranslate(l, s1, zx, zy);
      custom.set(true);
      scale.set(s1);
      tx.set(x);
      ty.set(y);
    },
    [layout, scale, tx, ty, custom],
  );
  const zoomButton = useCallback(
    (factor: number) => {
      zoomBy(factor);
      logView('button', scale.get(), tx.get(), ty.get());
    },
    [zoomBy, scale, tx, ty],
  );

  // The tutorial asks for the home region before "tap your home region": zoom in if it is
  // small on screen, so it is an easy target. A request before the first layout waits for it.
  const pendingFocus = useRef<string | null>(null);
  const focusOn = useCallback(
    (regionId: string) => {
      const region = geometry.regions[regionId];
      if (!region) return;
      if (!fitted.current) {
        pendingFocus.current = regionId;
        return;
      }
      pendingFocus.current = null;
      const l = layout.get();
      const s = scale.get();
      const [x0, y0] = toScreenPoint(l, s, tx.get(), ty.get(), region.bbox[0], region.bbox[1]);
      const [x1, y1] = toScreenPoint(l, s, tx.get(), ty.get(), region.bbox[2], region.bbox[3]);
      const target = focusScale(s, x1 - x0, y1 - y0, FOCUS_MIN_SIDE, MAX_SCALE);
      if (target === null) return;
      const [x, y] = centreOn(l, target, region.centroid[0], region.centroid[1]);
      custom.set(true);
      scale.set(withTiming(target, { duration: 450 }));
      tx.set(withTiming(x, { duration: 450 }));
      ty.set(withTiming(y, { duration: 450 }));
      logLifecycle('view refit', { reason: 'tutorial-focus', region: regionId, scale: round2(target) });
    },
    [geometry, layout, scale, tx, ty, custom],
  );
  useEffect(() => onMapFocus(focusOn), [focusOn]);
  useEffect(() => {
    if (hasSize && pendingFocus.current) focusOn(pendingFocus.current);
  }, [hasSize, focusOn]);

  // A tap arrives here (JS thread) already converted to map units on the UI thread, with the
  // transform as it was at that moment. A miss within a finger's width of a region's marker
  // still picks that region; a tap on empty sea reports "none".
  const handleTap = useCallback(
    (mx: number, my: number, pointsPerUnit: number) => {
      let id = hitTester.at(mx, my);
      if (!id && pointsPerUnit > 0) id = nearestRegion(geometry, mx, my, NEAR_TAP_PT / pointsPerUnit);
      logLifecycle('region tapped', { region: id ?? 'none' });
      if (id) onSelect(id);
      else onTapEmpty?.();
    },
    [hitTester, geometry, onSelect, onTapEmpty],
  );
  // Gesture callbacks run on the UI thread and reach JS through scheduleOnRN. The gestures are
  // rebuilt only when these handlers change (a new selection or geometry), not on every render.
  const gesture = useMemo(() => {
    // Pan and pinch move the view on the UI thread with no React work during the gesture.
    // The pan needs PAN_MIN_DISTANCE of travel, so a touch that stays put stays a tap.
    const pan = Gesture.Pan()
      .minDistance(PAN_MIN_DISTANCE)
      .averageTouches(true)
      .onBegin((e) => {
        panAnchor.set([e.absoluteX, e.absoluteY]);
        lastPan.set([0, 0]);
      })
      .onStart((e) => {
        // The travel before activation (the slop) is left out of the translation on some
        // platforms: add it once, so the content stays under a single finger from touch-down.
        lastPan.set([e.translationX, e.translationY]);
        if (e.numberOfPointers !== 1) return;
        const [ax, ay] = panAnchor.get();
        const [x, y] = panBy(layout.get(), scale.get(), tx.get(), ty.get(), e.absoluteX - ax, e.absoluteY - ay);
        tx.set(x);
        ty.set(y);
      })
      .onUpdate((e) => {
        // Applied as deltas, so a pinch's focal correction in between is kept.
        const [lx, ly] = lastPan.get();
        lastPan.set([e.translationX, e.translationY]);
        const [x, y] = panBy(layout.get(), scale.get(), tx.get(), ty.get(), e.translationX - lx, e.translationY - ly);
        tx.set(x);
        ty.set(y);
      })
      .onEnd(() => {
        custom.set(true);
        scheduleOnRN(logView, 'pan', scale.get(), tx.get(), ty.get());
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        startScale.set(scale.get());
      })
      .onUpdate((e) => {
        const l = layout.get();
        const s1 = clampScale(startScale.get() * e.scale);
        const [zx, zy] = zoomAbout(l, scale.get(), s1, tx.get(), ty.get(), e.focalX, e.focalY);
        const [x, y] = clampTranslate(l, s1, zx, zy);
        scale.set(s1);
        tx.set(x);
        ty.set(y);
      })
      .onEnd(() => {
        custom.set(true);
        scheduleOnRN(logView, 'pinch', scale.get(), tx.get(), ty.get());
      });

    // A double tap resets the view. It must be two short one-finger taps that stay put:
    // without these limits iOS counts two quick pinches or flicks as a double tap.
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDistance(TAP_SLOP)
      .maxDuration(TAP_MAX_MS)
      .maxDelay(DOUBLE_TAP_DELAY_MS)
      .onStart((e) => {
        if (e.numberOfPointers > 1) return;
        scheduleOnRN(resetView);
      });

    // A single tap is hit-tested in JS (instead of onPress on each path) so a drag never
    // selects a region. The point is converted with the transform read here, on the UI thread.
    const tap = Gesture.Tap()
      .maxDistance(TAP_SLOP)
      .onStart((e) => {
        if (e.numberOfPointers > 1) return;
        const l = layout.get();
        const s = scale.get();
        const [mx, my] = toMapPoint(l, s, tx.get(), ty.get(), e.x, e.y);
        scheduleOnRN(handleTap, mx, my, fit(l).k * s);
      });

    // Moving the map and tapping exclude each other: once a pan or pinch activates, a tap in
    // progress is cancelled, and a tap waits only for the double tap to fail.
    return Gesture.Race(Gesture.Simultaneous(pan, pinch), Gesture.Exclusive(doubleTap, tap));
  }, [layout, scale, tx, ty, startScale, lastPan, panAnchor, custom, handleTap, resetView]);

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
      rest = setTimeout(() => logView('wheel', scale.get(), tx.get(), ty.get()), 250);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(rest);
      el.removeEventListener('wheel', onWheel);
    };
  }, [zoomBy, scale, tx, ty]);

  // Tutorial target "map.home": a square around the focus region's marker point, in window coordinates.
  const measureHome = useMemo(() => {
    const region = focusRegion ? geometry.regions[focusRegion] : undefined;
    if (!region || !hasSize) return null;
    return async () => {
      const box = await measureView(container.current as unknown as Parameters<typeof measureView>[0]);
      if (!box) return null;
      const l = layout.get();
      const s = scale.get();
      const [px, py] = toScreenPoint(l, s, tx.get(), ty.get(), region.centroid[0], region.centroid[1]);
      const [x0, y0] = toScreenPoint(l, s, tx.get(), ty.get(), region.bbox[0], region.bbox[1]);
      const [x1, y1] = toScreenPoint(l, s, tx.get(), ty.get(), region.bbox[2], region.bbox[3]);
      const side = Math.min(HOME_TARGET_MAX, Math.max(touch, Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 0.6));
      const left = Math.max(0, Math.min(box.width - side, px - side / 2));
      const top = Math.max(0, Math.min(box.height - side, py - side / 2));
      return { x: box.x + left, y: box.y + top, width: Math.min(side, box.width), height: Math.min(side, box.height) };
    };
  }, [focusRegion, geometry, hasSize, layout, scale, tx, ty]);
  useTutorialTargetMeasure('map.home', measureHome);

  const [, , vw, vh] = geometry.viewBox;
  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View ref={container} style={styles.container} onLayout={onLayout} collapsable={false}>
          {size.w > 0 ? (
            // The map content takes no touches itself: every touch goes to the container the
            // gestures are attached to (and native SVG never hit-tests hundreds of paths).
            <Animated.View style={[styles.fill, animatedStyle]} pointerEvents="none">
              <Svg width={size.w} height={size.h} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet" pointerEvents="none">
                {dots ? <DotLayer geometry={dots} regionIds={regionIds} selected={selected} /> : <RegionLayer geometry={geometry} regionIds={regionIds} />}
                <SitesLayer geometry={geometry} />
                <OverlayLayer geometry={geometry} selected={selected} />
                <RippleLayer geometry={geometry} />
              </Svg>
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
      <View style={[styles.controls, controls === 'bottomLeft' ? styles.bottomLeft : styles.topRight]} pointerEvents="box-none">
        <MapControl glyph="+" onPress={() => zoomButton(BUTTON_ZOOM)} label={t('ui.map.zoomIn')} />
        <MapControl glyph="−" onPress={() => zoomButton(1 / BUTTON_ZOOM)} label={t('ui.map.zoomOut')} />
        <MapControl glyph="↺" onPress={resetView} label={t('ui.map.reset')} testID="map-reset" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  container: { flex: 1, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  controls: { position: 'absolute', gap: spacing.s + 2 },
  topRight: { right: spacing.m, top: spacing.m },
  bottomLeft: { left: spacing.m, bottom: spacing.m },
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
