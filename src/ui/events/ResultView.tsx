import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { EventDef, GameState } from '@/engine';

import { Button } from '../components/Button';
import { t } from '../i18n';
import type { EventResult } from '../store/game';
import { colors, spacing, voice } from '../theme';
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
                <View style={[styles.mark, { backgroundColor: d.good ? colors.newsGood : colors.newsRed }]} />
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {t(DELTA_LABEL_KEYS[d.id])}
                </Text>
                <Text style={[styles.rowValue, { color: d.good ? colors.newsGood : colors.newsRed }]}>{formatDelta(d, t('ui.events.delta.points'))}</Text>
              </View>
            ))}
          </View>
        ) : null
      }
      footer={<Button label={t('ui.events.continue')} variant="ink" onPress={onContinue} testID="event-continue" />}
    >
      <Text style={styles.title}>{t(event.titleKey)}</Text>
      {choice ? <Text style={styles.choice}>{`› ${t(choice.labelKey)}`}</Text> : null}
      <Text style={styles.body}>{result.resultKey ? t(result.resultKey, { lab: playerLabId }) : t('ui.events.result.noText')}</Text>
    </EventFrame>
  );
}

const styles = StyleSheet.create({
  title: { ...voice.loudHeadline, color: colors.newsInk, fontSize: 28, lineHeight: 28 },
  choice: { ...voice.loudKicker, color: colors.newsRed, fontSize: 14, letterSpacing: 0.8 },
  body: { color: colors.newsInk, fontSize: 15, lineHeight: 21 },
  changes: { gap: 0 },
  heading: { ...voice.loudKicker, color: colors.newsInk, fontSize: 12, letterSpacing: 1.6, paddingBottom: spacing.xs, borderBottomWidth: 3, borderColor: colors.newsInk },
  nothing: { color: colors.newsDim, fontSize: 13, paddingTop: spacing.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: 6, borderBottomWidth: 1, borderColor: colors.newsRule },
  mark: { width: 4, height: 14 },
  rowLabel: { flex: 1, color: colors.newsInk, fontSize: 14 },
  rowValue: { ...voice.loudKicker, fontSize: 17, lineHeight: 19, letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
});
