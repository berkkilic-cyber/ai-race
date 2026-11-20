import { memo, useEffect, useMemo } from 'react';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { G, Line, Rect } from 'react-native-svg';

import type { MapGeometry } from '@/content/packs/ai-lab/geometry';

import { readableLabColor } from '../i18n';
import { useGameStore } from '../store/game';
import { colors } from '../theme';
import { parseSites, sitesKey, type SiteMarker } from './mapColors';

const AnimatedG = Animated.createAnimatedComponent(G);

/** Service lines go to at most this many neighbours, and never further than this (map units). */
const MAX_LINES = 3;
const MAX_LINE_LENGTH = 170;
const MIN_LINE_LENGTH = 0.5;

/** Offset of the n-th site in a region from the marker point, in map units (a small spiral). */
function offset(n: number): [number, number] {
  if (n === 0) return [0, 0];
  const angle = n * 2.4;
  const r = 4 + n * 1.5;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

interface Placed extends SiteMarker {
  x: number;
  y: number;
  /** Half the square's side. */
  h: number;
  lines: [number, number][];
}

/**
 * Data centres as small solid squares with a soft pulse. An online site also sends a thin
 * line of light to the two or three most populous neighbouring regions it serves (a
 * display choice: the pack's neighbour list, nearest-first by population). Offline sites are grey.
 */
export const SitesLayer = memo(function SitesLayer({ geometry }: { geometry: MapGeometry }) {
  const key = useGameStore((s) => (s.state ? sitesKey(s.state) : ''));
  const playerId = useGameStore((s) => s.state?.playerLabId ?? '');
  const pack = useGameStore((s) => s.pack);
  const reduced = useReducedMotion();

  const served = useMemo(() => {
    const byId = new Map(pack.regions.map((r) => [r.id, r]));
    const out = new Map<string, [number, number][]>();
    for (const region of pack.regions) {
      const from = geometry.regions[region.id]?.centroid;
      if (!from) continue;
      const targets = region.neighbors
        .map((id) => ({ id, pop: byId.get(id)?.population ?? 0, at: geometry.regions[id]?.centroid }))
        .filter((n): n is { id: string; pop: number; at: [number, number] } => {
          if (!n.at) return false;
          const d = Math.hypot(n.at[0] - from[0], n.at[1] - from[1]);
          // No zero-length lines: with a round cap native draws them as stray dots.
          return d > MIN_LINE_LENGTH && d <= MAX_LINE_LENGTH;
        })
        .sort((a, b) => b.pop - a.pop)
        .slice(0, MAX_LINES)
        .map((n) => n.at);
      out.set(region.id, targets);
    }
    return out;
  }, [pack, geometry]);

  const placed = useMemo<Placed[]>(() => {
    // Colours depend only on lab ids, so read labs once instead of subscribing to every tick.
    const labs = useGameStore.getState().state?.labs;
    const colorOf = (id: string) => (labs?.[id] ? readableLabColor(labs[id]) : colors.dim);
    const perRegion = new Map<string, number>();
    const out: Placed[] = [];
    for (const site of parseSites(key, playerId, colorOf)) {
      const region = geometry.regions[site.regionId];
      if (!region) continue;
      const n = perRegion.get(site.regionId) ?? 0;
      perRegion.set(site.regionId, n + 1);
      const [dx, dy] = offset(n);
      out.push({
        ...site,
        x: region.centroid[0] + dx,
        y: region.centroid[1] + dy,
        h: (site.mine ? 2.3 : 1.8) + site.level * 0.2,
        lines: site.online && n === 0 ? (served.get(site.regionId) ?? []) : [],
      });
    }
    return out;
  }, [key, playerId, geometry, served]);

  const pulse = useSharedValue(0.5);
  useEffect(() => {
    if (reduced) {
      pulse.set(0.5);
      return;
    }
    pulse.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [pulse, reduced]);
  const glowProps = useAnimatedProps(() => ({ opacity: 0.12 + pulse.get() * 0.28 }));
  const lineProps = useAnimatedProps(() => ({ opacity: 0.3 + pulse.get() * 0.45 }));

  if (placed.length === 0) return null;
  return (
    <G pointerEvents="none">
      <AnimatedG animatedProps={lineProps}>
        {placed.flatMap((p) =>
          p.lines.map(([x, y], i) => <Line key={`l-${p.key}-${i}`} x1={p.x} y1={p.y} x2={x} y2={y} stroke={p.color} strokeWidth={p.mine ? 0.7 : 0.5} strokeLinecap="round" />),
        )}
      </AnimatedG>
      <AnimatedG animatedProps={glowProps}>
        {placed
          .filter((p) => p.online)
          .map((p) => (
            <Rect key={`g-${p.key}`} x={p.x - p.h * 2.4} y={p.y - p.h * 2.4} width={p.h * 4.8} height={p.h * 4.8} rx={p.h * 1.2} fill={p.color} />
          ))}
      </AnimatedG>
      {placed.map((p) => (
        <Rect key={p.key} x={p.x - p.h} y={p.y - p.h} width={p.h * 2} height={p.h * 2} fill={p.online ? p.color : colors.offline} stroke={colors.bg} strokeWidth={0.7} />
      ))}
    </G>
  );
});
