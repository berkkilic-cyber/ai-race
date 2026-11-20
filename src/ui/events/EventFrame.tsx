import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { NewsTone } from '@/engine';

import { colors, spacing, voice } from '../theme';
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
/** Hard offset shadow of the tabloid sheet. */
const SHADOW = 6;
/** The card arrives tilted and dropping, then settles flat with a small thud. */
const ENTRY_TILT = -5;

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
  const reduced = useReducedMotion();
  const drop = useSharedValue(0);
  const fade = useSharedValue(0);
  const blink = useSharedValue(1);

  useEffect(() => {
    fade.set(withTiming(1, { duration: reduced ? 200 : 140 }));
    if (!reduced) drop.set(withSequence(withTiming(1.05, { duration: 260, easing: Easing.in(Easing.quad) }), withSpring(1, { damping: 9, stiffness: 320 })));
    else drop.set(1);
  }, [drop, fade, reduced]);

  useEffect(() => {
    if (live && !reduced) blink.set(withRepeat(withTiming(0.15, { duration: 520, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [live, reduced, blink]);

  const cardStyle = useAnimatedStyle(() => {
    const v = drop.get();
    return {
      opacity: fade.get(),
      transform: [{ translateY: (1 - v) * -46 }, { rotate: `${(1 - v) * ENTRY_TILT}deg` }, { scale: 1 + (1 - v) * 0.08 }],
    };
  });
  const dotStyle = useAnimatedStyle(() => ({ opacity: blink.get() }));

  const masthead = (
    <View style={styles.masthead}>
      <View style={[styles.stamp, { backgroundColor: STAMP[tone] }]}>
        {live ? <Animated.View style={[styles.liveDot, dotStyle]} /> : null}
        <Text style={styles.stampText} numberOfLines={1}>
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
  const footerView = footer ? <View style={[styles.footer, wide && styles.footerWide]}>{footer}</View> : null;
  const maxHeight = height - MARGIN * 2 - SHADOW;

  if (wide) {
    return (
      <Animated.View style={[styles.sheet, { maxWidth: WIDE_MAX_WIDTH, maxHeight }, cardStyle]} testID={testID}>
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
          <View style={[styles.column, styles.asideColumn]}>
            <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, styles.asideContent]} bounces={false}>
              {aside}
            </ScrollView>
            {footerView}
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.sheet, { maxWidth: NARROW_MAX_WIDTH, maxHeight }, cardStyle]} testID={testID}>
      <View style={styles.head}>
        {masthead}
        {rules}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false}>
        {children}
        {aside}
      </ScrollView>
      {footerView}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.newsPaper,
    borderWidth: 2,
    borderColor: colors.newsInk,
    shadowColor: colors.newsInk,
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
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.s, paddingVertical: 2, transform: [{ rotate: '-2.5deg' }] },
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
