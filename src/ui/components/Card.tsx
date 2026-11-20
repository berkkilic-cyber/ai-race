import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, flatShadow, radius, shape, spacing } from '../theme';
import { PanelDeco } from './Deco';

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
      <PanelDeco ground={colors.bg} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: shape.panel === 'sticker' ? shape.outline : shape.hairline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    padding: spacing.l,
    ...flatShadow(),
  },
  raised: { backgroundColor: colors.raised },
});
