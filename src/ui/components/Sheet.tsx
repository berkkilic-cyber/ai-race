import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '../theme';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Right side of the title row, e.g. a close button. */
  headerRight?: ReactNode;
  children?: ReactNode;
  /** Largest height as a fraction of the parent. Default 0.7. */
  maxHeight?: `${number}%`;
  testID?: string;
}

/**
 * Bottom sheet over its parent (not a native modal, so the screen behind stays live).
 * Tapping the scrim closes it. Place it last inside a full-size parent.
 */
export function Sheet({ visible, onClose, title, headerRight, children, maxHeight = '70%', testID }: SheetProps) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="close" />
      <View style={[styles.sheet, { maxHeight }]} testID={testID}>
        <View style={styles.handle} />
        {title || headerRight ? (
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {headerRight}
          </View>
        ) : null}
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrimLight },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: spacing.s,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.s },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.l, gap: spacing.s },
  title: { flex: 1, color: colors.text, fontSize: type.l, fontWeight: '700' },
  content: { padding: spacing.l, paddingTop: spacing.s, gap: spacing.m },
});
