import { StyleSheet, View } from 'react-native';

import { Meter } from '../components/Meter';
import { useMeters } from '../hooks/useGame';
import { t } from '../i18n';
import { colors, spacing } from '../theme';

/** Regulation, Backlash and Rival as labelled bars. */
export function MeterRow() {
  const m = useMeters();
  return (
    <View style={styles.row}>
      <Meter label={t('term.regulation')} value={m.regulation} color={colors.info} testID="meter-regulation" />
      <Meter label={t('term.backlash')} value={m.backlash} color={colors.bad} testID="meter-backlash" />
      <Meter label={t('term.rival')} value={m.rival} color={colors.player} testID="meter-rival" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.m, paddingHorizontal: spacing.m, paddingVertical: spacing.s },
});
