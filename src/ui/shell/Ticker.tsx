import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { t } from '../i18n';
import { useWide } from '../events/useWide';
import { newsText } from '../news/newsText';
import { useUnreadCount } from '../news/useNews';
import { useGameStore } from '../store/game';
import { colors, radius, spacing, touch, type } from '../theme';

const TONE = { good: colors.good, bad: colors.bad, neutral: colors.info } as const;
/** Marquee speed in points per second, and the pauses before and after scrolling. */
const MARQUEE_SPEED = 45;
const MARQUEE_HOLD_MS = 1200;
/** Wide enough that a headline never wraps while it is measured. */
const TRACK_WIDTH = 4000;
const MAX_BADGE = 99;

/** Latest headline: slides in when it changes, scrolls once if it does not fit; tap opens the News tab. */
export function Ticker() {
  const router = useRouter();
  const item = useGameStore((s) => (s.state && s.state.news.length > 0 ? s.state.news[s.state.news.length - 1] : null));
  const unread = useUnreadCount();
  const wide = useWide();
  const [boxWidth, setBoxWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const enter = useSharedValue(1);
  const offset = useSharedValue(0);

  // Slide the new headline up into place.
  useEffect(() => {
    if (!item) return;
    enter.set(0);
    enter.set(withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
  }, [item, enter]);

  // Scroll once to show the end of a long headline, hold, then return to the start.
  const overflow = Math.max(0, Math.ceil(textWidth - boxWidth));
  useEffect(() => {
    cancelAnimation(offset);
    offset.set(0);
    if (!item || overflow <= 0 || boxWidth === 0) return;
    const duration = (overflow / MARQUEE_SPEED) * 1000;
    offset.set(
      withSequence(
        withDelay(MARQUEE_HOLD_MS, withTiming(-overflow, { duration, easing: Easing.linear })),
        withDelay(MARQUEE_HOLD_MS * 2, withTiming(0, { duration: 400, easing: Easing.inOut(Easing.quad) })),
      ),
    );
  }, [item, overflow, boxWidth, offset]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ translateY: (1 - enter.get()) * 14 }, { translateX: offset.get() }],
  }));

  const text = item ? newsText(item) : '';
  const badge = unread > MAX_BADGE ? `${MAX_BADGE}+` : String(unread);

  return (
    <Pressable
      style={[styles.ticker, wide && styles.tickerWide]}
      onPress={() => router.navigate('/game/news')}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${text}. ${t('ui.news.unread', { count: unread })}` : text}
      testID="ticker"
    >
      <View style={[styles.dot, { backgroundColor: item ? TONE[item.tone] : colors.dim }]} />
      <View style={styles.box} onLayout={(e: LayoutChangeEvent) => setBoxWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.track, textStyle]}>
          <Text style={styles.text} numberOfLines={1} onLayout={(e: LayoutChangeEvent) => setTextWidth(e.nativeEvent.layout.width)} testID="ticker-text">
            {text}
          </Text>
        </Animated.View>
      </View>
      {unread > 0 ? (
        <View style={[styles.badge, wide && styles.badgeWide]} testID="ticker-unread">
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
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  /** Wide: a slim strip along the bottom of the main area; the whole strip is the tap target. */
  tickerWide: { minHeight: 28, height: 28 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  box: { flex: 1, alignSelf: 'stretch', overflow: 'hidden' },
  track: { position: 'absolute', left: 0, top: 0, bottom: 0, width: TRACK_WIDTH, flexDirection: 'row', alignItems: 'center' },
  text: { color: colors.text, fontSize: type.s },
  badge: { minWidth: 22, height: 20, borderRadius: radius.pill, backgroundColor: colors.info, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeWide: { height: 18 },
  badgeText: { color: colors.onPlayer, fontSize: type.xs, fontWeight: '800' },
});
