import { useRouter } from 'expo-router';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { NewsItem } from '@/engine';

import { TICKER_SPEED, useComposure, useComposureProgress } from '../composure';
import { useWide } from '../events/useWide';
import { t } from '../i18n';
import { newsText } from '../news/newsText';
import { useUnreadCount } from '../news/useNews';
import { useGameStore } from '../store/game';
import { colors, spacing, touch, voice } from '../theme';

const TONE = { good: colors.good, bad: colors.alarm, neutral: colors.info } as const;
/** Crawl speed at composure 0, in points per second (multiplied per level). */
const BASE_SPEED = 38;
/** Pause before the crawl starts after a new headline arrives. */
const HOLD_MS = 1600;
/** Headlines in the crawl, newest first. */
const RECENT = 6;
const MAX_BADGE = 99;
const EMPTY: readonly NewsItem[] = [];

/**
 * The one loud element of the resting shell: recent headlines crawling in condensed
 * capitals on a tabloid-black band, newest first. A new headline slides in and holds
 * before the crawl resumes. The crawl speeds up with composure (1x to 2.2x), the type
 * gets heavier from level 2, and at level 3 the band turns red. Tap opens the News tab.
 * Reduced motion: no crawl, the newest headline sits still.
 */
export function Ticker() {
  const router = useRouter();
  const news = useGameStore((s) => s.state?.news ?? EMPTY);
  const unread = useUnreadCount();
  const wide = useWide();
  const reduced = useReducedMotion();
  const { level } = useComposure();
  const progress = useComposureProgress();
  const items = useMemo(() => news.slice(-RECENT).reverse(), [news]);
  const latest = items[0] ?? null;
  const [boxWidth, setBoxWidth] = useState(0);
  const [segment, setSegment] = useState(0);
  const enter = useSharedValue(1);
  const offset = useSharedValue(0);
  const speed = BASE_SPEED * TICKER_SPEED[level];

  // A new headline slides up into place and the crawl starts over from it.
  useEffect(() => {
    if (!latest) return;
    enter.set(0);
    enter.set(withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
  }, [latest, enter]);

  useEffect(() => {
    cancelAnimation(offset);
    offset.set(0);
    if (reduced || segment <= 0 || !latest) return;
    const full = (segment / speed) * 1000;
    offset.set(withDelay(HOLD_MS, withRepeat(withSequence(withTiming(-segment, { duration: full, easing: Easing.linear }), withTiming(0, { duration: 0 })), -1)));
  }, [latest, segment, speed, reduced, offset]);

  const trackStyle = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ translateY: (1 - enter.get()) * 12 }, { translateX: offset.get() }],
  }));
  const bandStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [2, 3], [colors.newsInk, colors.newsRed]),
  }));
  const kickerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [2, 3], [colors.newsRed, colors.newsInk]),
  }));

  const loud = level >= 2;
  const copies = segment > 0 && boxWidth > 0 && !reduced ? Math.max(2, Math.ceil(boxWidth / segment) + 1) : 1;
  const latestText = latest ? newsText(latest) : '';
  const badge = unread > MAX_BADGE ? `${MAX_BADGE}+` : String(unread);
  const textStyle = [styles.text, loud && styles.textLoud];

  const run = (copy: number) => (
    <View key={copy} style={styles.segment} onLayout={copy === 0 ? (e: LayoutChangeEvent) => setSegment(e.nativeEvent.layout.width) : undefined}>
      {items.map((item, i) => (
        <Fragment key={`${item.tick}-${item.textKey}-${i}`}>
          <View style={[styles.mark, { backgroundColor: TONE[item.tone] }]} />
          <Text style={textStyle} numberOfLines={1} testID={copy === 0 && i === 0 ? 'ticker-text' : undefined}>
            {newsText(item)}
          </Text>
        </Fragment>
      ))}
    </View>
  );

  return (
    <Pressable
      style={({ pressed }) => [styles.ticker, wide && styles.tickerWide, pressed && styles.pressed]}
      onPress={() => router.navigate('/game/news')}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${latestText}. ${t('ui.news.unread', { count: unread })}` : latestText}
      testID="ticker"
    >
      <Animated.View style={[StyleSheet.absoluteFill, bandStyle]} />
      <Animated.View style={[styles.kicker, kickerStyle]}>
        <Text style={styles.kickerText} numberOfLines={1}>
          {level >= 3 ? t('ui.composure.breaking') : t('ui.ticker.kicker')}
        </Text>
      </Animated.View>
      <View style={styles.box} onLayout={(e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.track, trackStyle]}>{items.length > 0 ? Array.from({ length: copies }, (_, i) => run(i)) : null}</Animated.View>
      </View>
      {unread > 0 ? (
        <View style={styles.badge} testID="ticker-unread">
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Wide enough that a crawl never wraps while it is measured. */
const TRACK_WIDTH = 20000;

const styles = StyleSheet.create({
  ticker: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  /** Wide: a slim strip along the bottom of the main area; the whole strip is the tap target. */
  tickerWide: { minHeight: 28, height: 28 },
  pressed: { opacity: 0.85 },
  kicker: { justifyContent: 'center', paddingHorizontal: spacing.s, minWidth: 48, alignItems: 'center' },
  kickerText: { ...voice.loudKicker, fontSize: 13, lineHeight: 15, color: colors.newsPaper },
  box: { flex: 1, overflow: 'hidden' },
  track: { position: 'absolute', left: 0, top: 0, bottom: 0, width: TRACK_WIDTH, flexDirection: 'row', alignItems: 'center' },
  segment: { flexDirection: 'row', alignItems: 'center' },
  mark: { width: 6, height: 6, marginLeft: spacing.m, marginRight: spacing.s },
  text: { ...voice.loudBody, fontSize: 14, lineHeight: 17, color: colors.newsPaper },
  textLoud: { fontFamily: voice.loudKicker.fontFamily, letterSpacing: 0.7 },
  badge: { alignSelf: 'center', minWidth: 22, height: 18, marginHorizontal: spacing.s, paddingHorizontal: 5, backgroundColor: colors.newsPaper, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...voice.loudKicker, fontSize: 12, lineHeight: 14, letterSpacing: 0.3, color: colors.newsInk },
});
