import { useEffect, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';

import type { ContentPack, EventDef, GameState } from '@/engine';

import { fmtDay } from '../format';
import { t } from '../i18n';
import { colors, voice } from '../theme';
import { ChoiceButton } from './ChoiceButton';
import { explainChoice } from './choiceInfo';
import { EventFrame } from './EventFrame';
import { toneHaptic } from './haptics';

export interface EventCardProps {
  event: EventDef;
  /** The state while the event is pending (frozen: the run does not tick). */
  state: GameState;
  pack: ContentPack;
  onChoose: (choiceId: string) => void;
  /** Opens a choice's explanation panel. */
  onInfo?: (choiceId: string) => void;
}

/** The pending event as a tabloid front page. There is no close button: only a choice ends it. */
export function EventCard({ event, state, pack, onChoose, onInfo }: EventCardProps) {
  useEffect(() => {
    toneHaptic(event.tone);
  }, [event.id, event.tone]);

  // Why a choice is locked: its first unmet requirement, else the cost the player cannot pay (canApply decides).
  const reasons = useMemo(() => event.choices.map((choice) => explainChoice(state, pack, choice).blocker), [event, state, pack]);

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
            <ChoiceButton key={choice.id} choice={choice} disabledReason={reasons[i]} onChoose={onChoose} onInfo={onInfo} />
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
  body: { ...voice.body, color: colors.newsInk, fontSize: 15, lineHeight: 21 },
  prompt: { ...voice.loudKicker, color: colors.newsDim, fontSize: 12, letterSpacing: 1.6 },
});
const styles = storyStyles;
