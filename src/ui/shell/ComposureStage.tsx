import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { Easing, FadeIn, SlideInLeft, SlideOutLeft, ZoomIn, interpolate, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { dangerKey, useComposure, useComposureProgress, type ComposureLevel } from '../composure';
import { useMeters } from '../hooks/useGame';
import { t } from '../i18n';
import { useAmbientClock, useAmbientRunning, wave } from '../motion/ambient';
import { mixColor } from '../color';
import { Ground, Stamp, Stripes } from '../components/Deco';
import { colors, motion, radius, shape, spacing, type, voice } from '../theme';

/** Height of the BREAKING band at composure 3. */
export const BREAKING_BAND_HEIGHT = 26;

/** At composure 3 the band names the danger: "REGULATORS CIRCLING: REGULATION AT 91%". */
function BreakingBand() {
  const { driver } = useComposure();
  const meters = useMeters();
  const meterLabel = t(`term.${driver}`);
  const taped = shape.composure === 'tape';
  return (
    <Animated.View entering={SlideInLeft.duration(420).easing(Easing.out(Easing.cubic))} exiting={SlideOutLeft.duration(260)} style={styles.band} pointerEvents="none" testID="breaking-band">
      {taped ? <Stripes height={BREAKING_BAND_HEIGHT} style={styles.bandTape} a={colors.stripeA} b={colors.newsInk} /> : null}
      <View style={styles.bandKicker}>
        <Text style={styles.bandKickerText}>{t('ui.composure.breaking')}</Text>
      </View>
      <Text style={styles.bandText} numberOfLines={1}>
        {t('ui.composure.band', { danger: t(dangerKey(driver)), meter: meterLabel, pct: Math.floor(meters[driver]) })}
      </Text>
      {taped ? <Stripes height={BREAKING_BAND_HEIGHT} style={styles.bandTape} a={colors.stripeA} b={colors.newsInk} /> : null}
    </Animated.View>
  );
}

/** Tint strength per composure level (1, 2, 3): blueprint floods red at the end. */
const TINT: Record<typeof shape.composure, [number, number, number]> = {
  classic: [0, 0.035, 0.055],
  redline: [0, 0.06, 0.55],
  tape: [0, 0.04, 0.07],
  drain: [0, 0, 0.04],
};

/** Scallop radius of the revision cloud, and its inset from the edge. */
const CLOUD_R = 11;
const CLOUD_INSET = 14;

/** One side of a revision cloud from (x0, y0) to (x1, y1) as outward-bulging arcs (traversed clockwise). */
function cloudSide(x0: number, y0: number, x1: number, y1: number): string {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.round(len / (CLOUD_R * 2)));
  let d = '';
  for (let i = 1; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    d += `A${CLOUD_R} ${CLOUD_R} 0 0 0 ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

/**
 * A drafting revision cloud (the scalloped outline that marks a change on a drawing) in red
 * pencil around the main area.
 */
function RevisionCloud({ weight }: { weight: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: width, h: height }));
  };
  const a = CLOUD_INSET;
  const r = size.w - CLOUD_INSET;
  const b = size.h - CLOUD_INSET;
  const d = size.w > 60 && size.h > 60 ? `M${a} ${a}${cloudSide(a, a, r, a)}${cloudSide(r, a, r, b)}${cloudSide(r, b, a, b)}${cloudSide(a, b, a, a)}Z` : '';
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {d ? (
        <Svg width={size.w} height={size.h}>
          <Path d={d} fill="none" stroke={colors.mark} strokeWidth={weight} strokeLinejoin="round" opacity={0.9} />
        </Svg>
      ) : null}
    </View>
  );
}

/** Blueprint: red-pencil corrections on the drawing, then the rejection stamp. */
function Redline({ level }: { level: ComposureLevel }) {
  if (level < 2) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(motion.composure)} style={styles.reviseWrap}>
        <Stamp text={t('ui.composure.stamp.revise')} color={colors.mark} outline rotate={-7} size={16} />
      </Animated.View>
      <Animated.View entering={FadeIn.duration(motion.composure)} style={StyleSheet.absoluteFill}>
        <RevisionCloud weight={level >= 3 ? 2.6 : 1.6} />
      </Animated.View>
      {level >= 3 ? (
        <Animated.View entering={ZoomIn.duration(motion.slow)} style={styles.rejectedWrap}>
          <Stamp text={t('ui.composure.stamp.rejected')} color={colors.mark} outline rotate={-11} size={30} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Hazard: the frame turns into warning tape (thicker at level 3) and red beacons light up. */
function Tape({ level, clock }: { level: ComposureLevel; clock: ReturnType<typeof useAmbientClock> }) {
  const beacon = useAnimatedStyle(() => ({ opacity: clock ? 0.25 + 0.75 * wave(clock.get(), 0.7) : 1 }));
  if (level < 2) return null;
  const w = level >= 3 ? 9 : 5;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Stripes height={w} stripe={w * 1.3} style={[styles.tapeH, { top: 0 }]} />
      <Stripes height={w} stripe={w * 1.3} style={[styles.tapeH, { bottom: 0 }]} flip />
      <View style={[styles.tapeV, { left: 0, width: w }]} />
      <View style={[styles.tapeV, { right: 0, width: w }]} />
      {level >= 3 ? (
        <>
          <Animated.View style={[styles.beacon, { left: w + 8 }, beacon]}>
            <View style={styles.beaconCore} />
          </Animated.View>
          <Animated.View style={[styles.beacon, { right: w + 8 }, beacon]}>
            <View style={styles.beaconCore} />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

/** Candy: the cheerful sticker on the corner of the screen tilts, then peels and greys. */
function PeelingSticker({ level }: { level: ComposureLevel }) {
  if (level < 1) return null;
  const peel = level >= 3;
  const tilt = level >= 3 ? 14 : level >= 2 ? 8 : 3;
  return (
    <Animated.View entering={FadeIn.duration(motion.composure)} pointerEvents="none" style={[styles.sticker, peel && styles.stickerPeeled, { transform: [{ rotate: `${tilt}deg` }, { translateY: peel ? 3 : 0 }] }]}>
      <Text style={[styles.stickerText, peel && styles.stickerTextPeeled]} numberOfLines={1}>
        {t(level >= 2 ? 'ui.composure.sticker.fineQuestion' : 'ui.composure.sticker.fine')}
      </Text>
      {peel ? <View style={styles.curl} /> : null}
    </Animated.View>
  );
}

const DRAIN_STEPS = [colors.bg, mixColor(colors.bg, colors.drain, 0.3), mixColor(colors.bg, colors.drain, 0.7), colors.drain];

/**
 * The main area with the composure overlays (docs/DESIGN.md), drawn the theme's way
 * (shape.composure): classic (thin alarm frame and a warm tint), redline (blueprint: red
 * correction marks and stamps, then a red flood), tape (hazard: warning-tape frame and
 * beacons), drain (candy: the pastel ground drains to grey and the sticker peels). At level 3
 * the BREAKING band slides in across the top (in the flow, so it never covers a panel's
 * header). The theme's ground (drafting grid, dots) sits behind the content. Overlays never
 * take touches.
 */
export function ComposureStage({ children }: { children: ReactNode }) {
  const { level } = useComposure();
  const progress = useComposureProgress();
  // At level 3 the frame pulses on the shell's shared ambient clock.
  const clock = useAmbientClock(level === 3);
  const tint = TINT[shape.composure];
  const classic = shape.composure === 'classic';

  const groundStyle = useAnimatedStyle(() => ({ backgroundColor: shape.composure === 'drain' ? interpolateColor(progress.get(), [0, 1, 2, 3], DRAIN_STEPS) : colors.bg }));
  const tintStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [1, 2, 3], tint, 'clamp') }));
  const frameStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [1, 2], [0, 1], 'clamp') * (clock ? 1 - 0.7 * wave(clock.get(), 1.4) : 1) }));

  return (
    <View style={styles.stage}>
      {level >= 3 ? <BreakingBand /> : null}
      <Animated.View style={[styles.main, groundStyle]}>
        <Ground />
        {children}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, tintStyle]} />
        {shape.composure === 'redline' ? <Redline level={level} /> : null}
        {shape.composure === 'drain' ? <PeelingSticker level={level} /> : null}
        {shape.composure === 'tape' ? <Tape level={level} clock={clock} /> : null}
      </Animated.View>
      {classic || (shape.composure === 'redline' && level >= 3) ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frame, frameStyle]} testID="composure-frame" /> : null}
    </View>
  );
}

/** Pixel offsets of one tremble: small, quick, settling at rest. */
const TREMBLE_X = [1.5, -1.5, 1, -1, 0.5, 0];
const TREMBLE_Y = [0.5, -0.5, 0.5, 0, 0, 0];
const TREMBLE_STEP_MS = 40;

/**
 * At composure 3 the whole shell trembles by 1 to 2 px every few seconds (never
 * continuously); off with reduced motion. Returns an animated style for the shell.
 */
export function useTremble(level: ComposureLevel) {
  const reduced = useReducedMotion();
  // Only while ambient motion runs (not paused, app in the foreground).
  const running = useAmbientRunning() !== false;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  useEffect(() => {
    if (level < 3 || reduced || !running) return;
    let timer: ReturnType<typeof setTimeout>;
    const shake = () => {
      x.set(withSequence(...TREMBLE_X.map((v) => withTiming(v, { duration: TREMBLE_STEP_MS }))));
      y.set(withSequence(...TREMBLE_Y.map((v) => withTiming(v, { duration: TREMBLE_STEP_MS }))));
      timer = setTimeout(shake, 3200 + Math.random() * 2600);
    };
    timer = setTimeout(shake, 900);
    return () => {
      clearTimeout(timer);
      x.set(0);
      y.set(0);
    };
  }, [level, reduced, running, x, y]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }] }));
}

const styles = StyleSheet.create({
  stage: { flex: 1, overflow: 'hidden' },
  main: { flex: 1 },
  tint: { backgroundColor: shape.composure === 'redline' ? colors.drain : colors.alarm },
  frame: { borderWidth: shape.composure === 'redline' ? 3 : 2, borderColor: colors.alarm },
  band: {
    height: BREAKING_BAND_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.newsRed,
  },
  bandTape: { width: 34 },
  bandKicker: { backgroundColor: colors.newsInk, justifyContent: 'center', paddingHorizontal: spacing.s },
  bandKickerText: { ...voice.loudKicker, fontSize: 15, lineHeight: 17, color: colors.newsPaper },
  bandText: { ...voice.loudKicker, flex: 1, alignSelf: 'center', fontSize: 15, lineHeight: 17, letterSpacing: 1, color: colors.newsPaper, paddingHorizontal: spacing.s },
  reviseWrap: { position: 'absolute', top: spacing.l + 4, right: spacing.xl },
  rejectedWrap: { position: 'absolute', right: spacing.xl + 8, bottom: spacing.xl + 4 },
  tapeH: { position: 'absolute', left: 0, right: 0 },
  tapeV: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.stripeA },
  beacon: { position: 'absolute', top: 14, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.alarm, opacity: 0.4, alignItems: 'center', justifyContent: 'center', boxShadow: `0px 0px 14px ${colors.alarm}` },
  beaconCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.newsPaper },
  sticker: {
    position: 'absolute',
    top: spacing.m,
    right: spacing.l,
    paddingHorizontal: spacing.m,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.amber,
    borderWidth: shape.outline,
    borderColor: colors.outline,
    boxShadow: `${shape.shadow}px ${shape.shadow}px 0px ${colors.shadow}`,
  },
  stickerPeeled: { backgroundColor: colors.drain, boxShadow: `${shape.shadow + 3}px ${shape.shadow + 4}px 0px ${colors.scrimLight}` },
  stickerText: { ...voice.calmHeading, fontSize: type.m, color: colors.text },
  stickerTextPeeled: { color: colors.dim },
  curl: { position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, backgroundColor: colors.bg, borderTopLeftRadius: 16, borderLeftWidth: shape.outline, borderTopWidth: shape.outline, borderColor: colors.outline },
});
