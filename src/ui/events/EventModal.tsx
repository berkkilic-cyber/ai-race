import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Overlay } from '../components/Overlay';

import { useInsets } from '../hooks/useInsets';
import { useGameStore } from '../store/game';
import { colors, layer, spacing } from '../theme';
import { diffSnapshots, snapshotPlayer, type StatDelta } from './deltas';
import { EventCard } from './EventCard';
import { tapHaptic } from './haptics';
import { ResultView } from './ResultView';

interface Changes {
  eventId: string;
  choiceId: string;
  deltas: StatDelta[];
}

/**
 * Event host, mounted once in the game shell: the pending event card, then the
 * result of the choice with what changed. The run stays paused until Continue.
 * An in-tree overlay above the shell, its sheets and toasts (theme `layer.event`), never a
 * native Modal: on iOS a Modal without a landscape orientation, presented in this
 * landscape-only app, raises an uncaught native exception and the app closes.
 * Android back is swallowed: the card cannot be dismissed without choosing.
 */
export function EventModal() {
  // While the run ticks there is nothing to show: only subscribe to the state while an event is pending.
  const pendingState = useGameStore((s) => (s.state?.pendingEvent && s.state.pendingEvent.labId === s.state.playerLabId ? s.state : null));
  const result = useGameStore((s) => s.eventResult);
  const playerLabId = useGameStore((s) => s.state?.playerLabId ?? null);
  const pack = useGameStore((s) => s.pack);
  const dismiss = useGameStore((s) => s.dismissEventResult);
  const [changes, setChanges] = useState<Changes | null>(null);
  const insets = useInsets();

  const choose = useCallback((choiceId: string) => {
    const store = useGameStore.getState();
    const before = store.state;
    if (!before?.pendingEvent) return;
    const eventId = before.pendingEvent.eventId;
    tapHaptic();
    if (!store.dispatch({ type: 'resolveEvent', labId: before.playerLabId, choiceId }).ok) return;
    const after = useGameStore.getState();
    if (!after.state) return;
    setChanges({ eventId, choiceId, deltas: diffSnapshots(snapshotPlayer(before, after.pack), snapshotPlayer(after.state, after.pack)) });
    // The store only keeps a result when the choice has text; keep the run paused on the result view anyway.
    const last = after.state.lastEventResult;
    if (!after.eventResult && last && after.state.status === 'running') useGameStore.setState({ eventResult: last });
  }, []);

  const onContinue = useCallback(() => {
    setChanges(null);
    dismiss();
  }, [dismiss]);

  const pendingEvent = pendingState?.pendingEvent ? pack.events.find((e) => e.id === pendingState.pendingEvent?.eventId) : undefined;
  const resultEvent = !pendingEvent && result ? pack.events.find((e) => e.id === result.eventId) : undefined;
  const visible = !!pendingEvent || !!resultEvent;

  let content = null;
  if (pendingEvent && pendingState) {
    content = <EventCard key={`card-${pendingEvent.id}`} event={pendingEvent} state={pendingState} pack={pack} onChoose={choose} />;
  } else if (resultEvent && result && playerLabId) {
    const deltas = changes && changes.eventId === result.eventId && changes.choiceId === result.choiceId ? changes.deltas : null;
    content = <ResultView key={`result-${result.eventId}`} event={resultEvent} result={result} playerLabId={playerLabId} deltas={deltas} onContinue={onContinue} />;
  }

  return (
    <Overlay visible={visible} layer={layer.event} testID="event-overlay">
      {/* The scrim covers the whole screen; the card stays inside the safe area (clear of a notch or Dynamic Island). */}
      <Animated.View
        entering={FadeIn.duration(160)}
        style={[
          styles.scrim,
          { paddingTop: insets.top + spacing.l, paddingBottom: insets.bottom + spacing.l, paddingLeft: insets.left + spacing.l, paddingRight: insets.right + spacing.l },
        ]}
      >
        {content}
      </Animated.View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.l },
});
