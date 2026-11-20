import { useEffect, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import { canApply, type ContentPack, type EventDef, type GameState } from '@/engine';

import { fmtDay } from '../format';
import { failureText, t } from '../i18n';
import { colors, voice } from '../theme';
import { ChoiceButton } from './ChoiceButton';
import { EventFrame } from './EventFrame';
import { toneHaptic } from './haptics';

export interface EventCardProps {
  event: EventDef;
  /** The state while the event is pending (frozen: the run does not tick). */
  state: GameState;
  pack: ContentPack;
  onChoose: (choiceId: string) => void;
}

/** The pending event as a tabloid front page. There is no close button: only a choice ends it. */
export function EventCard({ event, state, pack, onChoose }: EventCardProps) {
  useEffect(() => {
    toneHaptic(event.tone);
  }, [event.id, event.tone]);

  const reasons = useMemo(
    () =>
      event.choices.map((choice) => {
        const check = canApply(state, pack, { type: 'resolveEvent', labId: state.playerLabId, choiceId: choice.id });
        return check.ok ? null : failureText(check.reason);
      }),
    [event, state, pack],
  );

  return (
    <EventFrame
      tone={event.tone}
      label={t(`ui.events.label.${event.tone}`)}
      meta={fmtDay(state.tick)}
      live
      testID="event-card"
      aside={
        <>
          <Text style={styles.prompt}>{t('ui.events.choose')}</Text>
          {event.choices.map((choice, i) => (
            <ChoiceButton key={choice.id} choice={choice} disabledReason={reasons[i]} onChoose={onChoose} />
          ))}
        </>
      }
    >
      <Text style={styles.title}>{t(event.titleKey)}</Text>
      <Text style={styles.body}>{t(event.bodyKey, { lab: state.playerLabId })}</Text>
    </EventFrame>
  );
}

export const storyStyles = StyleSheet.create({
  title: { ...voice.loudHeadline, color: colors.newsInk, fontSize: 34, lineHeight: 33 },
  body: { color: colors.newsInk, fontSize: 15, lineHeight: 21 },
  prompt: { ...voice.loudKicker, color: colors.newsDim, fontSize: 12, letterSpacing: 1.6 },
});
const styles = storyStyles;
