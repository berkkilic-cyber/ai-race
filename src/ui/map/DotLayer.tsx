import { memo, useEffect, useMemo } from 'react';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { G, Path } from 'react-native-svg';
import { useShallow } from 'zustand/react/shallow';

import type { GameState } from '@/engine';

import { useRegionFlashes, type FlashTone } from '../hooks/useRegionFlashes';
import { readableLabColor } from '../i18n';
import { useGameStore } from '../store/game';
import { colors } from '../theme';
import { drawableDots, type DotMapGeometry } from './dotGeometry';
import { regionDotColors } from './mapColors';
import { countRender } from './renderStats';

const AnimatedG = Animated.createAnimatedComponent(G);

/** Dot diameter in grid steps, and the larger size of a selected region's dots. */
export const DOT_SIZE = 0.6;
export const DOT_SIZE_SELECTED = 0.82;

interface BucketProps {
  d: string;
  color: string;
  size: number;
}

/** One bucket of a region's dots: a single path. Memoised: re-renders only when its colour or size changes. */
const Bucket = memo(function Bucket({ d, color, size }: BucketProps) {
  countRender('dotBucket');
  return <Path d={d} fill="none" stroke={color} strokeWidth={size} strokeLinecap="round" />;
});

interface RegionDotsProps {
  buckets: readonly string[];
  /** Bucket colours, comma-joined (a string so memo compares by value). */
  colorKey: string;
  selected: boolean;
  flash: FlashTone | undefined;
}

/** A region's buckets. A news flash blinks its dots (a steady dim with reduced motion). */
const RegionDots = memo(function RegionDots({ buckets, colorKey, selected, flash }: RegionDotsProps) {
  countRender('dotRegion');
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!flash) {
      opacity.set(withTiming(1, { duration: 120 }));
      return;
    }
    if (reduced) {
      opacity.set(0.45);
      return;
    }
    const on = withTiming(1, { duration: 130 });
    const off = withTiming(0.2, { duration: 130 });
    opacity.set(withSequence(off, on, off, on, off, on));
  }, [flash, reduced, opacity]);
  const animatedProps = useAnimatedProps(() => ({ opacity: opacity.get() }));
  const list = colorKey.split(',');
  const size = selected ? DOT_SIZE_SELECTED : DOT_SIZE;
  return (
    <AnimatedG animatedProps={animatedProps}>
      {buckets.map((d, i) => (
        <Bucket key={i} d={d} color={list[i] ?? colors.dotRest} size={size} />
      ))}
    </AnimatedG>
  );
});

export interface DotLayerProps {
  geometry: DotMapGeometry;
  regionIds: readonly string[];
  selected: string | null;
}

function colorOf(state: GameState) {
  return (id: string) => readableLabColor(state.labs[id]);
}

/**
 * The world as a dot matrix. Each region's dots are pre-split into a few buckets (one
 * path each); each lab lights its share of buckets from the marker point outward.
 * The layer subscribes to a shallow-compared map of colour strings, so a tick only
 * re-renders regions whose colours changed, and inside them only the changed buckets.
 */
export const DotLayer = memo(function DotLayer({ geometry, regionIds, selected }: DotLayerProps) {
  const { pitch, buckets } = geometry.dots;
  const rest = useMemo(() => {
    const key = Array.from({ length: buckets }, () => colors.dotRest).join(',');
    return Object.fromEntries(regionIds.map((id) => [id, key]));
  }, [regionIds, buckets]);
  const colorKeys = useGameStore(useShallow((s) => (s.state ? regionDotColors(s.state, regionIds, buckets, colorOf(s.state)) : rest)));
  const flashes = useRegionFlashes();
  const paths = useMemo(() => Object.fromEntries(regionIds.map((id) => [id, geometry.regions[id].dots.map(drawableDots)])), [geometry, regionIds]);
  return (
    <G pointerEvents="none" transform={`translate(${pitch / 2} ${pitch / 2}) scale(${pitch})`}>
      {regionIds.map((id) => (
        <RegionDots key={id} buckets={paths[id]} colorKey={colorKeys[id] ?? rest[id]} selected={id === selected} flash={flashes[id]} />
      ))}
    </G>
  );
});
