import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';

import type { NewsTone } from '@/engine';

import { colors, radius, spacing, type } from '../theme';
import { TONE_COLOR } from './tone';
import { isWide } from './useWide';

export interface EventFrameProps {
  tone: NewsTone;
  /** Header strip caption, e.g. "Breaking". */
  label: string;
  /** Small text on the right of the strip, e.g. the day. */
  meta?: string;
  /** Pulsing "live" dot in the strip. */
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
const WIDE_MAX_WIDTH = 820;
const NARROW_MAX_WIDTH = 480;

/**
 * The breaking-news card: tone strip, story, then choices; springs in on mount.
 * Wide: two columns (story left, choices right), each scrolling on its own so the
 * choices and the footer always stay on screen.
 */
export function EventFrame({ tone, label, meta, live, children, aside, footer, testID }: EventFrameProps) {
  const { width, height } = useWindowDimensions();
  const wide = isWide(width, height);
  const enter = useSharedValue(0);
  const blink = useSharedValue(1);

  useEffect(() => {
    enter.set(withSpring(1, { damping: 14, stiffness: 160, mass: 0.8 }));
  }, [enter]);

  useEffect(() => {
    if (live) blink.set(withRepeat(withTiming(0.25, { duration: 600, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [live, blink]);

  const cardStyle = useAnimatedStyle(() => {
    const v = enter.get();
    return { opacity: Math.min(1, v * 1.5), transform: [{ translateY: (1 - v) * 60 }, { scale: 0.9 + 0.1 * v }] };
  });
  const dotStyle = useAnimatedStyle(() => ({ opacity: blink.get() }));
  const accent = TONE_COLOR[tone];

  const strip = (
    <View style={[styles.strip, { backgroundColor: accent }]}>
      {live ? <Animated.View style={[styles.liveDot, dotStyle]} /> : null}
      <Text style={styles.label} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
  const footerView = footer ? <View style={[styles.footer, wide && styles.footerWide]}>{footer}</View> : null;
  const maxHeight = height - MARGIN * 2;

  if (wide) {
    return (
      <Animated.View style={[styles.card, { maxWidth: WIDE_MAX_WIDTH, maxHeight }, cardStyle]} testID={testID}>
        <View style={styles.row}>
          <View style={[styles.column, styles.storyColumn]}>
            {strip}
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
    <Animated.View style={[styles.card, { maxWidth: NARROW_MAX_WIDTH, maxHeight }, cardStyle]} testID={testID}>
      {strip}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} bounces={false}>
        {children}
        {aside}
      </ScrollView>
      {footerView}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', flexShrink: 1, minHeight: 0 },
  column: { flexShrink: 1, minHeight: 0 },
  storyColumn: { flex: 1, borderRightWidth: 1, borderColor: colors.border },
  asideColumn: { flex: 1.15, backgroundColor: colors.bg },
  strip: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingHorizontal: spacing.l, paddingVertical: spacing.s },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.onPlayer },
  label: { flex: 1, color: colors.onPlayer, fontSize: type.s, fontWeight: '900', letterSpacing: 1.5 },
  meta: { color: colors.onPlayer, fontSize: type.xs, fontWeight: '700' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { padding: spacing.l, paddingTop: spacing.m, gap: spacing.m },
  asideContent: { padding: spacing.m, gap: spacing.s },
  footer: { paddingHorizontal: spacing.l, paddingBottom: spacing.l, paddingTop: spacing.s },
  footerWide: { paddingHorizontal: spacing.m, paddingBottom: spacing.m },
});
