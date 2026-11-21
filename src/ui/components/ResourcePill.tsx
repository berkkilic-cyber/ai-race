import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shape, spacing, tabular, type, voice } from '../theme';

export interface ResourcePillProps {
  label: string;
  value: string;
  /** Small second value, e.g. income per day. */
  sub?: string;
  subTone?: 'good' | 'bad' | 'dim';
  /** Accent for the value text. */
  color?: string;
  testID?: string;
  /** e.g. a flex weight so wider values get more room. */
  style?: StyleProp<ViewStyle>;
}

const TONE = { good: colors.good, bad: colors.bad, dim: colors.dim } as const;

export function ResourcePill({ label, value, sub, subTone = 'dim', color = colors.text, testID, style }: ResourcePillProps) {
  return (
    <View style={[styles.pill, style]} testID={testID} accessibilityLabel={`${label} ${value}${sub ? ` ${sub}` : ''}`}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, { color }]} numberOfLines={1}>
        {value}
      </Text>
      {sub ? (
        <Text style={[styles.sub, { color: TONE[subTone] }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: shape.panel === 'plain' ? 1 : shape.outline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
  },
  label: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs },
  value: { ...voice.calmNumber, fontSize: type.m, ...tabular },
  sub: { ...voice.body, fontSize: type.xs, ...tabular },
});
