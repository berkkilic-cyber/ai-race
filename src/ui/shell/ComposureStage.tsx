import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  SlideInLeft,
  SlideOutLeft,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { dangerKey, useComposure, useComposureProgress, type ComposureLevel } from '../composure';
import { useMeters } from '../hooks/useGame';
import { t } from '../i18n';
import { colors, spacing, voice } from '../theme';

/** Height of the BREAKING band at composure 3. */
export const BREAKING_BAND_HEIGHT = 26;

/** At composure 3 the band names the danger: "REGULATORS CIRCLING: REGULATION AT 91%". */
function BreakingBand() {
  const { driver } = useComposure();
  const meters = useMeters();
  const meterLabel = t(`term.${driver}`);
  return (
    <Animated.View entering={SlideInLeft.duration(420).easing(Easing.out(Easing.cubic))} exiting={SlideOutLeft.duration(260)} style={styles.band} pointerEvents="none" testID="breaking-band">
      <View style={styles.bandKicker}>
        <Text style={styles.bandKickerText}>{t('ui.composure.breaking')}</Text>
      </View>
      <Text style={styles.bandText} numberOfLines={1}>
        {t('ui.composure.band', { danger: t(dangerKey(driver)), meter: meterLabel, pct: Math.floor(meters[driver]) })}
      </Text>
    </Animated.View>
  );
}

/**
 * The main area with the composure overlays (docs/DESIGN.md): from level 2 a thin alarm
 * frame and a warm tint; at level 3 the frame pulses and the BREAKING band slides in
 * across the top (in the flow, so it never covers a panel's header). Overlays never take touches.
 */
export function ComposureStage({ children }: { children: ReactNode }) {
  const { level } = useComposure();
  const progress = useComposureProgress();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(pulse);
    pulse.set(1);
    if (level === 3 && !reduced) pulse.set(withRepeat(withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [level, reduced, pulse]);

  const tintStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [1, 2, 3], [0, 0.035, 0.055], 'clamp') }));
  const frameStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [1, 2], [0, 1], 'clamp') * pulse.get() }));

  return (
    <View style={styles.stage}>
      {level >= 3 ? <BreakingBand /> : null}
      <View style={styles.main}>
        {children}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint, tintStyle]} />
      </View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frame, frameStyle]} testID="composure-frame" />
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
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  useEffect(() => {
    if (level < 3 || reduced) return;
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
  }, [level, reduced, x, y]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }] }));
}

const styles = StyleSheet.create({
  stage: { flex: 1, overflow: 'hidden' },
  main: { flex: 1 },
  tint: { backgroundColor: colors.alarm },
  frame: { borderWidth: 2, borderColor: colors.alarm },
  band: {
    height: BREAKING_BAND_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.newsRed,
  },
  bandKicker: { backgroundColor: colors.newsInk, justifyContent: 'center', paddingHorizontal: spacing.s },
  bandKickerText: { ...voice.loudKicker, fontSize: 15, lineHeight: 17, color: colors.newsPaper },
  bandText: { ...voice.loudKicker, flex: 1, alignSelf: 'center', fontSize: 15, lineHeight: 17, letterSpacing: 1, color: colors.newsPaper, paddingHorizontal: spacing.s },
});
