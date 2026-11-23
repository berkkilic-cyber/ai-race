import { useEffect, useRef, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';

import { logLifecycle } from '../diagnostics/log';
import { pressFeedback } from '../feel/cues';
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
  /**
   * Wide mode: a tap anywhere outside the panel (in the parent) closes it, through an
   * invisible layer below the panel. Default true. Turn it off only where the content beside
   * the panel must stay interactive (the map's region panel). Narrow mode always closes on
   * a tap on its scrim. Android back closes every sheet.
   */
  dismissOnOutsidePress?: boolean;
  /** Ref (callback) for the panel view, e.g. to register it as a tutorial target. */
  panelRef?: (node: unknown) => void | (() => void);
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
export function Sheet({ visible, onClose: onCloseProp, title, headerRight, children, maxHeight = '70%', safeArea = false, dismissOnOutsidePress = true, panelRef, testID }: SheetProps) {
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  const onClose = () => pressFeedback(onCloseProp, 'back'); // feel: the close sound (src/ui/feel)
  useBackToClose(visible, onClose);
  useOpenLog(visible, testID ?? title);
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
          ref={panelRef as never}
          collapsable={false}
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
          {shape.panel === 'ticks' || shape.panel === 'bracket' ? <PanelDeco /> : null}
        </Animated.View>
      </View>
    );
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="close" />
      <View ref={panelRef as never} collapsable={false} style={[styles.sheet, { maxHeight, paddingBottom: edge.bottom, paddingLeft: edge.left, paddingRight: edge.right }]} testID={testID}>
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

/** `[AI-RACE] panel opened` when a sheet appears (development builds). */
function useOpenLog(visible: boolean, name: string | undefined) {
  useEffect(() => {
    if (visible) logLifecycle('panel opened', { panel: name ?? 'sheet' });
  }, [visible, name]);
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
    borderWidth: shape.panel === 'plain' ? 1 : shape.outline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    paddingTop: spacing.s,
  },
  // The side panel per shape: a ruled sheet (soft), an outlined drawing sheet inset from the
  // edges (blueprint), a plate under a stripe band (hazard), a floating sticker (candy).
  panel: {
    position: 'absolute',
    top: shape.panel === 'sticker' || shape.panel === 'bracket' ? spacing.s : shape.panel === 'ticks' ? spacing.m : 0,
    right: shape.panel === 'sticker' || shape.panel === 'bracket' ? spacing.s : shape.panel === 'ticks' ? spacing.m : 0,
    bottom: shape.panel === 'sticker' || shape.panel === 'bracket' ? spacing.s + shape.shadow : shape.panel === 'ticks' ? spacing.m : 0,
    backgroundColor: colors.surface,
    borderLeftWidth: shape.panel === 'clip' ? 0 : shape.panel === 'plain' ? StyleSheet.hairlineWidth : shape.outline,
    borderWidth: shape.panel === 'sticker' || shape.panel === 'ticks' || shape.panel === 'bracket' ? shape.outline : 0,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    borderRadius: radius.l,
    ...flatShadow(),
  },
  panelHeader: { paddingTop: spacing.xs, paddingBottom: spacing.xs, paddingRight: spacing.xs, borderBottomWidth: shape.hairline, borderColor: shape.panel === 'sticker' ? colors.outline : colors.border },
  scroll: { flex: 1 },
  panelContent: { padding: spacing.l, paddingTop: spacing.m, gap: spacing.m },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.s },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.l, gap: spacing.s },
  title: { ...voice.calmHeading, flex: 1, color: colors.text, fontSize: shape.panel === 'ticks' || shape.panel === 'bracket' ? type.m : shape.panel === 'clip' ? type.xl : type.l + 2 },
  content: { padding: spacing.l, paddingTop: spacing.s, gap: spacing.m },
  close: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  closeLabel: { color: colors.text, fontSize: type.m, fontWeight: '700', fontFamily: voice.bodyStrong.fontFamily },
});
