import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, radius, spacing, tabular, type } from '../theme';

export interface MeterProps {
  label: string;
  /** 0..100. */
  value: number;
  color?: string;
  /** The bar pulses above this value. Default 75. */
  pulseAbove?: number;
  testID?: string;
}

export function Meter({ label, value, color = colors.bad, pulseAbove = 75, testID }: MeterProps) {
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
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.value, pulsing && { color }]}>{Math.floor(pct)}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs, gap: spacing.xs },
  label: { color: colors.dim, fontSize: type.xs, flexShrink: 1 },
  value: { color: colors.text, fontSize: type.xs, fontWeight: '700', ...tabular },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
