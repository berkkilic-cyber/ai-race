import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, touch, type, voice } from '../theme';

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

/** Primary and ink buttons stand on a heavier lower edge that they press into. */
const EDGE = 3;

export function Button({ label, onPress, variant = 'secondary', disabled, sublabel, compact, selected, accessibilityLabel, testID, style }: ButtonProps) {
  const weighted = variant === 'primary' || variant === 'ink';
  const fg = selected ? colors.bg : FG[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: selected ? colors.text : BG[variant] },
        variant === 'secondary' && styles.outline,
        variant === 'ghost' && styles.ghost,
        variant === 'ink' && styles.ink,
        weighted && styles.weighted,
        variant === 'primary' && styles.primaryEdge,
        variant === 'ink' && styles.inkEdge,
        disabled && styles.disabled,
        pressed && !disabled && (weighted ? styles.pressedWeighted : styles.pressed),
        style,
      ]}
    >
      <View style={styles.inner}>
        <Text style={[styles.label, compact && styles.labelCompact, variant === 'ink' && styles.labelInk, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[styles.sub, { color: fg }, !weighted && variant !== 'danger' && !selected && styles.subDim]} numberOfLines={2}>
            {sublabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch,
    minWidth: touch,
    borderRadius: radius.s,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compact: { paddingHorizontal: spacing.s, paddingVertical: spacing.xs },
  outline: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  ghost: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  ink: { borderRadius: radius.none },
  weighted: { borderBottomWidth: EDGE },
  primaryEdge: { borderBottomColor: colors.playerDeep },
  inkEdge: { borderBottomColor: colors.newsRed },
  disabled: { opacity: 0.42 },
  pressed: { backgroundColor: colors.raised, transform: [{ translateY: 1 }] },
  pressedWeighted: { borderBottomWidth: 0, marginTop: EDGE, transform: [{ translateY: 0 }] },
  inner: { alignItems: 'center' },
  label: { fontSize: type.m, fontWeight: '700' },
  labelCompact: { fontSize: type.s },
  labelInk: { ...voice.loudKicker, fontWeight: 'normal', fontSize: 19, lineHeight: 22, letterSpacing: 1.6 },
  sub: { fontSize: type.xs, marginTop: 2, textAlign: 'center', opacity: 0.9 },
  subDim: { color: colors.dim, opacity: 1 },
});
