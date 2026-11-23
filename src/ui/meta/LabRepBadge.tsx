import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '../locale/Text';

import { garageContent } from '../garage/content';
import { t } from '../i18n';
import { cased } from '../locale/casing';
import { colors, radius, spacing, tabular, type, voice } from '../theme';
import { labRepLevel } from './logic';
import { perkName } from './text';

export interface LabRepBadgeProps {
  /** Lab Rep with its fraction. */
  total: number;
  /** Show "Next: Fan club at 9" under the bar. Default true. */
  showNext?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Lab Rep, the account level shared by both modes: the level and a thin bar to the next perk.
 * Quiet on purpose (it is not a currency). The same component on the start screen, the end
 * screen and in the Garage.
 */
export function LabRepBadge({ total, showNext = true, style, testID = 'lab-rep-badge' }: LabRepBadgeProps) {
  const content = garageContent();
  const { level, next, progress } = labRepLevel(content, total);
  const pct = Math.round(Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) * 100);
  return (
    <View style={[styles.wrap, style]} testID={testID} accessibilityLabel={t('ui.meta.labRep', { level })}>
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1}>
          {cased(styles.label, t('ui.meta.labRep', { level }))}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
      {showNext ? (
        <Text style={styles.next} numberOfLines={1}>
          {next ? t('ui.meta.next', { perk: perkName(next, content), rep: next.rep }) : t('ui.meta.maxed')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  label: { ...voice.calmLabel, ...tabular, color: colors.playerText, fontSize: type.xs, flexShrink: 0 },
  track: { flex: 1, minWidth: 36, maxWidth: 120, height: 4, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.player },
  next: { ...voice.body, color: colors.dim, fontSize: type.xs },
});
