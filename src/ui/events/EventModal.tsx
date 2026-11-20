import { StyleSheet, Text } from 'react-native';

import { canApply, type EventChoiceDef } from '@/engine';

import { Button } from '../components/Button';
import { ModalCard } from '../components/ModalCard';
import { fmtCash, fmtCompact } from '../format';
import { failureText, t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, type } from '../theme';

function costText(choice: EventChoiceDef): string {
  const parts: string[] = [];
  if (choice.cost?.hype) parts.push(`${fmtCompact(choice.cost.hype)} ${t('term.hype')}`);
  if (choice.cost?.cash) parts.push(fmtCash(choice.cost.cash));
  return parts.length ? parts.join(' + ') : t('ui.event.free');
}

/**
 * Placeholder event card host: shows the pending event with its choices, then the
 * result text with Continue. Cannot be dismissed without choosing.
 */
export function EventModal() {
  // While the run is ticking there is nothing to show, so subscribe to the state only when an event is pending or a result is up.
  const state = useGameStore((s) => (s.state && (s.state.pendingEvent || s.eventResult) ? s.state : null));
  const pack = useGameStore((s) => s.pack);
  const dispatch = useGameStore((s) => s.dispatch);
  const result = useGameStore((s) => s.eventResult);
  const dismiss = useGameStore((s) => s.dismissEventResult);

  const pending = state?.pendingEvent && state.pendingEvent.labId === state.playerLabId ? state.pendingEvent : null;
  const event = pending ? pack.events.find((e) => e.id === pending.eventId) : result ? pack.events.find((e) => e.id === result.eventId) : undefined;
  if (!state || !event || (!pending && !result)) return <ModalCard visible={false} />;

  if (pending) {
    return (
      <ModalCard visible title={t(event.titleKey)} tone={event.tone} testID="event-card">
        <Text style={styles.body}>{t(event.bodyKey, { lab: state.playerLabId })}</Text>
        {event.choices.map((choice) => {
          const check = canApply(state, pack, { type: 'resolveEvent', labId: state.playerLabId, choiceId: choice.id });
          const cost = costText(choice);
          return (
            <Button
              key={choice.id}
              label={t(choice.labelKey)}
              variant={check.ok ? 'primary' : 'secondary'}
              disabled={!check.ok}
              sublabel={check.ok ? cost : `${cost} · ${failureText(check.reason)}`}
              onPress={() => dispatch({ type: 'resolveEvent', labId: state.playerLabId, choiceId: choice.id })}
              testID={`event-choice-${choice.id}`}
            />
          );
        })}
      </ModalCard>
    );
  }

  return (
    <ModalCard visible title={t(event.titleKey)} tone={result?.riskFired ? 'bad' : event.tone} testID="event-result">
      {result?.resultKey ? <Text style={styles.body}>{t(result.resultKey, { lab: state.playerLabId })}</Text> : null}
      <Button label={t('ui.event.continue')} variant="primary" onPress={dismiss} testID="event-continue" />
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.text, fontSize: type.m, lineHeight: 22 },
});
