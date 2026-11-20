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
import { useInsets } from '../hooks/useInsets';
import { useAmbientRunning } from '../motion/ambient';
import { useTutorialTarget } from '../tutorial/targets';
import { t } from '../i18n';
import { newsText } from '../news/newsText';
import { useUnreadCount } from '../news/useNews';
import { useGameStore } from '../store/game';
import { crawlGeometry } from './crawl';
import { colors, layout, spacing, touch, voice } from '../theme';

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
 *
 * Native-safe: the crawl track has an explicit width (MEASURE_WIDTH until the run is
 * measured, then copies x run width), each headline is a single-line Text with explicit
 * colour and line height that never shrinks, and the run is measured with onLayout (which
 * fires again when fonts load or text changes). Until a usable measurement arrives (first
 * frame, text not laid out, measurement failed) the crawl stays hidden and the newest
 * headline is shown statically, truncated. Opacity is animated on the viewport-sized box,
 * never on the wide track (iOS renders group opacity off screen, and a track several
 * thousand points wide is past the texture limit). In wide mode the band reaches the
 * bottom edge and the text sits above the bottom inset.
 */
export function Ticker() {
  const router = useRouter();
  const news = useGameStore((s) => s.state?.news ?? EMPTY);
  const unread = useUnreadCount();
  const wide = useWide();
  const insets = useInsets();
  const reduced = useReducedMotion();
  // The crawl holds still while ambient motion is stopped (paused, background, run over).
  const moving = useAmbientRunning() !== false;
  const tutorialRef = useTutorialTarget('shell.ticker');
  const { level } = useComposure();
  const progress = useComposureProgress();
  const items = useMemo(() => news.slice(-RECENT).reverse(), [news]);
  const latest = items[0] ?? null;
  const [boxWidth, setBoxWidth] = useState(0);
  const [segment, setSegment] = useState(0);
  const enter = useSharedValue(1);
  const offset = useSharedValue(0);
  const speed = BASE_SPEED * TICKER_SPEED[level];
  const geo = crawlGeometry(segment, boxWidth, !!reduced);

  // A new headline slides up into place and the crawl starts over from it.
  useEffect(() => {
    if (!latest) return;
    enter.set(0);
    enter.set(withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
  }, [latest, enter]);

  useEffect(() => {
    if (!moving) {
      cancelAnimation(offset);
      return;
    }
    cancelAnimation(offset);
    offset.set(0);
    if (!geo.crawl || !latest) return;
    const full = (segment / speed) * 1000;
    offset.set(withDelay(HOLD_MS, withRepeat(withSequence(withTiming(-segment, { duration: full, easing: Easing.linear }), withTiming(0, { duration: 0 })), -1)));
    return () => cancelAnimation(offset);
  }, [latest, segment, speed, geo.crawl, offset, moving]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ translateY: (1 - enter.get()) * 12 }],
  }));
  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const bandStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [2, 3], [colors.newsInk, colors.newsRed]),
  }));
  const kickerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), [2, 3], [colors.newsRed, colors.newsInk]),
  }));

  const loud = level >= 2;
  const latestText = latest ? newsText(latest) : '';
  const badge = unread > MAX_BADGE ? `${MAX_BADGE}+` : String(unread);
  const textStyle = [styles.text, loud && styles.textLoud];
  const onSegmentLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setSegment((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
  };
  const onBoxLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBoxWidth((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
  };

  const run = (copy: number) => (
    <View key={copy} style={styles.segment} onLayout={copy === 0 ? onSegmentLayout : undefined}>
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

  const bottomPad = wide ? Math.max(0, insets.bottom) : 0;
  return (
    <Pressable
      ref={tutorialRef}
      style={({ pressed }) => [styles.ticker, wide && { minHeight: layout.tickerHeight, height: layout.tickerHeight + bottomPad, paddingBottom: bottomPad }, pressed && styles.pressed]}
      onPress={() => router.navigate('/game/news')}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${latestText}. ${t('ui.news.unread', { count: unread })}` : latestText || t('ui.ticker.empty')}
      testID="ticker"
    >
      <Animated.View style={[StyleSheet.absoluteFill, bandStyle]} />
      <Animated.View style={[styles.kicker, kickerStyle]}>
        <Text style={styles.kickerText} numberOfLines={1}>
          {level >= 3 ? t('ui.composure.breaking') : t('ui.ticker.kicker')}
        </Text>
      </Animated.View>
      <View style={styles.box} onLayout={onBoxLayout}>
        <Animated.View style={[StyleSheet.absoluteFill, enterStyle]}>
          {latest && !geo.crawl ? (
            <View style={styles.still} testID="ticker-still">
              <View style={[styles.mark, { backgroundColor: TONE[latest.tone] }]} />
              <Text style={[textStyle, styles.stillText]} numberOfLines={1} ellipsizeMode="tail">
                {latestText}
              </Text>
            </View>
          ) : null}
          {!latest ? (
            <View style={styles.still}>
              <Text style={[styles.text, styles.empty, styles.stillText]} numberOfLines={1} ellipsizeMode="tail">
                {t('ui.ticker.empty')}
              </Text>
            </View>
          ) : null}
          {items.length > 0 && !reduced ? (
            <Animated.View style={[styles.track, { width: geo.trackWidth, opacity: geo.crawl ? 1 : 0 }, trackStyle]} pointerEvents="none">
              {Array.from({ length: geo.copies }, (_, i) => run(i))}
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
      {unread > 0 ? (
        <View style={styles.badge} testID="ticker-unread">
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ticker: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  pressed: { opacity: 0.85 },
  kicker: { justifyContent: 'center', paddingHorizontal: spacing.s, minWidth: 48, alignItems: 'center' },
  kickerText: { ...voice.loudKicker, fontSize: 13, lineHeight: 15, color: colors.newsPaper, includeFontPadding: false },
  box: { flex: 1, overflow: 'hidden' },
  still: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', paddingRight: spacing.s },
  stillText: { flexShrink: 1 },
  empty: { color: colors.newsDim, marginLeft: spacing.m },
  track: { position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' },
  segment: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  mark: { width: 6, height: 6, marginLeft: spacing.m, marginRight: spacing.s, flexShrink: 0 },
  text: { ...voice.loudBody, fontSize: 14, lineHeight: 17, color: colors.newsPaper, flexShrink: 0, includeFontPadding: false },
  textLoud: { fontFamily: voice.loudKicker.fontFamily, letterSpacing: 0.7 },
  badge: { alignSelf: 'center', minWidth: 22, height: 18, marginHorizontal: spacing.s, paddingHorizontal: 5, backgroundColor: colors.newsPaper, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...voice.loudKicker, fontSize: 12, lineHeight: 14, letterSpacing: 0.3, color: colors.newsInk, includeFontPadding: false },
});
