import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { Circle, G, Path } from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';
import { getReachableRegions } from '@/engine';

import { freshNews } from '../../hooks/useRegionFlashes';
import { useKeyedSelector } from '../../hooks/useKeyedSelector';
import { readableLabColor } from '../../i18n';
import { Icon } from '../../icons';
import { useAmbientClock, wave } from '../../motion/ambient';
import { useGameStore, type GameStore } from '../../store/game';
import { colors } from '../../theme';
import { allFinite, isDrawablePath, nonNegative, unitInterval } from '../svgSafe';
import { mapLiveConfig } from './config';
import { project, useProjection, type MapProjection } from './projection';
import { FAINT_MS, FLIGHT_MS, arcControl, arcLength, bezier, routeFor, useRoutesStore, type Route } from './routes';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

interface Arc {
  route: Route;
  a: [number, number];
  b: [number, number];
  c: [number, number];
  d: string;
  len: number;
  color: string;
}

function arcOf(route: Route, geometry: MapGeometry): Arc | null {
  const ga = geometry.regions[route.from];
  const gb = geometry.regions[route.to];
  if (!ga || !gb) return null;
  const a = ga.centroid;
  const b = gb.centroid;
  const c = arcControl(a, b, route.style);
  if (!allFinite(a[0], a[1], b[0], b[1], c[0], c[1])) return null;
  const d = `M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`;
  const lab = useGameStore.getState().state?.labs[route.labId];
  return { route, a, b, c, d, len: arcLength(a[0], a[1], c[0], c[1], b[0], b[1]), color: lab ? readableLabColor(lab) : colors.dim };
}

/** Watches the news for entries through a channel and keeps the route store (mounted once, by the arcs). */
function useRouteWatcher() {
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (!s.state || s.state === prev.state) return;
      if (prev.state && prev.state.seed !== s.state.seed) useRoutesStore.getState().clear();
      for (const item of freshNews(prev.state, s.state)) {
        const route = routeFor(item, s.state, s.pack, mapLiveConfig(s.pack.id));
        if (!route) continue;
        const id = useRoutesStore.getState().add(route);
        const landed = setTimeout(() => {
          timers.delete(landed);
          useRoutesStore.getState().land(id);
        }, FLIGHT_MS + 300);
        const timer = setTimeout(() => {
          timers.delete(timer);
          useRoutesStore.getState().remove(id);
        }, FLIGHT_MS + FAINT_MS);
        timers.add(landed);
        timers.add(timer);
      }
    });
    return () => {
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
      useRoutesStore.getState().clear();
    };
  }, []);
}

/**
 * Inside the map's own canvas (map units): route arcs drawn as the icon travels, then held
 * faint; word-of-mouth jumps dotted, long crossings higher and solid with a wake.
 */
export const RouteArcs = memo(function RouteArcs({ geometry }: { geometry: MapGeometry }) {
  useRouteWatcher();
  const routes = useRoutesStore((s) => s.routes);
  const arcs = useMemo(() => routes.map((r) => arcOf(r, geometry)).filter((a): a is Arc => !!a), [routes, geometry]);
  if (arcs.length === 0) return null;
  return (
    <G pointerEvents="none">
      {arcs.map((arc) => (
        <ArcPath key={arc.route.id} arc={arc} />
      ))}
    </G>
  );
});

