import type { TabTriggerSlotProps } from 'expo-router/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLayoutMode } from '../hooks/useLayoutMode';
import { Icon, type IconName } from '../icons';
import { PanelDeco } from '../components/Deco';
import { colors, flatShadow, glow, layout, radius, shape, spacing, touch, type, voice } from '../theme';
import { useTutorialTarget } from '../tutorial/targets';

export type TabButtonProps = TabTriggerSlotProps & {
  label: string;
  /** Optional badge drawn at the label's top-right corner. */ badge?: ReactNode;
  /** Tutorial target id for this tab. */
  targetId?: string;
  /** Icon over the label. */
  icon?: IconName;
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
export function TabButton({ label, badge, isFocused, targetId, icon, ref: _ref, ...props }: TabButtonProps) {
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
      {isFocused && !BOXED ? <View style={wide ? styles.markWide : styles.markNarrow} /> : null}
      <View style={[wide ? styles.labelBoxWide : null, BOXED && styles.box, BOXED && isFocused && styles.boxFocused]}>
        {BOXED && isFocused && (shape.panel === 'ticks' || shape.panel === 'bracket') ? <PanelDeco color={shape.panel === 'bracket' ? colors.player : undefined} size={5} /> : null}
        {icon ? (
          <View style={styles.icon}>
            <Icon name={icon} size={18} color={isFocused ? focusedColor : colors.dim} accent={isFocused ? accentFocused : colors.dim} />
          </View>
        ) : null}
        <Text style={[styles.label, isFocused && styles.focused]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {label}
        </Text>
        {badge ? <View style={styles.badge}>{badge}</View> : null}
      </View>
    </Pressable>
  );
}

/** Themes whose active tab is a box (title box, yellow plate, sticker) rather than a rule. */
const BOXED = shape.panel !== 'plain';
/** Icon colours of the active tab: ink on the theme's filled plates, otherwise text with the player accent. */
const FILLED = shape.panel === 'clip' || shape.panel === 'sticker';
const focusedColor = FILLED ? colors.onPlayer : colors.text;
const accentFocused = FILLED ? colors.onPlayer : colors.player;

const styles = StyleSheet.create({
  tab: { flex: 1, minHeight: touch, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.s },
  tabWide: { height: layout.railItemHeight, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  labelBoxWide: { maxWidth: layout.railWidth - 6, flexShrink: 0 },
  pressed: { opacity: 0.6 },
  icon: { alignItems: 'center', marginBottom: 1 },
  label: { ...voice.calmHeading, color: colors.dim, fontSize: shape.panel === 'ticks' || shape.panel === 'bracket' ? 10 : shape.panel === 'clip' ? type.m - 2 : shape.panel === 'sticker' ? type.s - 1 : type.s + 1, letterSpacing: shape.panel === 'plain' ? voice.calmHeading.letterSpacing : 0, lineHeight: type.s + 5, textAlign: 'center' },
  focused: { color: shape.panel === 'clip' || shape.panel === 'sticker' ? colors.onPlayer : colors.text },
  box: { paddingHorizontal: shape.panel === 'ticks' || shape.panel === 'bracket' ? 3 : 5, paddingVertical: 3, borderRadius: radius.pill, borderWidth: shape.hairline, borderColor: colors.transparent },
  boxFocused:
    shape.panel === 'ticks'
      ? { borderColor: colors.border, backgroundColor: colors.surface }
      : shape.panel === 'bracket'
        ? { borderColor: colors.border, backgroundColor: colors.surface, ...glow(colors.player, { inset: true, strength: 0.9 }) }
      : shape.panel === 'clip'
        ? { backgroundColor: colors.player, borderColor: colors.player }
        : { backgroundColor: colors.player, borderColor: colors.outline, borderWidth: shape.outline, paddingHorizontal: 2, ...flatShadow(2) },
  markWide: { position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, backgroundColor: colors.player },
  markNarrow: { position: 'absolute', bottom: 4, width: 18, height: 2, backgroundColor: colors.player },
  badge: { position: 'absolute', top: -8, left: '100%', marginLeft: 2 },
});
