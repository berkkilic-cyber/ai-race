import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '../theme';

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

/** A centred card over everything, on a dark scrim. */
export function ModalCard({ visible, title, tone = 'neutral', children, onRequestClose, testID }: ModalCardProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose ?? (() => undefined)} statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={[styles.card, { borderTopColor: TONE[tone] }]} testID={testID}>
          <ScrollView contentContainerStyle={styles.content}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 4,
    overflow: 'hidden',
  },
  content: { padding: spacing.xl, gap: spacing.m },
  title: { color: colors.text, fontSize: type.xl, fontWeight: '800' },
});
