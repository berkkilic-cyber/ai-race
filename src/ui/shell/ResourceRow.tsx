import { StyleSheet, View } from 'react-native';

import { ResourcePill } from '../components/ResourcePill';
import { fmtCash, fmtCompact, fmtPerDay } from '../format';
import { useResources } from '../hooks/useGame';
import { t } from '../i18n';
import { colors, spacing } from '../theme';

/** Hype, Cash with income per day, Compute and Model tier. */
export function ResourceRow() {
  const r = useResources();
  const income = r.cashPerDay;
  return (
    <View style={styles.row}>
      <ResourcePill label={t('term.hype')} value={fmtCompact(r.hype)} sub={fmtPerDay(`+${fmtCompact(r.hypePerDay)}`)} subTone="dim" color={colors.info} testID="res-hype" />
      <ResourcePill
        label={t('term.cash')}
        value={fmtCash(r.cash)}
        sub={fmtPerDay(`${income >= 0 ? '+' : ''}${fmtCash(income)}`)}
        subTone={income >= 0 ? 'good' : 'bad'}
        color={colors.good}
        testID="res-cash"
        style={styles.wide}
      />
      <ResourcePill label={t('term.compute')} value={fmtCompact(r.compute)} testID="res-compute" style={styles.narrow} />
      <ResourcePill label={t('term.capability')} value={t('ui.resource.tier', { tier: r.tier })} color={colors.player} testID="res-tier" style={styles.narrow} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.m },
  wide: { flex: 1.45 },
  narrow: { flex: 0.85 },
});
