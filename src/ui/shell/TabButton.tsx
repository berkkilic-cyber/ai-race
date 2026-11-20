import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, touch, type } from '../theme';

export type TabButtonProps = TabTriggerSlotProps & { label: string; /** Optional badge drawn at the label's top-right corner. */ badge?: ReactNode };

/** One tab of the custom tab bar; receives isFocused and onPress from TabTrigger. */
export function TabButton({ label, badge, isFocused, ref: _ref, ...props }: TabButtonProps) {
  return (
    <Pressable {...props} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }}>
      <View>
        <Text style={[styles.label, isFocused && styles.focused]}>{label}</Text>
        {badge ? <View style={styles.badge}>{badge}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, minHeight: touch, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.s },
  label: { color: colors.dim, fontSize: type.m, fontWeight: '600' },
  focused: { color: colors.player, fontWeight: '800' },
  badge: { position: 'absolute', top: -8, left: '100%', marginLeft: 2 },
});
