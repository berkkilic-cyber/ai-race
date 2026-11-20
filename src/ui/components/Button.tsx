import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, touch, type } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

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
  secondary: colors.raised,
  ghost: colors.transparent,
  danger: colors.bad,
};

export function Button({ label, onPress, variant = 'secondary', disabled, sublabel, compact, selected, accessibilityLabel, testID, style }: ButtonProps) {
  const onAccent = variant === 'primary' || variant === 'danger' || selected;
  const fg = onAccent ? colors.onPlayer : colors.text;
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
        { backgroundColor: selected ? colors.player : BG[variant] },
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.inner}>
        <Text style={[styles.label, compact && styles.labelCompact, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[styles.sub, { color: onAccent ? colors.onPlayer : colors.dim }]} numberOfLines={2}>
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
  ghost: { borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  inner: { alignItems: 'center' },
  label: { fontSize: type.m, fontWeight: '700' },
  labelCompact: { fontSize: type.s },
  sub: { fontSize: type.xs, marginTop: 2, textAlign: 'center' },
});
