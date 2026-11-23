import { useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { pressFeedback } from '../feel/cues';
import { Text } from '../locale/Text';
import { colors, flatShadow, glow, radius, shape, spacing, touch, type, voice } from '../theme';
import { cased } from '../locale/casing';

/** primary: the accent, weighted; secondary: quiet outline; ghost: text on a hairline; danger: alarm; ink: the loud voice (tabloid black). */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Second line under the label, e.g. a cost or the reason it is disabled. */
  sublabel?: string;
  /** Tighter padding for rows of small buttons (still at least 44 points high). */
  compact?: boolean;
  /** Highlights a toggle button (e.g. the active speed). */
  selected?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const BG: Record<ButtonVariant, string> = {
  primary: colors.player,
  secondary: colors.surface,
  ghost: colors.transparent,
  danger: colors.alarm,
  ink: colors.newsInk,
};

const FG: Record<ButtonVariant, string> = {
  primary: colors.onPlayer,
  secondary: colors.text,
  ghost: colors.text,
  danger: colors.newsPaper,
  ink: colors.newsPaper,
};

/** Primary and ink buttons stand on a heavier lower edge that they press into (theme depth). */
const EDGE = shape.buttonEdge;
/** Sticker themes lift buttons on a flat offset shadow instead and press them flat. */
const LIFT = shape.shadow;

/** Button label per shape language: mono capitals, heavy condensed capitals, rounded bold, system bold. */
const LABEL: TextStyle =
  shape.panel === 'ticks'
    ? { ...voice.calmHeading, fontSize: type.s, letterSpacing: 1 }
    : shape.panel === 'clip'
      ? { ...voice.calmHeading, fontSize: type.l, letterSpacing: 1 }
      : shape.panel === 'sticker'
        ? { ...voice.bodyStrong, fontSize: type.m + 1 }
        : shape.panel === 'bracket'
          ? { ...voice.calmHeading, fontSize: type.s + 1, letterSpacing: 1.2 }
          : { fontSize: type.m, fontWeight: '700' };

export function Button({ label, onPress, variant = 'secondary', disabled, sublabel, compact, selected, accessibilityLabel, testID, style }: ButtonProps) {
  const weighted = variant === 'primary' || variant === 'ink';
  const fg = selected ? colors.bg : disabled && shape.panel !== 'plain' ? colors.dim : FG[variant];
  // Feel: the content squeezes while pressed (native driver: on the UI thread, no React state per frame);
  // a press answers with a tap sound and buzz (src/ui/feel).
  const [squeeze] = useState(() => new Animated.Value(1));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      onPress={() => pressFeedback(onPress)}
      onPressIn={() => squeezeTo(squeeze, 0.94, 60)}
      onPressOut={() => squeezeTo(squeeze, 1, 140)}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: selected ? colors.text : BG[variant] },
        variant === 'secondary' && styles.outline,
        variant === 'ghost' && styles.ghost,
        variant === 'ink' && styles.ink,
        weighted && EDGE > 0 && styles.weighted,
        variant === 'primary' && styles.primaryEdge,
        variant === 'ink' && styles.inkEdge,
        LIFT > 0 && variant !== 'ghost' && !disabled && styles.lifted,
        variant === 'primary' && !disabled && styles.glow,
        disabled && styles.disabled,
        pressed && !disabled && (LIFT > 0 ? styles.pressedLifted : weighted && EDGE > 0 ? styles.pressedWeighted : variant === 'primary' && shape.glow > 0 ? styles.pressedGlow : styles.pressed),
        style,
      ]}
    >
      <Animated.View style={[styles.inner, { transform: [{ scale: squeeze }] }]}>
        <Text style={[styles.label, compact && styles.labelCompact, variant === 'ink' && styles.labelInk, { color: fg }]} numberOfLines={1}>
          {cased(LABEL, label)}
        </Text>
        {sublabel ? (
          <Text style={[styles.sub, { color: fg }, !weighted && variant !== 'danger' && !selected && styles.subDim]} numberOfLines={2}>
            {sublabel}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function squeezeTo(v: Animated.Value, toValue: number, duration: number): void {
  Animated.timing(v, { toValue, duration, useNativeDriver: Platform.OS !== 'web' }).start();
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch,
    minWidth: touch,
    borderRadius: shape.panel === 'sticker' ? radius.pill : radius.s,
    // Strong outlines on every button where the theme draws them (blueprint linework, hazard, candy ink).
    borderWidth: shape.panel === 'plain' ? 0 : shape.outline,
    borderColor: shape.panel === 'plain' ? colors.transparent : colors.outline,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compact: { paddingHorizontal: spacing.s, paddingVertical: spacing.xs },
  outline: { borderWidth: shape.panel === 'plain' ? StyleSheet.hairlineWidth : shape.outline, borderColor: shape.panel === 'plain' ? colors.border : colors.outline },
  ghost: { borderWidth: shape.hairline, borderColor: colors.border },
  ink: { borderRadius: radius.none },
  weighted: { borderBottomWidth: EDGE },
  primaryEdge: shape.panel === 'plain' ? { borderBottomColor: colors.playerDeep } : { borderColor: shape.panel === 'sticker' ? colors.outline : colors.player, borderBottomColor: EDGE > 0 ? colors.playerDeep : shape.panel === 'sticker' ? colors.outline : colors.player },
  lifted: flatShadow(LIFT),
  pressedLifted: { transform: [{ translateX: LIFT }, { translateY: LIFT }], boxShadow: 'none' },
  inkEdge: { borderColor: colors.newsInk, borderBottomColor: shape.composure === 'tape' ? colors.stripeA : colors.newsRed },
  // Soft themes fade a disabled button; the others draw it as a dashed outline (no muddy half-tones).
  disabled: shape.panel === 'plain' ? { opacity: 0.55 } : { backgroundColor: colors.transparent, borderStyle: 'dashed', borderColor: colors.dim, borderBottomColor: colors.dim, borderBottomWidth: shape.outline },
  pressed: { backgroundColor: colors.raised, transform: [{ translateY: 1 }] },
  // Neon: the primary action glows; pressed, it dims to its deeper green and the glow goes out.
  glow: glow(colors.player, { strength: 1.2 }),
  pressedGlow: { backgroundColor: colors.playerDeep, borderColor: colors.playerDeep, boxShadow: 'none', transform: [{ translateY: 1 }] },
  pressedWeighted: { borderBottomWidth: 0, marginTop: EDGE, transform: [{ translateY: 0 }] },
  inner: { alignItems: 'center' },
  label: LABEL,
  labelCompact: { fontSize: (LABEL.fontSize ?? type.m) - 2 },
  labelInk: { ...voice.loudKicker, fontWeight: 'normal', fontSize: 19, lineHeight: 22, letterSpacing: 1.6 },
  sub: { ...voice.body, fontSize: type.xs, marginTop: 2, textAlign: 'center', opacity: 0.9 },
  subDim: { color: colors.dim, opacity: 1 },
});
