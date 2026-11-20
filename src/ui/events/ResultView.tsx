import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { EventDef, GameState } from '@/engine';

import { Button } from '../components/Button';
import { t } from '../i18n';
import type { EventResult } from '../store/game';
import { colors, radius, spacing, tabular, type } from '../theme';
import { DELTA_LABEL_KEYS, formatDelta, type StatDelta } from './deltas';
import { EventFrame } from './EventFrame';
import { toneHaptic } from './haptics';

export interface ResultViewProps {
  event: EventDef;
  result: EventResult;
  playerLabId: GameState['playerLabId'];
  /** Null when the change list is unknown (the choice was made outside this card). */
  deltas: StatDelta[] | null;
  onContinue: () => void;
}

/** Outcome of a choice: the result (or backfire) text, the real changes, and Continue. */
export function ResultView({ event, result, playerLabId, deltas, onContinue }: ResultViewProps) {
  const backfired = result.riskFired === true;
  const tone = backfired ? 'bad' : event.tone;
  useEffect(() => {
    if (backfired) toneHaptic('bad');
  }, [backfired]);

  const choice = event.choices.find((c) => c.id === result.choiceId);
  return (
    <EventFrame
      tone={tone}
      label={t(backfired ? 'ui.events.result.backfired' : 'ui.events.result.label')}
      testID="event-result"
      aside={
        deltas ? (
          <View style={styles.changes} testID="event-deltas">
            <Text style={styles.heading}>{t('ui.events.result.changed')}</Text>
            {deltas.length === 0 ? <Text style={styles.nothing}>{t('ui.events.result.nothing')}</Text> : null}
            {deltas.map((d) => (
              <View key={d.id} style={styles.row}>
                <View style={[styles.mark, { backgroundColor: d.good ? colors.good : colors.bad }]} />
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {t(DELTA_LABEL_KEYS[d.id])}
                </Text>
                <Text style={[styles.rowValue, { color: d.good ? colors.good : colors.bad }]}>{formatDelta(d, t('ui.events.delta.points'))}</Text>
              </View>
            ))}
          </View>
        ) : null
      }
      footer={<Button label={t('ui.events.continue')} variant="primary" onPress={onContinue} testID="event-continue" />}
    >
      <Text style={styles.title}>{t(event.titleKey)}</Text>
      {choice ? <Text style={styles.choice}>{`› ${t(choice.labelKey)}`}</Text> : null}
      <Text style={styles.body}>{result.resultKey ? t(result.resultKey, { lab: playerLabId }) : t('ui.events.result.noText')}</Text>
    </EventFrame>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: type.l, fontWeight: '800' },
  choice: { color: colors.player, fontSize: type.s, fontWeight: '700' },
  body: { color: colors.text, fontSize: type.m, lineHeight: 22 },
  changes: { backgroundColor: colors.bg, borderRadius: radius.s, borderWidth: 1, borderColor: colors.border, padding: spacing.m, gap: spacing.s },
  heading: { color: colors.dim, fontSize: type.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  nothing: { color: colors.dim, fontSize: type.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  mark: { width: 3, height: 14, borderRadius: 2 },
  rowLabel: { flex: 1, color: colors.text, fontSize: type.s },
  rowValue: { fontSize: type.s, fontWeight: '800', ...tabular },
});
