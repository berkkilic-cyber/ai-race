import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { Button } from '../components/Button';
import { t } from '../i18n';
import { createHitTester } from '../map/hitTest';
import { mixColor } from '../map/mapColors';
import { centreOn, clampScale, clampTranslate, fit, toMapPoint, zoomAbout, type Layout } from '../map/viewTransform';
import { colors, radius, spacing } from '../theme';
import { MapShapes, type MapDot, type MapOutline } from './MapShapes';

export interface RivalHome {
  regionId: string;
  color: string;
}

export interface RegionPickerMapProps {
  geometry: MapGeometry;
  selected: string | null;
  onSelect: (regionId: string) => void;
  /** Rival headquarters, drawn as small dots in their colours. */
  rivalHomes: readonly RivalHome[];
  /** Change the nonce to centre the map on a region (e.g. after picking it from the list). */
  focus: { regionId: string; nonce: number } | null;
  /** Fill the parent (wide layout) instead of sizing by the map's aspect ratio. */
  fill?: boolean;
}

/** Picker taps are coarser than the game map's: small regions answer within this radius (map units). */
const SMALL_REGION_AREA = 400;
const HIT_RADIUS = 10;
const WHEEL_STEP = 0.0015;
const BUTTON_ZOOM = 1.6;
/** Zoom used when focusing a small region from the list. */
const FOCUS_SCALE = 3;
/** Regions at least this large (map units²) are not zoomed to. */
const FOCUS_MAX_AREA = 1200;

/**
 * World map in picker mode: tap a region to choose it; the chosen one is filled
 * in the player colour. Pan and pinch (drag and wheel on web), +/− buttons,
 * double tap to reset. No game state is read.
 */
export function RegionPickerMap({ geometry, selected, onSelect, rivalHomes, focus, fill }: RegionPickerMapProps) {
  const hitTester = useMemo(() => createHitTester(geometry, SMALL_REGION_AREA, HIT_RADIUS), [geometry]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const layout = useSharedValue<Layout>({ cw: 1, ch: 1, mw: geometry.width, mh: geometry.height });
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startTx = useSharedValue(0);
  const startTy = useSharedValue(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      // Ignore the zero-sized first layout: the view maths needs a real size.
      if (!(width > 0 && height > 0) || (width === size.w && height === size.h)) return;
      setSize({ w: width, h: height });
      const l: Layout = { cw: width, ch: height, mw: geometry.width, mh: geometry.height };
      layout.set(l);
      const [x, y] = clampTranslate(l, scale.get(), tx.get(), ty.get());
      tx.set(x);
      ty.set(y);
    },
    [size, geometry, layout, scale, tx, ty],
  );

  const resetView = useCallback(() => {
    scale.set(withTiming(1));
    tx.set(withTiming(0));
    ty.set(withTiming(0));
  }, [scale, tx, ty]);

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

  // Centre on a region chosen elsewhere; zoom in when it is small.
  useEffect(() => {
    if (!focus || size.w === 0) return;
    const g = geometry.regions[focus.regionId];
    // Large regions are easy to see on the whole map: leave the view alone.
    if (!g || g.area >= FOCUS_MAX_AREA) return;
    const l = layout.get();
    const { k } = fit(l);
    const [x0, y0, x1, y1] = g.bbox;
    const fitScale = Math.min(l.cw / ((x1 - x0) * k * 1.6), l.ch / ((y1 - y0) * k * 1.6));
    const s = clampScale(Math.max(scale.get(), Math.min(FOCUS_SCALE, fitScale)));
    const [x, y] = centreOn(l, s, (x0 + x1) / 2, (y0 + y1) / 2);
    scale.set(withTiming(s));
    tx.set(withTiming(x));
    ty.set(withTiming(y));
    // Only a new nonce should move the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, size.w]);

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
      scale.set(withTiming(1));
      tx.set(withTiming(0));
      ty.set(withTiming(0));
    });

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

  const fills = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const home of rivalHomes) out[home.regionId] = mixColor(colors.dotRest, home.color, 0.6);
    if (selected) out[selected] = colors.player;
    return out;
  }, [selected, rivalHomes]);
  const outlines = useMemo<MapOutline[]>(() => (selected ? [{ regionId: selected, color: colors.text, width: 1.4 }] : []), [selected]);
  const dots = useMemo<MapDot[]>(
    () =>
      rivalHomes.flatMap((home) => {
        const g = geometry.regions[home.regionId];
        return g ? [{ key: home.regionId, x: g.centroid[0], y: g.centroid[1], r: 2.6, color: home.color }] : [];
      }),
    [rivalHomes, geometry],
  );

  const [, , vw, vh] = geometry.viewBox;
  return (
    <View style={[styles.root, fill ? styles.rootFill : { aspectRatio: geometry.width / geometry.height }]}>
      <GestureDetector gesture={gesture}>
        <View ref={container} style={styles.container} onLayout={onLayout} collapsable={false} testID="picker-map">
          {size.w > 0 ? (
            <Animated.View style={[styles.fill, animatedStyle]}>
              <Svg width={size.w} height={size.h} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
                <MapShapes geometry={geometry} fills={fills} outlines={outlines} dots={dots} />
              </Svg>
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>
      <View style={styles.controls} pointerEvents="box-none">
        <Button label="+" compact onPress={() => zoomBy(BUTTON_ZOOM)} accessibilityLabel={t('ui.map.zoomIn')} style={styles.ctrl} />
        <Button label="−" compact onPress={() => zoomBy(1 / BUTTON_ZOOM)} accessibilityLabel={t('ui.map.zoomOut')} style={styles.ctrl} />
        <Button label="⟲" compact onPress={resetView} accessibilityLabel={t('ui.map.reset')} style={styles.ctrl} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', backgroundColor: colors.bg, borderRadius: radius.l, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  rootFill: { flex: 1 },
  container: { flex: 1, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  controls: { position: 'absolute', right: spacing.xs, top: spacing.xs, bottom: spacing.xs, justifyContent: 'space-between' },
  ctrl: { width: 44, height: 44, paddingHorizontal: 0, opacity: 0.9 },
});
