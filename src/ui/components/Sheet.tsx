import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';

import { useInsets } from '../hooks/useInsets';
import { layoutModeFor } from '../hooks/useLayoutMode';
import { t } from '../i18n';
import { colors, flatShadow, layout, radius, shape, spacing, touch, type, voice } from '../theme';
import { PanelDeco, Stripes } from './Deco';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Right side of the title row, e.g. a close button. In wide mode a close button is added when this is omitted. */
  headerRight?: ReactNode;
  children?: ReactNode;
  /** Largest height as a fraction of the parent (narrow mode only). Default 0.7. */
  maxHeight?: `${number}%`;
  /**
   * Set when the parent reaches the screen edges (start flow, end screen): the panel then
   * extends under the insets with its content kept inside the safe area. Leave unset inside
   * the game shell, whose main area is already inside the safe area.
   */
  safeArea?: boolean;
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
export function Sheet({ visible, onClose, title, headerRight, children, maxHeight = '70%', safeArea = false, testID }: SheetProps) {
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  if (!visible) return null;
  const edge = safeArea ? insets : { top: 0, right: 0, bottom: 0, left: 0 };
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
        <Animated.View
          entering={SlideInRight.duration(200)}
          style={[styles.panel, { width: sheetPanelWidth(width) + edge.right, paddingTop: edge.top, paddingRight: edge.right, paddingBottom: edge.bottom }]}
          testID={testID}
        >
          {shape.composure === 'tape' ? <Stripes height={5} stripe={6} /> : null}
          <View style={[styles.header, styles.panelHeader]}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {right}
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.panelContent} {...KEYBOARD_SCROLL}>
            {children}
          </ScrollView>
          {shape.panel === 'ticks' ? <PanelDeco /> : null}
        </Animated.View>
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="close" />
      <View style={[styles.sheet, { maxHeight, paddingBottom: edge.bottom, paddingLeft: edge.left, paddingRight: edge.right }]} testID={testID}>
        <View style={styles.handle} />
        {title || headerRight ? (
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {headerRight}
          </View>
        ) : null}
        <ScrollView contentContainerStyle={styles.content} {...KEYBOARD_SCROLL}>
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * Sheets may hold text fields (the region search): taps on rows work while the keyboard
 * is up, dragging the list dismisses it, and iOS scrolls the content clear of it.
 */
const KEYBOARD_SCROLL = { keyboardShouldPersistTaps: 'handled', keyboardDismissMode: 'on-drag', automaticallyAdjustKeyboardInsets: true } as const;

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
    borderWidth: shape.panel === 'plain' ? 1 : shape.outline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    paddingTop: spacing.s,
  },
  // The side panel per shape: a ruled sheet (soft), an outlined drawing sheet inset from the
  // edges (blueprint), a plate under a stripe band (hazard), a floating sticker (candy).
  panel: {
    position: 'absolute',
    top: shape.panel === 'sticker' ? spacing.s : shape.panel === 'ticks' ? spacing.m : 0,
    right: shape.panel === 'sticker' ? spacing.s : shape.panel === 'ticks' ? spacing.m : 0,
    bottom: shape.panel === 'sticker' ? spacing.s + shape.shadow : shape.panel === 'ticks' ? spacing.m : 0,
    backgroundColor: colors.surface,
    borderLeftWidth: shape.panel === 'clip' ? 0 : shape.panel === 'plain' ? StyleSheet.hairlineWidth : shape.outline,
    borderWidth: shape.panel === 'sticker' || shape.panel === 'ticks' ? shape.outline : 0,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    borderRadius: radius.l,
    ...flatShadow(),
  },
  panelHeader: { paddingTop: spacing.xs, paddingBottom: spacing.xs, paddingRight: spacing.xs, borderBottomWidth: shape.hairline, borderColor: shape.panel === 'sticker' ? colors.outline : colors.border },
  scroll: { flex: 1 },
  panelContent: { padding: spacing.l, paddingTop: spacing.m, gap: spacing.m },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.s },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.l, gap: spacing.s },
  title: { ...voice.calmHeading, flex: 1, color: colors.text, fontSize: shape.panel === 'ticks' ? type.m : shape.panel === 'clip' ? type.xl : type.l + 2 },
  content: { padding: spacing.l, paddingTop: spacing.s, gap: spacing.m },
  close: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  closeLabel: { color: colors.text, fontSize: type.m, fontWeight: '700', fontFamily: voice.bodyStrong.fontFamily },
});
