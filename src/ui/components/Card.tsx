import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';

export interface CardProps {
  children?: ReactNode;
  /** Raised surface colour instead of the plain surface. */
  raised?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({ children, raised, style, testID }: CardProps) {
  return (
    <View testID={testID} style={[styles.card, raised && styles.raised, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
  },
  raised: { backgroundColor: colors.raised },
});
