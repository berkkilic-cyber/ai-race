import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { pctText } from '../format';
import { useAmbientClock, wave } from '../motion/ambient';

import { colors, radius, shape, spacing, tabular, type, voice } from '../theme';

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
  // Pulses on the shell's shared ambient clock (still when paused or with reduced motion).
  const clock = useAmbientClock(pulsing);
  const fillStyle = useAnimatedStyle(() => ({ opacity: clock ? 1 - 0.65 * wave(clock.get(), 0.9) : 1 }));

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
        <Text style={[styles.value, pulsing && { color }]}>{pctText(Math.floor(pct))}</Text>
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
  label: { ...voice.body, color: colors.dim, fontSize: type.xs, flexShrink: 1 },
  value: { ...voice.calmNumber, color: colors.text, fontSize: type.xs, ...tabular },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden', borderWidth: shape.panel === 'sticker' ? shape.hairline * 0.75 : 0, borderColor: colors.outline },
  fill: { height: '100%', borderRadius: radius.pill },
});
