import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, spacing, voice } from '../theme';

export interface StripMeterProps {
  label: string;
  /** 0..100. */
  value: number;
  color: string;
  /** The bar pulses above this value. Default 75. */
  pulseAbove?: number;
  /** Tabloid tag that replaces the label (composure level 2+ on the driving meter). */
  tag?: string | null;
  testID?: string;
}

/**
 * Compact meter for the wide top strip, in the calm voice: a small caps label over a
 * hairline track with the value in serif figures beside it. When the meter drives the
 * composure level the label turns into a tabloid tag ("REGULATORS CIRCLING").
 */
export function StripMeter({ label, value, color, pulseAbove = 75, tag, testID }: StripMeterProps) {
  const pct = Math.max(0, Math.min(100, value));
  const pulsing = pct > pulseAbove;
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (pulsing && !reduced) {
      opacity.set(withRepeat(withTiming(0.35, { duration: 450, easing: Easing.inOut(Easing.quad) }), -1, true));
    } else {
      cancelAnimation(opacity);
      opacity.set(1);
    }
  }, [pulsing, reduced, opacity]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View
      style={[styles.wrap, tag ? styles.wrapTagged : null]}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={tag ? `${label}. ${tag}` : label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      {tag ? (
        <Animated.View entering={FadeIn.duration(260)} style={styles.tag}>
          <Text style={styles.tagText} numberOfLines={1}>
            {tag}
          </Text>
        </Animated.View>
      ) : (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      )}
      <View style={styles.row}>
        <View style={[styles.track, tag ? styles.trackTagged : null]}>
          <Animated.View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }, fillStyle]} />
        </View>
        <Text style={[styles.value, pulsing && { color: colors.bad }]}>{Math.floor(pct)}</Text>
      </View>
    </View>
  );
}

/** Wide enough for "100" so the bar does not jump as the number changes. */
const VALUE_WIDTH = 22;

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 3 },
  // The tagged meter takes the tag's natural width; the others share what is left.
  wrapTagged: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  label: { ...voice.calmLabel, color: colors.dim, fontSize: 9.5, lineHeight: 11, letterSpacing: 0.3 },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.newsInk, paddingHorizontal: 4, height: 13, justifyContent: 'center', transform: [{ rotate: '-1.5deg' }] },
  tagText: { ...voice.loudKicker, fontSize: 10.5, lineHeight: 12, letterSpacing: 0.8, color: colors.newsPaper },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track: { flex: 1, height: 3, backgroundColor: colors.raised, overflow: 'hidden' },
  trackTagged: { minWidth: 56 },
  fill: { height: '100%' },
  value: { ...voice.calmNumber, width: VALUE_WIDTH, textAlign: 'right', color: colors.text, fontSize: 13, lineHeight: 15 },
});
