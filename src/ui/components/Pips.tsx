import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '../theme';

export interface PipsProps {
  /** Filled pips, 0..max. */
  value: number;
  max?: number;
  color?: string;
  accessibilityLabel?: string;
}

export function Pips({ value, max = 5, color = colors.player, accessibilityLabel }: PipsProps) {
  return (
    <View style={styles.row} accessibilityLabel={accessibilityLabel ?? `${value} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={[styles.pip, { backgroundColor: i < value ? color : colors.raised }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  pip: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: colors.border },
});
