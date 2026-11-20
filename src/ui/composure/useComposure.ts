import { useEffect } from 'react';
import { Easing, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

import { getMeters } from '@/engine';

import { useGameStore } from '../store/game';
import { motion } from '../theme';
import { useComposureOverride } from './debugOverride';
import { composureOf, type Composure } from './logic';

export type ComposureState = Pick<Composure, 'level' | 'driver'>;

const CALM: ComposureState = { level: 0, driver: 'regulation' };

/**
 * The run's composure: level 0..3 from the highest of the three meters, plus the
 * meter driving it. Re-renders only when the level or the driver changes.
 */
export function useComposure(): ComposureState {
  const forced = useComposureOverride((s) => s.level);
  return useGameStore(
    useShallow((s) => {
      if (!s.state) return forced === null ? CALM : { ...CALM, level: forced };
      const c = composureOf(getMeters(s.state, s.state.playerLabId), forced);
      // Leave the value out so the hook does not re-render on every tick.
      return { level: c.level, driver: c.driver };
    }),
  );
}

/**
 * The level as an animated value that eases to each new level over about 600 ms
 * (instantly with reduced motion), for colour and opacity interpolation.
 */
export function useComposureProgress(): SharedValue<number> {
  const { level } = useComposure();
  const reduced = useReducedMotion();
  const progress = useSharedValue<number>(level);
  useEffect(() => {
    progress.set(reduced ? level : withTiming(level, { duration: motion.composure, easing: Easing.out(Easing.cubic) }));
  }, [level, reduced, progress]);
  return progress;
}
