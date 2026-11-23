import { StyleSheet, Switch, View } from 'react-native';

import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, spacing, type, voice } from '../theme';
import { useAdStore } from './store';

/**
 * The home of the future "Remove ads" purchase: explains it and, until purchases exist,
 * carries a test switch that simulates it (rewards are then granted without an ad).
 */
export function RemoveAdsPanel() {
  const removed = useAdStore((s) => s.adsRemoved);
  const setRemoved = useAdStore((s) => s.setAdsRemoved);
  return (
    <View style={styles.wrap} testID="remove-ads-panel">
      <Text style={styles.title}>{t('ui.ads.remove.title')}</Text>
      <Text style={styles.body}>{t('ui.ads.remove.body')}</Text>
      <Text style={styles.dim}>{t('ui.ads.remove.soon')}</Text>
      <View style={styles.row}>
        <Text style={styles.body}>{t('ui.ads.remove.simulate')}</Text>
        <Switch value={removed} onValueChange={setRemoved} accessibilityLabel={t('ui.ads.remove.simulate')} testID="remove-ads-switch" />
      </View>
      {removed ? <Text style={styles.active}>{t('ui.ads.remove.active')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.s },
  title: { ...voice.calmHeading, color: colors.text, fontSize: type.m },
  body: { ...voice.body, color: colors.text, fontSize: type.s, lineHeight: 19, flexShrink: 1 },
  dim: { ...voice.body, color: colors.dim, fontSize: type.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.m },
  active: { ...voice.bodyStrong, color: colors.goodText, fontSize: type.s },
});
