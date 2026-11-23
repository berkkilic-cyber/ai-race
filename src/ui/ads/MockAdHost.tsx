import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Stamp } from '../components/Deco';
import { Overlay } from '../components/Overlay';
import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, spacing, tabular, touch, type, voice } from '../theme';
import { mockSeconds } from './config';
import { useAdStore } from './store';

/** Above every other layer of the Garage screen. */
export const AD_LAYER = 95;

/**
 * The mock provider's test ad: a full-screen in-tree layer, clearly labelled as a test,
 * with the reward, a countdown and a close button that is there from the first second.
 * Mount once at the root of a screen that offers ads.
 */
export function MockAdHost() {
  const mock = useAdStore((s) => s.mock);
  const insets = useInsets();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!mock) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [mock]);
  if (!mock) return null;
  const total = mockSeconds();
  const left = Math.max(0, Math.min(total, Math.ceil(total - (now - mock.startedAt) / 1000)));
  const done = left <= 0;
  return (
    <Overlay visible layer={AD_LAYER} onRequestClose={() => mock.resolve('dismissed')} testID="mock-ad">
      <View style={[styles.page, { paddingTop: insets.top + spacing.m, paddingBottom: insets.bottom + spacing.m, paddingLeft: insets.left + spacing.xl, paddingRight: insets.right + spacing.xl }]}>
        <Pressable onPress={() => mock.resolve('dismissed')} style={[styles.close, { top: insets.top + spacing.s, right: insets.right + spacing.s }]} accessibilityRole="button" accessibilityLabel={t('ui.ads.test.closeLabel')} testID="mock-ad-close">
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <View style={styles.card}>
          <Stamp text={t('ui.ads.test.kicker')} rotate={-3} size={18} />
          <Text style={styles.title}>{t('ui.ads.test.title')}</Text>
          <Text style={styles.body}>{t('ui.ads.test.body')}</Text>
          <Text style={styles.reward} testID="mock-ad-reward">
            {t('ui.ads.test.reward', { reward: mock.reward })}
          </Text>
          <View style={styles.row}>
            <Text style={styles.count} testID="mock-ad-countdown">
              {done ? ' ' : t('ui.ads.test.countdown', { seconds: left })}
            </Text>
            <Button label={t('ui.ads.test.claim')} variant="primary" disabled={!done} onPress={() => mock.resolve('rewarded')} testID="mock-ad-claim" style={styles.claim} />
          </View>
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.newsInk, alignItems: 'center', justifyContent: 'center' },
  card: { maxWidth: 520, width: '100%', gap: spacing.s, padding: spacing.l, borderWidth: 2, borderColor: colors.newsPaper, borderStyle: 'dashed' },
  title: { ...voice.loudHeadline, color: colors.newsPaper, fontSize: 28, lineHeight: 30 },
  body: { ...voice.body, color: colors.newsPaper, fontSize: type.s, opacity: 0.85, lineHeight: 19 },
  reward: { ...voice.bodyStrong, color: colors.newsPaper, fontSize: type.m },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.l, marginTop: spacing.s },
  count: { ...voice.calmNumber, ...tabular, color: colors.newsPaper, fontSize: type.l },
  claim: { minWidth: 180 },
  close: { position: 'absolute', width: touch, height: touch, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  closeText: { color: colors.newsPaper, fontSize: type.l, fontWeight: '700' },
});
