import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { Button } from '../components/Button';
import { t } from '../i18n';
import { colors, spacing } from '../theme';
import { OverlayLayer } from './OverlayLayer';
import { createHitTester } from './hitTest';
import { RegionLayer } from './RegionLayer';
import { SitesLayer } from './SitesLayer';
import { centreOn, clampScale, clampTranslate, fit, toMapPoint, zoomAbout, type Layout } from './viewTransform';

export interface WorldMapProps {
  geometry: MapGeometry;
  selected: string | null;
  onSelect: (regionId: string) => void;
  /** Region the default view centres on (the player's home). */
  focusRegion?: string;
  /** Zoom of the reset view. Default: just enough for the map to fill the container's height. */
  defaultScale?: number;
}

/** Regions smaller than this (map units²) also take taps within HIT_RADIUS of their centroid. */
const SMALL_REGION_AREA = 150;
const HIT_RADIUS = 7;
const WHEEL_STEP = 0.0015;
const BUTTON_ZOOM = 1.6;

/**
 * The living world map: region fills, overlays and data centre dots in one SVG,
 * moved by a view transform. Pan and pinch on touch, drag and wheel on web,
 * double tap or the reset button to return to the default view.
 */
export function WorldMap({ geometry, selected, onSelect, focusRegion, defaultScale }: WorldMapProps) {
  const regionIds = useMemo(() => Object.keys(geometry.regions), [geometry]);
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
      const focus = focusRegion ? geometry.regions[focusRegion] : undefined;
      const { k } = fit(l);
      const s = clampScale(defaultScale ?? Math.max(l.cw / (l.mw * k), l.ch / (l.mh * k)));
      if (!focus) return [s, 0, 0];
      const [x, y] = centreOn(l, s, focus.centroid[0], focus.centroid[1]);
      return [s, x, y];
    },
    [focusRegion, geometry, defaultScale],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width === size.w && height === size.h) return;
      const first = size.w === 0;
      setSize({ w: width, h: height });
      const l: Layout = { cw: width, ch: height, mw: geometry.width, mh: geometry.height };
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
    [size, geometry, computeHome, layout, home, scale, tx, ty],
  );

  const resetView = useCallback(() => {
    const [s, x, y] = home.get();
    scale.set(withTiming(s));
    tx.set(withTiming(x));
    ty.set(withTiming(y));
  }, [home, scale, tx, ty]);

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
    .numberOfTaps(2)
    .onEnd(() => {
      const [s, x, y] = home.get();
      scale.set(withTiming(s));
      tx.set(withTiming(x));
      ty.set(withTiming(y));
    });

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

  const [, , vw, vh] = geometry.viewBox;
  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View ref={container} style={styles.container} onLayout={onLayout} collapsable={false}>
          {size.w > 0 ? (
            <Animated.View style={[styles.fill, animatedStyle]}>
              <Svg width={size.w} height={size.h} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
                <RegionLayer geometry={geometry} regionIds={regionIds} />
                <OverlayLayer geometry={geometry} selected={selected} />
                <SitesLayer geometry={geometry} />
              </Svg>
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
      <View style={styles.controls} pointerEvents="box-none">
        <Button label="+" compact onPress={() => zoomBy(BUTTON_ZOOM)} accessibilityLabel={t('ui.map.zoomIn')} style={styles.ctrl} />
        <Button label="−" compact onPress={() => zoomBy(1 / BUTTON_ZOOM)} accessibilityLabel={t('ui.map.zoomOut')} style={styles.ctrl} />
        <Button label="⟲" compact onPress={resetView} accessibilityLabel={t('ui.map.reset')} style={styles.ctrl} testID="map-reset" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  container: { flex: 1, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  controls: { position: 'absolute', right: spacing.s, top: spacing.s, gap: spacing.s },
  ctrl: { width: 44, height: 44, paddingHorizontal: 0, opacity: 0.9 },
});
