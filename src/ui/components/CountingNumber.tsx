import { memo, useEffect, useRef, useState } from 'react';
import { type StyleProp, type TextStyle } from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { colors, motion } from '../theme';

export interface CountingNumberProps {
  value: number;
  format: (value: number) => string;
  /**
   * A change larger than this pops (gain) or dips (loss); smaller changes, such as
   * ordinary income per tick, only count. Default 0: every change reacts.
   */
  notable?: number;
  style?: StyleProp<TextStyle>;
  /** Colour the number returns to after a pop or dip. */
  color?: string;
  numberOfLines?: number;
  testID?: string;
}

const COUNT_MS = 320;

/** Ease-out cubic. */
function ease(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * A number that counts to its new value. A notable gain pops slightly (and flashes good),
 * a notable loss dips (and flashes bad). Reduced motion: no count, no movement, colour only.
 */
export const CountingNumber = memo(function CountingNumber({ value, format, notable = 0, style, color = colors.text, numberOfLines = 1, testID }: CountingNumberProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  const prev = useRef(value);
  const scale = useSharedValue(1);
  const shift = useSharedValue(0);
  const flash = useSharedValue(0);

  useEffect(() => {
    const from = shownRef.current;
    const delta = value - prev.current;
    prev.current = value;
    if (delta === 0) return;

    if (Math.abs(delta) > notable) {
      const up = delta > 0;
      flash.set(withSequence(withTiming(up ? 1 : -1, { duration: 60 }), withTiming(0, { duration: motion.slow, easing: Easing.out(Easing.quad) })));
      if (!reduced) {
        if (up) scale.set(withSequence(withTiming(1.14, { duration: 90, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) })));
        else shift.set(withSequence(withTiming(2.5, { duration: 90, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) })));
      }
    }

    if (reduced) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / COUNT_MS);
      const v = t >= 1 ? value : from + (value - from) * ease(t);
      shownRef.current = v;
      setShown(v);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, notable, reduced, scale, shift, flash]);

  const animated = useAnimatedStyle(() => ({
    color: interpolateColor(flash.get(), [-1, 0, 1], [colors.bad, color, colors.goodText]),
    transform: [{ scale: scale.get() }, { translateY: shift.get() }],
  }));

  return (
    <Animated.Text style={[style, animated]} numberOfLines={numberOfLines} testID={testID}>
      {format(shown)}
    </Animated.Text>
  );
});
