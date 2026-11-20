import { useEffect, useRef, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';

import { useInsets } from '../hooks/useInsets';
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
  /**
   * Set when the parent reaches the screen edges (start flow, end screen): the panel then
   * extends under the insets with its content kept inside the safe area. Leave unset inside
   * the game shell, whose main area is already inside the safe area.
   */
  safeArea?: boolean;
  /**
   * Wide mode: a tap anywhere outside the panel (in the parent) closes it, through an
   * invisible layer below the panel. Default true. Turn it off only where the content beside
   * the panel must stay interactive (the map's region panel). Narrow mode always closes on
   * a tap on its scrim. Android back closes every sheet.
   */
  dismissOnOutsidePress?: boolean;
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
 *   from the right, no scrim. A tap outside it closes it (an invisible layer below the
 *   panel), unless `dismissOnOutsidePress` is off, as for the map's region panel.
 * - Narrow (portrait): a bottom sheet over a light scrim; tapping the scrim closes it.
 */
export function Sheet({ visible, onClose, title, headerRight, children, maxHeight = '70%', safeArea = false, dismissOnOutsidePress = true, testID }: SheetProps) {
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  useBackToClose(visible, onClose);
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
        {/* Below the panel in z-order, above the page: an outside tap closes the panel. Draws nothing. */}
        {dismissOnOutsidePress ? (
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('ui.sheet.close')} testID="sheet-outside" {...NOT_FOCUSABLE} />
        ) : null}
        <Animated.View
          entering={SlideInRight.duration(200)}
          style={[styles.panel, { width: sheetPanelWidth(width) + edge.right, paddingTop: edge.top, paddingRight: edge.right, paddingBottom: edge.bottom }]}
          testID={testID}
        >
          <View style={[styles.header, styles.panelHeader]}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {right}
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.panelContent} {...KEYBOARD_SCROLL}>
            {children}
          </ScrollView>
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

/** The outside layer is for pointers only; keyboard and screen-reader users have the close button. */
const NOT_FOCUSABLE = { accessible: false, focusable: false, tabIndex: -1 } as const;

/** Android back closes the open sheet (the most recently opened one first). */
function useBackToClose(visible: boolean, onClose: () => void) {
  const handler = useRef(onClose);
  useEffect(() => {
    handler.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handler.current();
      return true;
    });
    return () => sub.remove();
  }, [visible]);
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
