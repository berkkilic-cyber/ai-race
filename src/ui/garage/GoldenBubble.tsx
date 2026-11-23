import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { type GoldenState } from '@/idle';

import { Icon } from '../icons';
import { t } from '../i18n';
import { cased } from '../locale';
import { Text } from '../locale/Text';
import { useAmbientClock, wave } from '../motion/ambient';
import { colors, radius, shape, spacing, voice } from '../theme';
import { garageNow } from './clock';
import { successHaptic } from './haptics';
import { useGarage } from './hooks';
import { clearSpan, type StageRect } from './LabRoom';
import { useGarageStore, type GarageStore } from './store';
import { fmt, fmtMult, fmtTime, gt } from './text';

const SIZE = 64;
const selGolden = (s: GarageStore) => s.state?.golden ?? null;
const keyGolden = (g: GoldenState | null) => (g ? g.uid : 0);
const WRAP = SIZE + 70;

/**
 * A golden moment: a bright bubble somewhere on the stage for a few seconds, with a ring
 * that runs down. Tapping it grants its reward (a burst of tokens or a frenzy).
 */
export const GoldenBubble = memo(function GoldenBubble({ width, height, avoid = null }: { width: number; height: number; avoid?: StageRect | null }) {
  const golden = useGarage(selGolden, keyGolden);
  const reduced = useReducedMotion();
  const clock = useAmbientClock(!reduced && !!golden);
  const life = useSharedValue(1);
  useEffect(() => {
    if (!golden) return;
    const total = golden.expiresAt - golden.spawnedAt;
    const left = Math.max(0, golden.expiresAt - garageNow());
    life.set(left / total);
    life.set(withTiming(0, { duration: left, easing: Easing.linear }));
  }, [golden, life]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * (clock ? wave(clock.get(), 0.8) : 0) }] }));
  const bar = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, life.get())) * 100}%` }));
  if (!golden || width <= 0 || height <= 0) return null;
  const { content } = useGarageStore.getState();
  const def = content.golden.defs.find((d) => d.id === golden.id);
  if (!def) return null;
  // Like the happenings: stay on the model's side, the label wrapping to fit.
  const px = golden.x * width;
  const span = clearSpan(px, width, avoid);
  const wrapW = Math.max(SIZE + 12, Math.min(WRAP + 30, span.hi - span.lo));
  const cx = Math.max(span.lo + SIZE / 2, Math.min(span.hi - SIZE / 2, px));
  const left = Math.max(span.lo, Math.min(span.hi - wrapW, cx - wrapW / 2));
  const top = Math.min(height - SIZE - 54, Math.max(56, golden.y * height - SIZE / 2));
  const collect = () => {
    const r = useGarageStore.getState().collectGolden();
    if (!r?.ok) return;
    successHaptic();
    const reward = def.reward;
    const text =
      reward.kind === 'burst'
        ? `+${fmt(r.gained ?? 0)}`
        : reward.kind === 'frenzy'
          ? `${t('ui.garage.golden.frenzy', { mult: fmtMult(reward.mult) })} · ${fmtTime(reward.seconds * 1000)}`
          : `${t('ui.garage.golden.tapFrenzy', { mult: fmtMult(reward.mult) })} · ${fmtTime(reward.seconds * 1000)}`;
    useGarageStore.getState().setFlash(text);
  };
  return (
    <View style={[styles.wrap, { left, top, width: wrapW }]} pointerEvents="box-none">
      <Pressable
        onPress={collect}
        accessibilityRole="button"
        accessibilityLabel={t('ui.garage.golden.label', { name: gt(def.labelKey) })}
        testID="garage-golden"
        hitSlop={10}
        style={{ alignSelf: 'flex-start', marginLeft: cx - left - SIZE / 2 }}
      >
        <Animated.View style={[styles.bubble, pulse]}>
          <Icon name={def.icon} size={34} color={colors.newsInk} accent={colors.newsRed} />
        </Animated.View>
      </Pressable>
      <View style={[styles.label, { maxWidth: wrapW }]} pointerEvents="none">
        <Text style={styles.labelText} numberOfLines={2}>
          {cased(styles.labelText, gt(def.labelKey))}
        </Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, bar]} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center' },
  bubble: {
    width: SIZE,
    height: SIZE,
    borderRadius: shape.panel === 'ticks' ? radius.none : SIZE / 2,
    backgroundColor: colors.player,
    borderWidth: 3,
    borderColor: colors.newsPaper,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 0px 18px ${colors.player}`,
  },
  label: { marginTop: spacing.xs, alignItems: 'center', backgroundColor: colors.newsInk, paddingHorizontal: spacing.xs, paddingTop: 1, paddingBottom: 3 },
  labelText: { ...voice.loudKicker, fontSize: 12, lineHeight: 14, color: colors.newsPaper, textAlign: 'center' },
  track: { width: '100%', height: 2, backgroundColor: colors.newsDim, marginTop: 2 },
  fill: { height: '100%', backgroundColor: colors.player },
});

