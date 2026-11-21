import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { getCapabilityLevel } from '@/engine';

import { logLifecycle } from '../diagnostics/log';
import { freshNews } from '../hooks/useRegionFlashes';
import { labName, readableLabColor, t } from '../i18n';
import { Icon } from '../icons';
import { MOVING } from '../map/live/projection';
import { launchHaptic } from '../moments/haptics';
import { useGameStore } from '../store/game';
import { colors, fonts, spacing, voice } from '../theme';
import { BANNER_MS, bannerFor, enqueue, nextBanner, type LaunchBanner } from './queue';

const IN_MS = 360;
const OUT_MS = 300;

export interface BannerHostProps {
  /** Width covered on the right (the side panel, or the zoom buttons in narrow mode). */
  insetRight: number;
}

/**
 * Model launch banners across the top of the map: a tabloid band slides in for about three
 * seconds ("{lab} ships {model}") in the lab's colour, with a second line when a rival is
 * now a tier ahead of the player; the player's own launch gets a celebratory variant.
 * Banners queue and never overlap each other (the BREAKING band sits above the map in the
 * shell's flow, so they never overlap it either). Draws only (pointerEvents none).
 */
export const BannerHost = memo(function BannerHost({ insetRight }: BannerHostProps) {
  const [current, setCurrent] = useState<LaunchBanner | null>(null);
  const queue = useRef<LaunchBanner[]>([]);
  const showing = useRef(false);

  useEffect(() => {
    let id = 1;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pump = () => {
      if (showing.current) return;
      const { show, rest } = nextBanner(queue.current, Date.now());
      queue.current = rest;
      if (!show) return;
      showing.current = true;
      setCurrent(show);
      logLifecycle('banner shown', { lab: show.labId, tier: show.tier, mine: show.mine });
      if (show.mine) launchHaptic();
      timer = setTimeout(() => {
        showing.current = false;
        setCurrent(null);
        // A short gap between two banners.
        timer = setTimeout(pump, 160);
      }, BANNER_MS);
    };
    const unsubscribe = useGameStore.subscribe((s, prev) => {
      if (!s.state || s.state === prev.state) return;
      if (prev.state && prev.state.seed !== s.state.seed) queue.current = [];
      const fresh = freshNews(prev.state, s.state);
      if (fresh.length === 0) return;
      let added = false;
      for (const item of fresh) {
        if (item.kind !== 'launch') continue;
        const playerTier = getCapabilityLevel(s.state, s.pack, s.state.playerLabId);
        const banner = bannerFor(item, s.state, playerTier, id++, Date.now());
        if (!banner) continue;
        queue.current = enqueue(queue.current, banner);
        added = true;
      }
      if (added) pump();
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
      showing.current = false;
    };
  }, []);

  if (!current) return null;
  return <Banner key={current.id} banner={current} insetRight={insetRight} />;
});

function Banner({ banner, insetRight }: { banner: LaunchBanner; insetRight: number }) {
  const reduced = useReducedMotion();
  const k = useSharedValue(0);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    // In, then (a timer, so nothing animates while it holds) out.
    k.set(withTiming(1, { duration: IN_MS, easing: Easing.out(Easing.cubic) }));
    const timer = setTimeout(() => k.set(withTiming(2, { duration: OUT_MS, easing: Easing.in(Easing.cubic) })), BANNER_MS - OUT_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(k);
    };
  }, [k]);
  const slide = reduced ? 0 : 1;
  const style = useAnimatedStyle(() => {
    const v = k.get();
    const x = v <= 1 ? -(1 - v) * width : (v - 1) * width;
    const o = reduced ? (v <= 1 ? v : 2 - v) : 1;
    return { opacity: o, transform: [{ translateX: x * slide }, { rotate: banner.mine ? '-0.8deg' : '0deg' }] };
  });
  const state = useGameStore.getState().state;
  const lab = state?.labs[banner.labId];
  if (!lab) return null;
  const color = readableLabColor(lab);
  const model = banner.modelKey ? t(banner.modelKey) : t('ui.banner.tier', { tier: banner.tier });
  const headline = t('ui.banner.ships', { lab: labName(lab), model });
  const second = banner.mine ? t('ui.banner.mineLine', { tier: banner.tier }) : banner.ahead > 0 ? t(banner.ahead === 1 ? 'ui.banner.ahead' : 'ui.banner.aheadMany', { n: banner.ahead }) : null;
  return (
    <View style={[styles.wrap, { right: insetRight }]} pointerEvents="none" onLayout={(e) => setWidth(Math.max(200, e.nativeEvent.layout.width))}>
      <Animated.View style={[styles.band, { maxWidth: Math.max(200, Math.min(BAND_MAX, width - spacing.m * 2)) }, banner.mine ? styles.bandMine : null, MOVING, style]} testID={banner.mine ? 'launch-banner-mine' : 'launch-banner'}>
        <View style={[styles.block, { backgroundColor: banner.mine ? colors.newsInk : color }]}>
          <Icon name="launch" size={18} color={banner.mine ? colors.player : colors.newsInk} accent={banner.mine ? colors.newsPaper : colors.newsInk} strokeWidth={2.2} />
          <Text style={[styles.tier, { color: banner.mine ? colors.player : colors.newsInk }]}>{t('ui.banner.tierShort', { tier: banner.tier })}</Text>
        </View>
        <View style={styles.texts}>
          <Text style={[styles.kicker, banner.mine ? styles.kickerMine : { color }]} numberOfLines={1}>
            {t(banner.mine ? 'ui.banner.kickerMine' : 'ui.banner.kicker')}
          </Text>
          <Text style={[styles.headline, banner.mine ? styles.headlineMine : null]} numberOfLines={1}>
            {headline}
          </Text>
          {second ? (
            <Text style={[styles.second, banner.mine ? styles.secondMine : styles.secondAhead]} numberOfLines={1}>
              {second}
            </Text>
          ) : null}
        </View>
        <View style={[styles.rule, { backgroundColor: banner.mine ? colors.newsInk : color }]} />
      </Animated.View>
    </View>
  );
}

