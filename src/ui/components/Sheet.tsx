import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';

import { layoutModeFor } from '../hooks/useLayoutMode';
import { t } from '../i18n';
import { colors, layout, radius, spacing, touch, type, voice } from '../theme';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Right side of the title row, e.g. a close button. In wide mode a close button is added when this is omitted. */
  headerRight?: ReactNode;
  children?: ReactNode;
  /** Largest height as a fraction of the parent (narrow mode only). Default 0.7. */
  maxHeight?: `${number}%`;
  testID?: string;
}

/** Width of the wide-mode side panel for a window width (the map uses it to keep the selection visible). */
export function sheetPanelWidth(windowWidth: number): number {
  return Math.round(Math.min(layout.panelWidth, windowWidth * layout.panelMaxFraction));
}

/**
 * Overlay panel inside its parent (not a native modal, so the screen behind stays live).
 * Place it last inside a full-size parent.
 * - Wide (landscape): a right-hand side panel, full height of the parent, sliding in
 *   from the right, no scrim, so whatever is beside it stays usable.
 * - Narrow (portrait): a bottom sheet over a light scrim; tapping the scrim closes it.
 */
export function Sheet({ visible, onClose, title, headerRight, children, maxHeight = '70%', testID }: SheetProps) {
  const { width, height } = useWindowDimensions();
  if (!visible) return null;
  if (layoutModeFor(width, height) === 'wide') {
    const right =
      headerRight ??
      (
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t('ui.sheet.close')} testID="sheet-close">
          <Text style={styles.closeLabel}>✕</Text>
        </Pressable>
      );
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View entering={SlideInRight.duration(200)} style={[styles.panel, { width: sheetPanelWidth(width) }]} testID={testID}>
          <View style={[styles.header, styles.panelHeader]}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {right}
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.panelContent}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    );
  }
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
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  panelHeader: { paddingTop: spacing.xs, paddingBottom: spacing.xs, paddingRight: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  scroll: { flex: 1 },
  panelContent: { padding: spacing.l, paddingTop: spacing.m, gap: spacing.m },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.s },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.l, gap: spacing.s },
  title: { ...voice.calmHeading, flex: 1, color: colors.text, fontSize: type.l + 2 },
  content: { padding: spacing.l, paddingTop: spacing.s, gap: spacing.m },
  close: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  closeLabel: { color: colors.text, fontSize: type.m, fontWeight: '700' },
});
