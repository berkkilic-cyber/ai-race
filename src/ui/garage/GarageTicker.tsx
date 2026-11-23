import { Fragment, memo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import type { GarageNews } from '@/idle';

import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { useAmbientClock } from '../motion/ambient';
import { crawlGeometry } from '../shell/crawl';
import { colors, layout, spacing, voice } from '../theme';
import { useGarage } from './hooks';
import type { GarageStore } from './store';
import { gt } from './text';

const SPEED = 34;
const EMPTY: GarageNews[] = [];
const selNews = (s: GarageStore) => s.state?.news ?? EMPTY;
const keyNews = (n: GarageNews[]) => n.map((x) => x.uid).join(',');
const TONE: Record<GarageNews['kind'], string> = {
  headline: colors.info,
  launch: colors.good,
  golden: colors.player,
  incident: colors.alarm,
  fixed: colors.good,
  achievement: colors.player,
  stage: colors.player,
  happening: colors.info,
  training: colors.good,
};

/**
 * The Garage's news ticker: the newest headlines crawling on the tabloid band, driven by
 * the shared ambient clock in a worklet (no loop of its own, no React work per frame).
 * Reduced motion or no measurement: the newest headline sits still.
 */
export const GarageTicker = memo(function GarageTicker() {
  const news = useGarage(selNews, keyNews);
  const insets = useInsets();
  const reduced = useReducedMotion();
  const clock = useAmbientClock(!reduced);
  const [box, setBox] = useState(0);
  const [segment, setSegment] = useState(0);
  const items = news.slice(-6).reverse();
  const geo = crawlGeometry(segment, box, !!reduced);
  const track = useAnimatedStyle(() => {
    if (!clock || !geo.crawl || segment <= 0) return { transform: [{ translateX: 0 }] };
    return { transform: [{ translateX: -((clock.get() * SPEED) % segment) }] };
  });
  const onSegment = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setSegment((p) => (Math.abs(p - w) < 0.5 ? p : w));
  };
  const onBox = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBox((p) => (Math.abs(p - w) < 0.5 ? p : w));
  };
  const text = (n: GarageNews) => gt(n.key, n.params);
  const run = (copy: number) => (
    <View key={copy} style={styles.segment} onLayout={copy === 0 ? onSegment : undefined}>
      {items.map((n) => (
        <Fragment key={n.uid}>
          <View style={[styles.mark, { backgroundColor: TONE[n.kind] }]} />
          <Text style={styles.text} numberOfLines={1}>
            {text(n)}
          </Text>
        </Fragment>
      ))}
    </View>
  );
  return (
    <View style={[styles.band, { height: layout.tickerHeight + insets.bottom, paddingBottom: insets.bottom, paddingLeft: insets.left }]} testID="garage-ticker" accessibilityLabel={items[0] ? text(items[0]) : t('ui.ticker.empty')}>
      <View style={styles.kicker}>
        <Text style={styles.kickerText}>{t('ui.ticker.kicker')}</Text>
      </View>
      <View style={[styles.box, { marginRight: insets.right }]} onLayout={onBox}>
        {items.length === 0 ? (
          <Text style={[styles.text, styles.empty]} numberOfLines={1}>
            {t('ui.ticker.empty')}
          </Text>
        ) : null}
        {items.length > 0 && !geo.crawl ? (
          <View style={styles.still}>
            <View style={[styles.mark, { backgroundColor: TONE[items[0].kind] }]} />
            <Text style={[styles.text, styles.stillText]} numberOfLines={1}>
              {text(items[0])}
            </Text>
          </View>
        ) : null}
        {items.length > 0 && !reduced ? (
          <Animated.View style={[styles.track, { width: geo.trackWidth, opacity: geo.crawl ? 1 : 0 }, track]} pointerEvents="none">
            {Array.from({ length: geo.copies }, (_, i) => run(i))}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  band: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: colors.newsInk, overflow: 'hidden' },
  kicker: { justifyContent: 'center', paddingHorizontal: spacing.s, backgroundColor: colors.newsRed, height: layout.tickerHeight },
  kickerText: { ...voice.loudKicker, fontSize: 13, lineHeight: 15, color: colors.newsPaper },
  box: { flex: 1, overflow: 'hidden', height: layout.tickerHeight },
  still: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' },
  stillText: { flexShrink: 1 },
  track: { position: 'absolute', left: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' },
  segment: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  mark: { width: 6, height: 6, marginLeft: spacing.m, marginRight: spacing.s, flexShrink: 0 },
  text: { ...voice.loudBody, fontSize: 14, lineHeight: 17, color: colors.newsPaper, flexShrink: 0 },
  empty: { color: colors.newsDim, marginLeft: spacing.m, alignSelf: 'center', marginTop: 5 },
});
