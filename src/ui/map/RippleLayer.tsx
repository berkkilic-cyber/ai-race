import { memo, useEffect, useState } from 'react';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Circle, G } from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { readableLabColor } from '../i18n';
import { useGameStore } from '../store/game';
import { newPresences } from './mapColors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RIPPLE_MS = 1300;
const RIPPLE_RADIUS = 22;
/** At most this many rings at once (a busy tick may seed several regions). */
const MAX_RIPPLES = 8;

interface Ripple {
  id: number;
  x: number;
  y: number;
  color: string;
}

const Ring = memo(function Ring({ x, y, color }: Omit<Ripple, 'id'>) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.cubic) }));
  }, [p]);
  const outer = useAnimatedProps(() => ({ r: 2 + p.get() * RIPPLE_RADIUS, strokeOpacity: 0.9 * (1 - p.get()), strokeWidth: 1.6 * (1 - p.get()) + 0.3 }));
  const inner = useAnimatedProps(() => ({ r: 1 + p.get() * RIPPLE_RADIUS * 0.55, strokeOpacity: 0.7 * (1 - p.get()) }));
  return (
    <G>
      <AnimatedCircle cx={x} cy={y} fill="none" stroke={color} animatedProps={outer} />
      <AnimatedCircle cx={x} cy={y} fill="none" stroke={color} strokeWidth={0.8} animatedProps={inner} />
    </G>
  );
});

/** A ring ripples out from a region's marker point when a lab launches there (none with reduced motion). */
export const RippleLayer = memo(function RippleLayer({ geometry }: { geometry: MapGeometry }) {
  const reduced = useReducedMotion();
  const [ripples, setRipples] = useState<Ripple[]>([]);
  useEffect(() => {
    if (reduced) return;
    let next = 1;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      const fresh = newPresences(prev.state, s.state);
      if (fresh.length === 0 || !s.state) return;
      const state = s.state;
      const added: Ripple[] = [];
      for (const { labId, regionId } of fresh) {
        const region = geometry.regions[regionId];
        if (region) added.push({ id: next++, x: region.centroid[0], y: region.centroid[1], color: readableLabColor(state.labs[labId]) });
      }
      if (added.length === 0) return;
      setRipples((current) => [...current, ...added].slice(-MAX_RIPPLES));
      const ids = new Set(added.map((r) => r.id));
      const timer = setTimeout(() => {
        timers.delete(timer);
        setRipples((current) => current.filter((r) => !ids.has(r.id)));
      }, RIPPLE_MS);
      timers.add(timer);
    });
    return () => {
      unsubscribe();
      for (const timer of timers) clearTimeout(timer);
    };
  }, [geometry, reduced]);
  if (ripples.length === 0) return null;
  return (
    <G pointerEvents="none">
      {ripples.map((r) => (
        <Ring key={r.id} x={r.x} y={r.y} color={r.color} />
      ))}
    </G>
  );
});
