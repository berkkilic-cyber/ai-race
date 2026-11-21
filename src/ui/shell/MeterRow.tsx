import { StyleSheet, View } from 'react-native';

import { Meter } from '../components/Meter';
import { useMeters } from '../hooks/useGame';
import { t } from '../i18n';
import { colors, spacing } from '../theme';
import { useTutorialTarget } from '../tutorial/targets';
import { RaceMeter } from './RaceMeter';

/** Regulation and Backlash as labelled bars, then the AGI race. */
export function MeterRow() {
  const m = useMeters();
  const tutorialRef = useTutorialTarget('shell.meters');
  return (
    <View style={styles.row} ref={tutorialRef}>
      <Meter label={t('term.regulation')} value={m.regulation} color={colors.info} testID="meter-regulation" />
      <Meter label={t('term.backlash')} value={m.backlash} color={colors.alarm} testID="meter-backlash" />
      {/* The AGI race: the player against the leading rival, as in the wide strip. */}
      <RaceMeter tag={null} testID="meter-rival" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.m, paddingHorizontal: spacing.m, paddingVertical: spacing.s },
});