const ArcPath = memo(function ArcPath({ arc }: { arc: Arc }) {
  const reduced = useReducedMotion();
  const drawn = useSharedValue(reduced ? 1 : 0);
  const strength = useSharedValue(1);
  useEffect(() => {
    if (!reduced) drawn.set(withTiming(1, { duration: FLIGHT_MS, easing: Easing.inOut(Easing.quad) }));
    strength.set(withSequence(withTiming(1, { duration: FLIGHT_MS + 1800 }), withTiming(0.28, { duration: 900 })));
    return () => {
      cancelAnimation(drawn);
      cancelAnimation(strength);
    };
  }, [drawn, strength, reduced]);
  const viral = arc.route.style === 'viral';
  const len = Math.max(1, arc.len);
  const width = arc.route.mine ? 1.6 : 1.1;
  const props = useAnimatedProps(() => ({
    strokeDashoffset: viral ? 0 : len * (1 - unitInterval(drawn.get())),
    strokeOpacity: unitInterval(strength.get() * (viral ? Math.min(1, drawn.get() * 1.5) : 1)),
  }));
  const wake = useAnimatedProps(() => ({ strokeOpacity: unitInterval((strength.get() - 0.28) * 0.5), strokeDashoffset: len * (1 - unitInterval(drawn.get())) }));
  const end = useAnimatedProps(() => {
    const k = unitInterval(drawn.get());
    const on = k > 0.98 ? 1 : 0;
    return { r: nonNegative(on * (2.2 + 3 * unitInterval(strength.get() - 0.28))), fillOpacity: unitInterval(on * Math.max(0.5, strength.get())) };
  });
  if (!isDrawablePath(arc.d)) return null;
  return (
    <G>
      {arc.route.style === 'crossing' ? (
        <AnimatedPath d={arc.d} fill="none" stroke={arc.color} strokeWidth={width * 3.2} strokeLinecap="round" strokeDasharray={`${len} ${len}`} animatedProps={wake} />
      ) : null}
      <AnimatedPath
        d={arc.d}
        fill="none"
        stroke={arc.color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={viral ? '0.1 4' : `${len} ${len}`}
        animatedProps={props}
      />
      <AnimatedCircle cx={arc.b[0]} cy={arc.b[1]} fill={arc.color} animatedProps={end} />
      <Circle cx={arc.a[0]} cy={arc.a[1]} r={1.4} fill={arc.color} fillOpacity={0.8} />
    </G>
  );
});

const RUNNER = 26;

/** Screen space: each new route's channel icon travels its arc once, at a constant size. */
export const RouteRunners = memo(function RouteRunners({ geometry }: { geometry: MapGeometry }) {
  const p = useProjection();
  const routes = useRoutesStore((s) => s.routes);
  const flying = routes.filter((r) => r.flying);
  if (!p || flying.length === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flying.map((r) => {
        const arc = arcOf(r, geometry);
        return arc ? <Runner key={r.id} p={p} arc={arc} /> : null;
      })}
    </View>
  );
});

function Runner({ p, arc }: { p: MapProjection; arc: Arc }) {
  const reduced = useReducedMotion();
  const k = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) k.set(withTiming(1, { duration: FLIGHT_MS, easing: Easing.inOut(Easing.quad) }));
    return () => cancelAnimation(k);
  }, [k, reduced]);
  const { scale, tx, ty, frame } = p;
  const [x0, y0] = arc.a;
  const [cx, cy] = arc.c;
  const [x1, y1] = arc.b;
  const style = useAnimatedStyle(() => {
    const t = k.get();
    const [mx, my] = bezier(t, x0, y0, cx, cy, x1, y1);
    const [sx, sy] = project(frame.get(), scale.get(), tx.get(), ty.get(), mx, my);
    const o = t > 0.92 ? 1 - (t - 0.92) / 0.08 : Math.min(1, t * 8);
    return { opacity: unitInterval(o), transform: [{ translateX: sx - RUNNER / 2 }, { translateY: sy - RUNNER / 2 }, { scale: 1 + 0.25 * Math.sin(t * Math.PI) }] };
  });
  const viral = arc.route.style === 'viral';
  return (
    <Animated.View style={[styles.runner, { backgroundColor: arc.color, borderRadius: viral ? RUNNER / 2 : 4 }, style]} testID={`route-runner-${arc.route.style}`}>
      <Icon name={arc.route.icon} size={RUNNER - 8} color={colors.newsInk} accent={colors.newsInk} strokeWidth={2.2} />
    </Animated.View>
  );
}

