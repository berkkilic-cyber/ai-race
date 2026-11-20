import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayoutMode } from '../hooks/useLayoutMode';
import { colors, spacing, touch, type, voice } from '../theme';

export type TabButtonProps = TabTriggerSlotProps & { label: string; /** Optional badge drawn at the label's top-right corner. */ badge?: ReactNode };

/**
 * One tab of the custom tab bar; receives isFocused and onPress from TabTrigger.
 * Calm voice: serif label, the active tab marked by ink and a short accent rule
 * (at the rail's edge in wide mode, under the label in narrow mode).
 */
export function TabButton({ label, badge, isFocused, ref: _ref, ...props }: TabButtonProps) {
  const wide = useLayoutMode() === 'wide';
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
    >
      {isFocused ? <View style={wide ? styles.markWide : styles.markNarrow} /> : null}
      <View>
        <Text style={[styles.label, isFocused && styles.focused]}>{label}</Text>
        {badge ? <View style={styles.badge}>{badge}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, minHeight: touch, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.s },
  pressed: { opacity: 0.6 },
  label: { ...voice.calmHeading, color: colors.dim, fontSize: type.s + 1 },
  focused: { color: colors.text },
  markWide: { position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, backgroundColor: colors.player },
  markNarrow: { position: 'absolute', bottom: 4, width: 18, height: 2, backgroundColor: colors.player },
  badge: { position: 'absolute', top: -8, left: '100%', marginLeft: 2 },
});
