import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';

import { happeningDef, happeningQuote, type HappeningState } from '@/idle';

import { Icon } from '../icons';
import { t } from '../i18n';
import { cased } from '../locale';
import { Text } from '../locale/Text';
import { useAmbientClock, wave } from '../motion/ambient';
import { colors, radius, shape, spacing, voice } from '../theme';
import { garageNow } from './clock';
import { tapHaptic } from './haptics';
import { useGarage } from './hooks';
import { clearSpan, spotPosition, type StageRect } from './LabRoom';
import { useGarageStore, type GarageStore } from './store';
import { fmt, gt } from './text';

const SIZE = 46;
const WRAP = 150;
const sel = (s: GarageStore) => s.state?.happening ?? null;
const key = (h: HappeningState | null) => (h ? h.uid : 0);

/**
 * A lab happening at its spot in the room (the door, a desk, the racks): an icon that
 * wobbles, its label and a timer bar. Tap it for the reward; untouched, it goes by itself
 * (some cost a little, never much).
 */
export const HappeningBubble = memo(function HappeningBubble({ width, height, avoid = null }: { width: number; height: number; avoid?: StageRect | null }) {
  const happening = useGarage(sel, key);
  const reduced = useReducedMotion();
  const clock = useAmbientClock(!reduced && !!happening);
  const life = useSharedValue(1);
  useEffect(() => {
    if (!happening) return;
    const total = Math.max(1, happening.expiresAt - happening.spawnedAt);
    const left = Math.max(0, happening.expiresAt - garageNow());
    life.set(left / total);
    life.set(withTiming(0, { duration: left, easing: Easing.linear }));
  }, [happening, life]);
  const wobble = useAnimatedStyle(() => ({ transform: [{ rotate: `${clock ? 8 * wave(clock.get(), 0.9) : 0}deg` }] }));
  const bar = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, life.get())) * 100}%` }));
  if (!happening || !(width > 0 && height > 0)) return null;
  const { state, content } = useGarageStore.getState();
  const def = happeningDef(content, happening.id);
  if (!def || !state) return null;
  const quote = happeningQuote(state, content);
  const p = spotPosition(def.spot, happening.x, happening.y, width, height);
  // Keep the icon and its label on its side of the model: the label may wrap to two lines to fit.
  const span = clearSpan(p.x, width, avoid);
  const labelW = Math.max(SIZE + 20, Math.min(WRAP, span.hi - span.lo));
  const cx = Math.max(span.lo + SIZE / 2, Math.min(span.hi - SIZE / 2, p.x));
  const left = Math.max(span.lo, Math.min(span.hi - labelW, cx - labelW / 2));
  const top = Math.max(2, Math.min(height - SIZE - 52, p.y - SIZE / 2));
  const risky = quote.penalty > 0;
  const collect = () => {
    const r = useGarageStore.getState().collectHappening();
    if (!r?.ok) return;
    tapHaptic();
    useGarageStore.getState().setFlash(`+${fmt(r.gained ?? 0)}`);
  };
  return (
    <Animated.View entering={reduced ? undefined : ZoomIn.duration(180)} style={[styles.wrap, { left, top, width: labelW }]} pointerEvents="box-none" testID="garage-happening-wrap">
      <Pressable
        onPress={collect}
        hitSlop={8}
        style={{ alignSelf: 'flex-start', marginLeft: cx - left - SIZE / 2 }}
        accessibilityRole="button"
        accessibilityLabel={`${gt(def.labelKey)}. ${risky ? t('ui.garage.happening.risk', { amount: fmt(quote.penalty) }) : t('ui.garage.happening.reward', { amount: fmt(quote.reward) })}`}
        testID="garage-happening"
      >
        <Animated.View style={[styles.bubble, risky && styles.risky, wobble]}>
          <Icon name={def.icon} size={26} color={risky ? colors.newsPaper : colors.newsInk} accent={risky ? colors.newsPaper : colors.newsRed} />
        </Animated.View>
      </Pressable>
      <View style={[styles.label, { maxWidth: labelW }]} pointerEvents="none">
        <Text style={styles.labelText} numberOfLines={2}>
          {cased(styles.labelText, gt(def.labelKey))}
        </Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, risky && styles.fillRisky, bar]} />
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', width: WRAP, alignItems: 'center' },
  bubble: {
    width: SIZE,
    height: SIZE,
    borderRadius: shape.panel === 'ticks' ? radius.none : SIZE / 2,
    backgroundColor: colors.newsPaper,
    borderWidth: 2,
    borderColor: colors.newsInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  risky: { backgroundColor: colors.newsRed, borderColor: colors.newsPaper },
  label: { marginTop: 3, alignItems: 'center', backgroundColor: colors.newsInk, paddingHorizontal: spacing.xs, paddingTop: 1, paddingBottom: 2 },
  labelText: { ...voice.loudKicker, fontSize: 11, lineHeight: 13, color: colors.newsPaper, textAlign: 'center' },
  track: { width: '100%', height: 2, backgroundColor: colors.newsDim, marginTop: 2 },
  fill: { height: '100%', backgroundColor: colors.player },
  fillRisky: { backgroundColor: colors.newsRed },
});