/** Inside the map canvas: a ring pulse radiating from a lab's home region when it ships a new model. */
export const LaunchPulses = memo(function LaunchPulses({ geometry }: { geometry: MapGeometry }) {
  const reduced = useReducedMotion();
  const [pulses, setPulses] = useState<{ id: number; x: number; y: number; color: string; mine: boolean }[]>([]);
  useEffect(() => {
    if (reduced) return;
    let next = 1;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (!s.state || s.state === prev.state) return;
      const state = s.state;
      for (const item of freshNews(prev.state, state)) {
        if (item.kind !== 'launch' || !item.labId) continue;
        const lab = state.labs[item.labId];
        const g = geometry.regions[item.regionId ?? lab?.homeRegion ?? ''];
        if (!lab || !g || !allFinite(g.centroid[0], g.centroid[1])) continue;
        const pulse = { id: next++, x: g.centroid[0], y: g.centroid[1], color: readableLabColor(lab), mine: item.labId === state.playerLabId };
        setPulses((c) => [...c, pulse].slice(-4));
        const timer = setTimeout(() => {
          timers.delete(timer);
          setPulses((c) => c.filter((x) => x.id !== pulse.id));
        }, PULSE_MS + 2 * PULSE_GAP);
        timers.add(timer);
      }
    });
    return () => {
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [geometry, reduced]);
  if (pulses.length === 0) return null;
  return (
    <G pointerEvents="none">
      {pulses.map((p) => (
        <G key={p.id}>
          {[0, 1, 2].map((i) => (
            <PulseRing key={i} x={p.x} y={p.y} color={p.color} delayMs={i * PULSE_GAP} radius={p.mine ? 70 : 55} />
          ))}
        </G>
      ))}
    </G>
  );
});

const PULSE_MS = 1700;
const PULSE_GAP = 380;

function PulseRing({ x, y, color, delayMs, radius }: { x: number; y: number; color: string; delayMs: number; radius: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    // A delay without withDelay: hold at 0 for delayMs, then grow.
    v.set(withSequence(withTiming(0, { duration: delayMs }), withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.cubic) })));
    return () => cancelAnimation(v);
  }, [v, delayMs]);
  const props = useAnimatedProps(() => {
    const k = unitInterval(v.get());
    return { r: nonNegative(3 + k * radius), strokeOpacity: k > 0 ? 0.95 * (1 - k) : 0, strokeWidth: 3 * (1 - k) + 0.4 };
  });
  return <AnimatedCircle cx={x} cy={y} fill="none" stroke={color} animatedProps={props} />;
}

const selectReach = (s: GameStore) => {
  const state = s.state;
  if (!state || state.status !== 'running') return '';
  return getReachableRegions(state, s.pack, state.playerLabId)
    .filter((r) => r.reachable && !r.present && !r.banned)
    .map((r) => r.regionId)
    .join('|');
};
const ident = (k: string) => k;

/** Inside the map canvas: a faint pulsing dashed ring on regions the player's users are about to spread into. */
export const ReachHints = memo(function ReachHints({ geometry }: { geometry: MapGeometry }) {
  const key = useKeyedSelector(selectReach, ident);
  const ids = key ? key.split('|') : [];
  const clock = useAmbientClock(ids.length > 0);
  const props = useAnimatedProps(() => ({ opacity: unitInterval(0.35 + 0.4 * (clock ? wave(clock.get(), 2.4) : 0.5)) }));
  if (ids.length === 0) return null;
  return (
    <AnimatedG animatedProps={props} pointerEvents="none">
      {ids.map((id) => {
        const g = geometry.regions[id];
        if (!g || !allFinite(g.centroid[0], g.centroid[1])) return null;
        return <Circle key={id} cx={g.centroid[0]} cy={g.centroid[1]} r={6} fill="none" stroke={colors.player} strokeWidth={0.9} strokeDasharray="1.6 1.6" testID={`reach-hint-${id}`} />;
      })}
    </AnimatedG>
  );
});

const styles = StyleSheet.create({
  runner: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: RUNNER,
    height: RUNNER,
    borderWidth: 1.5,
    borderColor: colors.newsPaper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
