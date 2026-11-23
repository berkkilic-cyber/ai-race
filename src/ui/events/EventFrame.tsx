import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { NewsTone } from '@/engine';

import { useInsets } from '../hooks/useInsets';
import { Text } from '../locale/Text';
import { useAmbientClock, wave } from '../motion/ambient';
import { useTutorialTarget } from '../tutorial/targets';
import { PanelDeco, Stripes } from '../components/Deco';
import { colors, shape, spacing, voice } from '../theme';
import { isWide } from './useWide';

export interface EventFrameProps {
  tone: NewsTone;
  /** Kicker stamp, e.g. "Breaking". */
  label: string;
  /** Small text on the right of the masthead, e.g. the day. */
  meta?: string;
  /** Blinking "live" square beside the kicker. */
  live?: boolean;
  /** Story: title and body. Left column in wide mode. */
  children?: ReactNode;
  /** Choices or the change list. Right column in wide mode, below the story otherwise. */
  aside?: ReactNode;
  /** Fixed under the aside (e.g. Continue); never scrolls away. */
  footer?: ReactNode;
  testID?: string;
}

/** Outer margin of the card inside the scrim. */
const MARGIN = spacing.l;
const WIDE_MAX_WIDTH = 800;
const NARROW_MAX_WIDTH = 480;
/** Hard offset shadow of the tabloid sheet (heavier on the sticker theme, where it must jar). */
const SHADOW = shape.panel === 'sticker' ? 9 : 6;
/** Blueprint casts the printout's shadow onto the drawing in deep blue; elsewhere ink. */
const SHADOW_COLOR = shape.panel === 'ticks' ? colors.shadow : colors.newsInk;
/** The card arrives tilted and dropping, then settles (flat, or slightly askew on candy) with a small thud. */
const ENTRY_TILT = -5;
const REST_TILT = shape.panel === 'sticker' ? -1.4 : 0;
/** Outlined rubber stamp (blueprint) or a solid block. */
const OUTLINE_STAMP = shape.stamp === 'outline';

/** Kicker stamp colours: bad news is red, good and developing stories are ink. */
const STAMP: Record<NewsTone, string> = { bad: colors.newsRed, good: colors.newsInk, neutral: colors.newsInk };

/**
 * The world speaking: a tabloid front page. White newsprint, hard edges and a hard
 * offset shadow, a rotated kicker stamp over a heavy rule, condensed headline. It drops
 * in tilted and settles (a plain fade with reduced motion).
 * Wide: two columns (story left, choices right), each scrolling on its own so the
 * choices and the footer always stay on screen.
 */
