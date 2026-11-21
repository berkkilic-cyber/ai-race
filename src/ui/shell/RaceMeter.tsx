import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';

import { getLeadRival, getMeters } from '@/engine';

import { useKeyedSelector } from '../hooks/useKeyedSelector';
import { labName, readableLabColor, t } from '../i18n';
import { useAmbientClock, wave } from '../motion/ambient';
import { useShareSampler } from '../race/trend';
import type { GameStore } from '../store/game';
import { colors, radius, shape, spacing, voice } from '../theme';
import { StripLabel } from './StripMeter';

export interface RaceView {
  /** Player's AGI progress, 0..100. */
  you: number;
  /** Leading rival's AGI progress, 0..100 (the composure "rival" meter). */
  rival: number;
  rivalId: string | null;
}

const NONE: RaceView = { you: 0, rival: 0, rivalId: null };

export const selectRace = (s: GameStore): RaceView => {
  const st = s.state;
  if (!st) return NONE;
  const id = st.playerLabId;
  return { you: st.labs[id].agiProgress, rival: getMeters(st, id).rival, rivalId: getLeadRival(st, s.pack, id) ?? null };
};

/** Whole percents are what is shown; the markers cannot show finer. */
const keyRace = (r: RaceView) => `${Math.floor(r.you)}|${Math.floor(r.rival)}|${r.rivalId ?? ''}`;

/** The rival marker pulses above this (the same threshold as the other meters). */
const PULSE_ABOVE = 75;

/**
 * The AGI race as one track with two markers: the player's progress as a filled bar in the
 * player's colour, the leading rival's as a tick in that rival's colour. Labelled "AGI race"
 * with both percentages beside it ("12 vs 34%"), so it reads as a race to 100%, not a count.
 * It is still the "rival" meter of the composure: `tag` replaces the label at level 2+.
 */
export function RaceMeter({ tag, testID }: { tag: string | null; testID?: string }) {
  // The strip is always on screen: it keeps the standings' share trend sampling while the Race tab is hidden.
  useShareSampler();
  const race = useKeyedSelector(selectRace, keyRace);
  const rivalLab = useKeyedSelector(selectRivalLab, keyRivalLab);
  const you = clampPct(race.you);
  const rival = clampPct(race.rival);
  const rivalColor = rivalLab ? readableLabColor(rivalLab) : colors.dim;
  const rivalText = rivalLab ? readableLabColor(rivalLab, 'text') : colors.dim;
  const pulsing = rival > PULSE_ABOVE;
  const clock = useAmbientClock(pulsing);
  const markStyle = useAnimatedStyle(() => ({ opacity: clock ? 1 - 0.6 * wave(clock.get(), 0.9) : 1 }));
  const a11y = rivalLab
    ? t('ui.strip.raceA11y', { you: `${Math.floor(you)}%`, rival: labName(rivalLab), them: `${Math.floor(rival)}%` })
    : t('ui.strip.raceA11yNone', { you: `${Math.floor(you)}%` });

  return (
    <View style={[styles.wrap, tag ? styles.wrapTagged : null]} testID={testID} accessibilityRole="progressbar" accessibilityLabel={tag ? `${a11y}. ${tag}` : a11y}>
      {tag ? (
        <Animated.View entering={FadeIn.duration(260)} style={styles.tag}>
          <Text style={styles.tagText} numberOfLines={1}>
            {tag}
          </Text>
        </Animated.View>
      ) : (
        <StripLabel label={t('ui.strip.race')} shortLabel={t('ui.strip.raceShort')} icon="race" color={colors.player} />
      )}
      <View style={styles.row}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${you}%` }]} testID="race-you" />
          {rivalLab ? <Animated.View style={[styles.mark, { left: `${rival}%`, backgroundColor: rivalColor }, markStyle]} testID="race-rival" /> : null}
        </View>
        <Text style={styles.value} numberOfLines={1}>
          <Text style={styles.you}>{Math.floor(you)}</Text>
          {rivalLab ? <Text style={styles.vs}>{` ${t('ui.strip.vs')} `}</Text> : null}
          {rivalLab ? <Text style={{ color: pulsing ? colors.bad : rivalText }}>{Math.floor(rival)}</Text> : null}
          <Text style={styles.pct}>%</Text>
        </Text>
      </View>
    </View>
  );
}

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

const selectRivalLab = (s: GameStore) => {
  const st = s.state;
  if (!st) return null;
  const id = getLeadRival(st, s.pack, st.playerLabId);
  return id ? st.labs[id] : null;
};
const keyRivalLab = (lab: ReturnType<typeof selectRivalLab>) => (lab ? `${lab.id}|${lab.color}` : '');

/** Wide enough for "100 vs 100%". */
const VALUE_WIDTH = 58;
const TRACK_H = shape.panel === 'plain' ? 4 : shape.panel === 'ticks' ? 5 : 6;

const styles = StyleSheet.create({
  wrap: { flex: 1.35, minWidth: 0, justifyContent: 'center', gap: 3 },
  wrapTagged: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.newsInk, paddingHorizontal: 4, height: 13, justifyContent: 'center', transform: [{ rotate: '-1.5deg' }] },
  tagText: { ...voice.loudKicker, fontSize: 10.5, lineHeight: 12, letterSpacing: 0.8, color: colors.newsPaper },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  track: {
    flex: 1,
    minWidth: 40,
    height: TRACK_H,
    backgroundColor: shape.panel === 'ticks' ? colors.transparent : colors.raised,
    borderWidth: shape.panel === 'ticks' || shape.panel === 'sticker' ? shape.hairline * 0.75 : 0,
    borderColor: colors.outline,
    borderRadius: radius.pill,
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.player, borderRadius: radius.pill },
  // The rival's tick stands out above and below the track.
  mark: { position: 'absolute', top: -4, bottom: -4, width: 3, marginLeft: -1.5, borderWidth: 0.5, borderColor: colors.chrome },
  value: { ...voice.calmNumber, width: VALUE_WIDTH, textAlign: 'right', color: colors.text, fontSize: 12.5, lineHeight: 15 },
  you: { color: colors.playerText },
  vs: { ...voice.calmLabel, fontSize: 8.5, color: colors.dim },
  pct: { color: colors.dim },
});
