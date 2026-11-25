import { StyleSheet, View } from 'react-native';

import { Sheet } from '../components/Sheet';
import { fmtInt } from '../format';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, radius, shape, spacing, tabular, type, voice } from '../theme';
import { dailyDateText, resultLine } from './DailyCard';
import { historyNewestFirst, streakOf } from './logic';
import { todayKey, useDailyStore } from './store';

function Stat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.stat} testID={testID}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** The Daily sheet: streak, best streak, and the last 30 dailies (date, ending, score). Local only. */
export function DailySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const record = useDailyStore((s) => s.record);
  const clock = useDailyStore((s) => s.clock);
  const streak = streakOf(record, todayKey(clock));
  const rows = historyNewestFirst(record);
  return (
    <Sheet visible={visible} onClose={onClose} title={t('ui.daily.sheet.title')} safeArea testID="daily-sheet">
      <View style={styles.stats}>
        <Stat label={t('ui.daily.sheet.streak')} value={fmtInt(streak.current)} testID="daily-sheet-streak" />
        <Stat label={t('ui.daily.sheet.best')} value={fmtInt(streak.best)} />
        <Stat label={t('ui.daily.sheet.played')} value={fmtInt(rows.length)} />
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>{t('ui.daily.sheet.empty')}</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((r) => (
            <View key={r.key} style={styles.row} testID={`daily-row-${r.key}`}>
              <View style={styles.rowText}>
                <Text style={styles.rowDate} numberOfLines={1}>
                  {t('ui.daily.sheet.row', { number: r.number, date: dailyDateText(r.key) })}
                </Text>
                <Text style={[styles.rowEnding, r.won && styles.won]} numberOfLines={1}>
                  {resultLine(r, 'ui.daily.sheet.abandoned')}
                </Text>
              </View>
              <Text style={styles.rowScore}>{r.ending === null ? '–' : fmtInt(r.score)}</Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.note}>{t('ui.daily.sheet.note')}</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  stat: { flex: 1, backgroundColor: colors.raised, borderRadius: radius.s, borderWidth: shape.hairline, borderColor: colors.border, padding: spacing.s, alignItems: 'center' },
  statValue: { ...voice.calmNumber, color: colors.playerText, fontSize: type.xl },
  statLabel: { ...voice.calmLabel, color: colors.dim },
  list: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: spacing.s, borderBottomWidth: shape.hairline, borderColor: colors.border },
  rowText: { flex: 1, minWidth: 0 },
  rowDate: { ...voice.calmNumber, color: colors.dim, fontSize: type.xs, ...tabular },
  rowEnding: { ...voice.body, color: colors.text, fontSize: type.s },
  won: { color: colors.goodText },
  rowScore: { ...voice.calmNumber, color: colors.text, fontSize: type.m },
  empty: { ...voice.body, color: colors.dim, fontSize: type.s, lineHeight: 20 },
  note: { ...voice.body, color: colors.dim, fontSize: type.xs, marginTop: spacing.m },
});
