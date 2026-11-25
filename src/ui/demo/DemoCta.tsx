import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { DemoCtaWhere } from '@/analytics';

import { Button } from '../components/Button';
import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, spacing, voice } from '../theme';
import { isDemo } from './config';
import { openWaitlist } from './gate';

export interface DemoCtaProps {
  /** Which screen it is on (the demo_cta_tap event's `where`). */
  where: DemoCtaWhere;
  /** Corner of the screen it floats in, inside the safe area. */
  corner?: 'topLeft' | 'topRight' | 'bottomLeft';
  /** False hides it (e.g. past the first step of the start flow). Default true. */
  visible?: boolean;
  /** Extra distance from the edge (to clear something already in that corner). */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The browser demo's call to action: a "Free demo" tag and a small "Join the waitlist" button
 * that opens the waitlist link. Floats in a corner of the screen; renders nothing in the full game.
 */
export function DemoCta({ where, corner = 'topLeft', offset = 0, visible = true, style }: DemoCtaProps) {
  const insets = useInsets();
  if (!isDemo() || !visible) return null;
  const top = insets.top + spacing.s + offset;
  const pos =
    corner === 'topLeft'
      ? { top, left: insets.left + spacing.m }
      : corner === 'topRight'
        ? { top, right: insets.right + spacing.m }
        : { bottom: insets.bottom + spacing.s + offset, left: insets.left + spacing.xl };
  return (
    <View style={[styles.wrap, pos, corner === 'topRight' && styles.right, style]} pointerEvents="box-none" testID={`demo-cta-${where}`}>
      <Text style={styles.badge}>{t('ui.demo.badge')}</Text>
      <Button label={t('ui.demo.cta')} variant="secondary" compact onPress={() => openWaitlist(where)} style={styles.button} testID={`demo-cta-${where}-button`} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', zIndex: 5, alignItems: 'flex-start', gap: 2 },
  right: { alignItems: 'flex-end' },
  badge: { ...voice.calmLabel, color: colors.player, fontSize: 10 },
  button: { minHeight: 36, paddingVertical: 4 },
});
