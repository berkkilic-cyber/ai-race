import { memo, useEffect, useMemo } from 'react';
import Animated, { Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Circle, G } from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { labColor } from '../i18n';
import { useGameStore } from '../store/game';
import { colors } from '../theme';
import { parseSites, sitesKey, type SiteMarker } from './mapColors';

const AnimatedG = Animated.createAnimatedComponent(G);

/** Offset of the n-th site in a region from the centroid, in map units (a small spiral). */
function offset(n: number): [number, number] {
  if (n === 0) return [0, 0];
  const angle = n * 2.4;
  const r = 4 + n * 1.5;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

interface Placed extends SiteMarker {
  x: number;
  y: number;
  r: number;
}

/** Data centre dots near region centroids; online ones glow with one shared pulse. */
export const SitesLayer = memo(function SitesLayer({ geometry }: { geometry: MapGeometry }) {
  const key = useGameStore((s) => (s.state ? sitesKey(s.state) : ''));
  const playerId = useGameStore((s) => s.state?.playerLabId ?? '');

  const placed = useMemo<Placed[]>(() => {
    // Colours depend only on lab ids, so read labs once instead of subscribing to every tick.
    const labs = useGameStore.getState().state?.labs;
    const colorOf = (id: string) => (labs?.[id] ? labColor(labs[id]) : colors.dim);
    const perRegion = new Map<string, number>();
    const out: Placed[] = [];
    for (const site of parseSites(key, playerId, colorOf)) {
      const region = geometry.regions[site.regionId];
      if (!region) continue;
      const n = perRegion.get(site.regionId) ?? 0;
      perRegion.set(site.regionId, n + 1);
      const [dx, dy] = offset(n);
      out.push({ ...site, x: region.centroid[0] + dx, y: region.centroid[1] + dy, r: (site.mine ? 2.6 : 2) + site.level * 0.25 });
    }
    return out;
  }, [key, playerId, geometry]);

  const pulse = useSharedValue(0.25);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(0.75, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [pulse]);
  const glowProps = useAnimatedProps(() => ({ opacity: pulse.get() }));

  if (placed.length === 0) return null;
  return (
    <G pointerEvents="none">
      <AnimatedG animatedProps={glowProps}>
        {placed
          .filter((p) => p.online)
          .map((p) => (
            <Circle key={`g-${p.key}`} cx={p.x} cy={p.y} r={p.r * 2.2} fill={p.color} />
          ))}
      </AnimatedG>
      {placed.map((p) => (
        <Circle key={p.key} cx={p.x} cy={p.y} r={p.r} fill={p.online ? p.color : colors.offline} stroke={colors.bg} strokeWidth={0.6} />
      ))}
    </G>
  );
});
