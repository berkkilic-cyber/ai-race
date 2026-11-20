import type { TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing, touch, type } from '../theme';

export type TabButtonProps = TabTriggerSlotProps & { label: string };

/** One tab of the custom tab bar; receives isFocused and onPress from TabTrigger. */
export function TabButton({ label, isFocused, ref: _ref, ...props }: TabButtonProps) {
  return (
    <Pressable {...props} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }}>
      <Text style={[styles.label, isFocused && styles.focused]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, minHeight: touch, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.s },
  label: { color: colors.dim, fontSize: type.m, fontWeight: '600' },
  focused: { color: colors.player, fontWeight: '800' },
});
