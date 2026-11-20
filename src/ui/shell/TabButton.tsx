import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayoutMode } from '../hooks/useLayoutMode';
import { colors, layout, spacing, touch, type, voice } from '../theme';
import { useTutorialTarget } from '../tutorial/targets';

export type TabButtonProps = TabTriggerSlotProps & {
  label: string;
  /** Optional badge drawn at the label's top-right corner. */ badge?: ReactNode;
  /** Tutorial target id for this tab. */
  targetId?: string;
};

/**
 * One tab of the custom tab bar; receives isFocused and onPress from TabTrigger.
 * Calm voice: serif label, the active tab marked by ink and a short accent rule
 * (at the rail's edge in wide mode, under the label in narrow mode).
 *
 * Native-safe sizing: in the rail every tab has an explicit height and stretches to the
 * rail's content width (never `flex: 1`, which in a column rail would share out whatever
 * height is left); the label is a single line with explicit colour and line height and a
 * width cap, so it can neither collapse to zero nor wrap glyph by glyph. On iOS the labels
 * used to vanish because the rail's content width was zero (the left inset was padded
 * twice inside a 56-point rail); explicit sizes keep that from hiding them silently.
 */
export function TabButton({ label, badge, isFocused, targetId, ref: _ref, ...props }: TabButtonProps) {
  const wide = useLayoutMode() === 'wide';
  const tutorialRef = useTutorialTarget(targetId ?? null);
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [wide ? styles.tabWide : styles.tab, pressed && styles.pressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none" ref={tutorialRef} />
      {isFocused ? <View style={wide ? styles.markWide : styles.markNarrow} /> : null}
      <View style={wide ? styles.labelBoxWide : null}>
        <Text style={[styles.label, isFocused && styles.focused]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {label}
        </Text>
        {badge ? <View style={styles.badge}>{badge}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, minHeight: touch, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.s },
  tabWide: { height: layout.railItemHeight, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  labelBoxWide: { maxWidth: layout.railWidth - 6, flexShrink: 0 },
  pressed: { opacity: 0.6 },
  label: { ...voice.calmHeading, color: colors.dim, fontSize: type.s + 1, lineHeight: type.s + 5, textAlign: 'center' },
  focused: { color: colors.text },
  markWide: { position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, backgroundColor: colors.player },
  markNarrow: { position: 'absolute', bottom: 4, width: 18, height: 2, backgroundColor: colors.player },
  badge: { position: 'absolute', top: -8, left: '100%', marginLeft: 2 },
});
