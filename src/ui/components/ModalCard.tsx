import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useInsets } from '../hooks/useInsets';
import { layoutModeFor } from '../hooks/useLayoutMode';
import { Text } from '../locale/Text';
import { colors, flatShadow, layer, layout, radius, shape, spacing, type, voice } from '../theme';
import { Overlay } from './Overlay';

export interface ModalCardProps {
  visible: boolean;
  title?: string;
  /** Colours the top edge: good, bad or neutral. */
  tone?: 'good' | 'bad' | 'neutral';
  children?: ReactNode;
  /** Called on Android back; omit to make the card impossible to dismiss without choosing. */
  onRequestClose?: () => void;
  testID?: string;
}

const TONE = { good: colors.good, bad: colors.bad, neutral: colors.info } as const;

/**
 * A centred card over everything, on a dark scrim. Its content scrolls inside the card.
 * Wide (landscape): up to layout.modalMaxWidth wide and at most the screen height minus
 * the safe areas and a margin. Narrow: up to 480 wide and 90% of the safe height.
 * Drawn in the tree (Overlay), not as a native Modal: mount it last at the root of a screen.
 */
export function ModalCard({ visible, title, tone = 'neutral', children, onRequestClose, testID }: ModalCardProps) {
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  const wide = layoutModeFor(width, height) === 'wide';
  // The scrim covers the screen; the card stays inside the safe area in both modes.
  const scrimInsets = wide
    ? { paddingTop: insets.top + spacing.m, paddingBottom: insets.bottom + spacing.m, paddingLeft: insets.left + spacing.l, paddingRight: insets.right + spacing.l }
    : { paddingTop: insets.top + spacing.l, paddingBottom: insets.bottom + spacing.l, paddingLeft: insets.left + spacing.l, paddingRight: insets.right + spacing.l };
  const cardSize = wide ? { maxWidth: layout.modalMaxWidth, maxHeight: Math.max(0, height - insets.top - insets.bottom - 2 * spacing.m) } : null;
  return (
    <Overlay visible={visible} layer={layer.event} onRequestClose={onRequestClose}>
      <Animated.View entering={FadeIn.duration(160)} style={[styles.scrim, scrimInsets]}>
        <View style={[styles.card, cardSize, { borderTopColor: TONE[tone] }]} testID={testID}>
          <ScrollView contentContainerStyle={[styles.content, wide && styles.contentWide]}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </ScrollView>
        </View>
      </Animated.View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.l },
  card: {
    maxHeight: '90%',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: shape.panel === 'plain' ? 1 : shape.outline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    borderTopWidth: 4,
    overflow: 'hidden',
    ...flatShadow(),
  },
  content: { padding: spacing.xl, gap: spacing.m },
  contentWide: { padding: spacing.l, gap: spacing.s },
  title: { ...voice.calmHeading, color: colors.text, fontSize: type.xl },
});
