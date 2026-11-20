import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { t } from '../i18n';
import { measureView, useTutorialTargetMeasure } from '../tutorial/targets';
import { colors, radius, spacing, touch, voice } from '../theme';
import { asDotGeometry } from './dotGeometry';
import { DotLayer } from './DotLayer';
import { OverlayLayer } from './OverlayLayer';
import { createHitTester } from './hitTest';
import { RegionLayer } from './RegionLayer';
import { RippleLayer } from './RippleLayer';
import { SitesLayer } from './SitesLayer';
import { centreOn, clampScale, clampTranslate, fit, fitWorld, toMapPoint, toScreenPoint, zoomAbout, type Layout } from './viewTransform';

export interface WorldMapProps {
  geometry: MapGeometry;
  selected: string | null;
  onSelect: (regionId: string) => void;
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
export function WorldMap({ geometry, selected, onSelect, focusRegion, defaultScale, defaultView = 'focus', insetRight = 0, controls = 'topRight' }: WorldMapProps) {
  const regionIds = useMemo(() => Object.keys(geometry.regions), [geometry]);
  const dots = useMemo(() => asDotGeometry(geometry), [geometry]);
  const hitTester = useMemo(() => createHitTester(geometry, SMALL_REGION_AREA, HIT_RADIUS), [geometry]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const layout = useSharedValue<Layout>({ cw: 1, ch: 1, mw: geometry.width, mh: geometry.height });

  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);
  const home = useSharedValue<[number, number, number]>([1, 0, 0]);

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

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      // Ignore the zero-sized first layout: the view maths needs a real size.
      if (!(width > 0 && height > 0) || (width === size.w && height === size.h)) return;
      const first = size.w === 0;
      setSize({ w: width, h: height });
      const l: Layout = { cw: width, ch: height, mw: geometry.width, mh: geometry.height, insetRight };
      layout.set(l);
      const h = computeHome(l);
      home.set(h);
      if (first) {
        scale.set(h[0]);
        tx.set(h[1]);
        ty.set(h[2]);
      } else {
        const [x, y] = clampTranslate(l, scale.get(), tx.get(), ty.get());
        tx.set(x);
        ty.set(y);
      }
    },
    [size, geometry, computeHome, layout, home, scale, tx, ty, insetRight],
  );

  // The side panel opened, closed or changed selection: keep the selection centred in the
  // uncovered part of the map, or settle back into the full container.
  const focusId = insetRight > 0 ? selected : null;
  useEffect(() => {
    if (size.w === 0) return;
    const l: Layout = { ...layout.get(), insetRight };
    layout.set(l);
    const region = focusId ? geometry.regions[focusId] : undefined;
    const [x, y] = region ? centreOn(l, scale.get(), region.centroid[0], region.centroid[1]) : clampTranslate(l, scale.get(), tx.get(), ty.get());
    tx.set(withTiming(x));
    ty.set(withTiming(y));
  }, [insetRight, focusId, size, geometry, layout, scale, tx, ty]);

  const resetView = useCallback(() => {
    const l = layout.get();
    const region = focusId ? geometry.regions[focusId] : undefined;
    // With the panel open, the reset view keeps the selection in sight beside it.
    let [s, x, y] = home.get();
    if (region && defaultView === 'world') {
      s = 1;
      [x, y] = centreOn(l, s, region.centroid[0], region.centroid[1]);
    }
    scale.set(withTiming(s));
    tx.set(withTiming(x));
    ty.set(withTiming(y));
  }, [home, scale, tx, ty, layout, focusId, geometry, defaultView]);

  const zoomBy = useCallback(
    (factor: number, fx?: number, fy?: number) => {
      const l = layout.get();
      const s0 = scale.get();
      const s1 = clampScale(s0 * factor);
      const [zx, zy] = zoomAbout(l, s0, s1, tx.get(), ty.get(), fx ?? l.cw / 2, fy ?? l.ch / 2);
      const [x, y] = clampTranslate(l, s1, zx, zy);
      scale.set(s1);
      tx.set(x);
      ty.set(y);
    },
    [layout, scale, tx, ty],
  );

  const pan = Gesture.Pan()
    .minDistance(8)
    .averageTouches(true)
    .onStart(() => {
      startTx.set(tx.get());
      startTy.set(ty.get());
    })
    .onUpdate((e) => {
      const [x, y] = clampTranslate(layout.get(), scale.get(), startTx.get() + e.translationX, startTy.get() + e.translationY);
      tx.set(x);
      ty.set(y);
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.set(scale.get());
      startTx.set(tx.get());
      startTy.set(ty.get());
    })
    .onUpdate((e) => {
      const l = layout.get();
      const s1 = clampScale(startScale.get() * e.scale);
      const [zx, zy] = zoomAbout(l, scale.get(), s1, tx.get(), ty.get(), e.focalX, e.focalY);
      const [x, y] = clampTranslate(l, s1, zx, zy);
      scale.set(s1);
      tx.set(x);
      ty.set(y);
    });

  const doubleTap = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .onEnd(() => resetView());

  // Taps are hit-tested in JS (instead of onPress on each path) so a drag never selects a region.
  const select = useCallback(
    (px: number, py: number) => {
      const [x, y] = toMapPoint(layout.get(), scale.get(), tx.get(), ty.get(), px, py);
      const id = hitTester.at(x, y);
      if (id) onSelect(id);
    },
    [layout, scale, tx, ty, hitTester, onSelect],
  );
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(10)
    .onEnd((e, success) => {
      if (success) select(e.x, e.y);
    });

  const gesture = Gesture.Simultaneous(pan, pinch, Gesture.Exclusive(doubleTap, tap));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  // Web: zoom with the mouse wheel around the cursor.
  const container = useRef<HostInstance>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = container.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * WHEEL_STEP), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // Tutorial target "map.home": a square around the focus region's marker point, in window coordinates.
  const hasSize = size.w > 0;
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
            <Animated.View style={[styles.fill, animatedStyle]}>
              <Svg width={size.w} height={size.h} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
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
        <MapControl glyph="+" onPress={() => zoomBy(BUTTON_ZOOM)} label={t('ui.map.zoomIn')} />
        <MapControl glyph="−" onPress={() => zoomBy(1 / BUTTON_ZOOM)} label={t('ui.map.zoomOut')} />
        <MapControl glyph="↺" onPress={resetView} label={t('ui.map.reset')} testID="map-reset" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.transparent, overflow: 'hidden' },
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
