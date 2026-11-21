import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { Button } from '../components/Button';
import { logLifecycle } from '../diagnostics/log';
import { t } from '../i18n';
import { createHitTester } from '../map/hitTest';
import { MapDebugOverlay } from '../map/MapDebugOverlay';
import { mixColor } from '../map/mapColors';
import { recordTouch } from '../map/touchDebug';
import type { MapView } from '../map/touchController';
import { WEB_TOUCH, useMapTouch } from '../map/useMapTouch';
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
 * double tap to reset. No game state is read. Touches as on the game map (useMapTouch).
 */
export function RegionPickerMap({ geometry, selected, onSelect, rivalHomes, focus, fill }: RegionPickerMapProps) {
  const hitTester = useMemo(() => createHitTester(geometry, SMALL_REGION_AREA, HIT_RADIUS), [geometry]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const layout = useRef<Layout>({ cw: 1, ch: 1, mw: geometry.width, mh: geometry.height });
  const view = useRef<MapView>({ s: 1, tx: 0, ty: 0 });
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const animatingUntil = useRef(0);

  const applyView = useCallback(
    (v: MapView, animateMs = 0) => {
      view.current = v;
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

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      // Ignore the zero-sized first layout and repeats of the same size: the view maths needs a real size.
      if (!(width > 0 && height > 0) || (Math.round(width) === Math.round(layout.current.cw) && Math.round(height) === Math.round(layout.current.ch))) return;
      setSize({ w: width, h: height });
      const l: Layout = { cw: width, ch: height, mw: geometry.width, mh: geometry.height };
      layout.current = l;
      const v = view.current;
      const [x, y] = clampTranslate(l, v.s, v.tx, v.ty);
      applyView({ s: v.s, tx: x, ty: y });
    },
    [geometry, applyView],
  );

  const resetView = useCallback(() => applyView({ s: 1, tx: 0, ty: 0 }, 300), [applyView]);

  const zoomBy = useCallback(
    (factor: number, fx?: number, fy?: number) => {
      const l = layout.current;
      const v = view.current;
      const s1 = clampScale(v.s * factor);
      const [zx, zy] = zoomAbout(l, v.s, s1, v.tx, v.ty, fx ?? l.cw / 2, fy ?? l.ch / 2);
      const [x, y] = clampTranslate(l, s1, zx, zy);
      applyView({ s: s1, tx: x, ty: y });
    },
    [applyView],
  );

  // Centre on a region chosen elsewhere; zoom in when it is small.
  useEffect(() => {
    if (!focus || size.w === 0) return;
    const g = geometry.regions[focus.regionId];
    // Large regions are easy to see on the whole map: leave the view alone.
    if (!g || g.area >= FOCUS_MAX_AREA) return;
    const l = layout.current;
    const { k } = fit(l);
    const [x0, y0, x1, y1] = g.bbox;
    const fitScale = Math.min(l.cw / ((x1 - x0) * k * 1.6), l.ch / ((y1 - y0) * k * 1.6));
    const s = clampScale(Math.max(view.current.s, Math.min(FOCUS_SCALE, fitScale)));
    const [x, y] = centreOn(l, s, (x0 + x1) / 2, (y0 + y1) / 2);
    applyView({ s, tx: x, ty: y }, 300);
    // Only a new nonce should move the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, size.w]);

  // A tap in touch-view points, converted with the view of this moment and hit-tested.
  const select = useCallback(
    (px: number, py: number) => {
      const v = view.current;
      const [x, y] = toMapPoint(layout.current, v.s, v.tx, v.ty, px, py);
      const id = hitTester.at(x, y);
      recordTouch({ region: id ?? 'none' });
      logLifecycle('region tapped', { region: id ?? 'none', where: 'start', x: Math.round(px), y: Math.round(py) });
      if (id) onSelect(id);
    },
    [hitTester, onSelect],
  );

  // The same touch controller as the game map (src/ui/map/useMapTouch.ts): core responder
  // touches on a plain view above the drawing; pan, pinch, tap and double tap in JS.
  const mapTouch = useMapTouch('picker', {
    layout: () => layout.current,
    view: () => view.current,
    setView: (v) => applyView(v),
    begin: () => {
      if (Date.now() > animatingUntil.current) return;
      animatingUntil.current = 0;
      cancelAnimation(scale);
      cancelAnimation(tx);
      cancelAnimation(ty);
      view.current = { s: scale.get(), tx: tx.get(), ty: ty.get() };
    },
    tap: select,
    doubleTap: resetView,
  });
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
      <View ref={container} style={styles.container} onLayout={onLayout} collapsable={false} pointerEvents="box-none" testID="picker-map">
        {size.w > 0 ? (
          <Animated.View style={[styles.fill, animatedStyle]} pointerEvents="none">
            <Svg width={size.w} height={size.h} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet" pointerEvents="none">
              <MapShapes geometry={geometry} fills={fills} outlines={outlines} dots={dots} />
            </Svg>
          </Animated.View>
        ) : null}
        <View style={[styles.fill, WEB_TOUCH]} collapsable={false} testID="picker-touch" {...mapTouch.props} />
        <MapDebugOverlay />
      </View>
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