export function EventFrame({ tone, label, meta, live, children, aside, footer, testID }: EventFrameProps) {
  const { width, height } = useWindowDimensions();
  const wide = isWide(width, height);
  const insets = useInsets();
  const reduced = useReducedMotion();
  const drop = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.set(withTiming(1, { duration: reduced ? 200 : 140 }));
    if (!reduced) drop.set(withSequence(withTiming(1.05, { duration: 260, easing: Easing.in(Easing.quad) }), withSpring(1, { damping: 9, stiffness: 320 })));
    else drop.set(1);
  }, [drop, fade, reduced]);

  // The live dot blinks on the shell's shared ambient clock.
  const clock = useAmbientClock(!!live);
  // The tutorial points at the choices when it explains the first card.
  const choicesRef = useTutorialTarget(live ? 'event.choices' : null);

  const cardStyle = useAnimatedStyle(() => {
    const v = drop.get();
    return {
      opacity: fade.get(),
      transform: [{ translateY: (1 - v) * -46 }, { rotate: `${(1 - v) * ENTRY_TILT + REST_TILT}deg` }, { scale: 1 + (1 - v) * 0.08 }],
    };
  });
  const dotStyle = useAnimatedStyle(() => ({ opacity: clock ? 1 - 0.85 * wave(clock.get(), 1.04) : 1 }));

  const masthead = (
    <View style={styles.masthead}>
      <View style={[styles.stamp, OUTLINE_STAMP ? { borderColor: STAMP[tone], borderWidth: 2.5 } : { backgroundColor: STAMP[tone] }]}>
        {live ? <Animated.View style={[styles.liveDot, OUTLINE_STAMP && { backgroundColor: STAMP[tone] }, dotStyle]} /> : null}
        <Text style={[styles.stampText, OUTLINE_STAMP && { color: STAMP[tone] }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
  const rules = (
    <View>
      <View style={styles.ruleHeavy} />
      <View style={styles.ruleThin} />
    </View>
  );
  // Hazard: the bulletin arrives under a band of warning tape. Blueprint: crop marks; hazard: clipped corners.
  const tape = shape.composure === 'tape' ? <Stripes height={9} stripe={9} a={colors.stripeA} b={colors.newsInk} /> : null;
  const deco = shape.panel === 'ticks' || shape.panel === 'clip' ? <PanelDeco ground={colors.bg} color={shape.panel === 'ticks' ? colors.newsPaper : colors.newsInk} edgeWidth={2} clip={14} /> : null;
  const footerView = footer ? <View style={[styles.footer, wide && styles.footerWide]}>{footer}</View> : null;
  const maxHeight = Math.max(0, height - insets.top - insets.bottom - MARGIN * 2 - SHADOW);

  if (wide) {
    return (
      <Animated.View style={[styles.sheet, { maxWidth: WIDE_MAX_WIDTH, maxHeight }, cardStyle]} testID={testID}>
        {tape}
        <View style={styles.row}>
          <View style={[styles.column, styles.storyColumn]}>
            <View style={styles.head}>
              {masthead}
              {rules}
            </View>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false}>
              {children}
            </ScrollView>
          </View>
          <View style={[styles.column, styles.asideColumn]} ref={choicesRef}>
            <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, styles.asideContent]} bounces={false}>
              {aside}
            </ScrollView>
            {footerView}
          </View>
        </View>
        {deco}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.sheet, { maxWidth: NARROW_MAX_WIDTH, maxHeight }, cardStyle]} testID={testID} ref={choicesRef}>
      {tape}
      <View style={styles.head}>
        {masthead}
        {rules}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false}>
        {children}
        {aside}
      </ScrollView>
      {footerView}
      {deco}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.newsPaper,
    borderWidth: shape.panel === 'clip' || shape.panel === 'sticker' ? 3 : 2,
    borderColor: colors.newsInk,
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: SHADOW, height: SHADOW },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 12,
  },
  row: { flexDirection: 'row', flexShrink: 1, minHeight: 0 },
  column: { flexShrink: 1, minHeight: 0 },
  storyColumn: { flex: 1.05, borderRightWidth: 1, borderColor: colors.newsInk },
  asideColumn: { flex: 1 },
  head: { paddingHorizontal: spacing.l, paddingTop: spacing.m },
  masthead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.s },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.s, paddingVertical: 2, transform: [{ rotate: OUTLINE_STAMP ? '-4deg' : '-2.5deg' }] },
  liveDot: { width: 7, height: 7, backgroundColor: colors.newsPaper },
  stampText: { ...voice.loudKicker, fontSize: 17, lineHeight: 20, letterSpacing: 2, color: colors.newsPaper },
  meta: { ...voice.loudKicker, fontSize: 12, letterSpacing: 1.2, color: colors.newsDim },
  ruleHeavy: { height: 4, backgroundColor: colors.newsInk },
  ruleThin: { height: 1, marginTop: 2, backgroundColor: colors.newsInk },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: spacing.l, paddingTop: spacing.m, gap: spacing.m },
  asideContent: { padding: spacing.m, paddingTop: spacing.m, gap: spacing.s },
  footer: { paddingHorizontal: spacing.l, paddingBottom: spacing.l, paddingTop: spacing.s },
  footerWide: { paddingHorizontal: spacing.m, paddingBottom: spacing.m },
});
