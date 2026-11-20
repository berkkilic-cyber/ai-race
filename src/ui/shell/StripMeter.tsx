import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, radius, spacing, tabular, type } from '../theme';

export interface StripMeterProps {
  label: string;
  /** 0..100. */
  value: number;
  color: string;
  /** The bar pulses above this value. Default 75. */
  pulseAbove?: number;
  testID?: string;
}

/**
 * Compact meter for the wide top strip: the label on its own line, the bar with the
 * percentage beside it underneath, so the label never has to share a line with the number.
 */
export function StripMeter({ label, value, color, pulseAbove = 75, testID }: StripMeterProps) {
  const pct = Math.max(0, Math.min(100, value));
  const pulsing = pct > pulseAbove;
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (pulsing) {
      opacity.set(withRepeat(withTiming(0.35, { duration: 450, easing: Easing.inOut(Easing.quad) }), -1, true));
    } else {
      cancelAnimation(opacity);
      opacity.set(1);
    }
  }, [pulsing, opacity]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View
      style={styles.wrap}
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.row}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }, fillStyle]} />
        </View>
        <Text style={[styles.value, pulsing && { color }]}>{Math.floor(pct)}%</Text>
      </View>
    </View>
  );
}

/** Wide enough for "100%" so the bar does not jump as the number changes. */
const VALUE_WIDTH = 30;

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0, justifyContent: 'center' },
  label: { color: colors.dim, fontSize: type.xs - 1, lineHeight: type.xs + 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  value: { width: VALUE_WIDTH, textAlign: 'right', color: colors.text, fontSize: type.xs, lineHeight: type.s + 3, fontWeight: '700', ...tabular },
});