/** Widest a banner gets; beside the side panel it fits the map part left visible (the headline ellipsizes). */
const BAND_MAX = 500;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, top: spacing.s, alignItems: 'center', overflow: 'hidden', paddingHorizontal: spacing.m },
  band: {
    flexDirection: 'row',
    alignItems: 'stretch',
    maxWidth: BAND_MAX,
    minWidth: 200,
    backgroundColor: colors.newsInk,
    borderWidth: 1.5,
    borderColor: colors.newsPaper,
    boxShadow: `3px 3px 0px ${colors.shadow}`,
  },
  bandMine: { backgroundColor: colors.player, borderColor: colors.newsInk, borderWidth: 2 },
  block: { width: 40, alignItems: 'center', justifyContent: 'center', gap: 1, paddingVertical: 4 },
  tier: { fontFamily: fonts.newsHeavy, fontSize: 13, lineHeight: 14 },
  texts: { flexShrink: 1, paddingHorizontal: spacing.s, paddingVertical: 4, gap: 1, justifyContent: 'center' },
  kicker: { ...voice.loudKicker, fontSize: 11, lineHeight: 12 },
  kickerMine: { color: colors.newsInk },
  headline: { ...voice.loudHeadline, fontSize: 18, lineHeight: 20, color: colors.newsPaper },
  headlineMine: { color: colors.onPlayer },
  second: { ...voice.loudBody, fontSize: 12, lineHeight: 14 },
  secondAhead: { color: colors.newsPaper, backgroundColor: colors.newsRed, alignSelf: 'flex-start', paddingHorizontal: 4, overflow: 'hidden' },
  secondMine: { color: colors.onPlayer },
  rule: { position: 'absolute', left: 0, right: 0, bottom: -4, height: 3 },
});
