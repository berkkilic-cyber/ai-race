import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { bonusMultiplyValue, happeningDef, offerDef, offerStatus, type BonusOfferState } from '@/idle';

import { AdButton } from '../ads';
import { t } from '../i18n';
import { colors, spacing } from '../theme';
import { useAdPlacement } from './adOffer';
import { garageNow } from './clock';
import { successHaptic } from './haptics';
import { useGarage } from './hooks';
import { overlaps, spotPosition, type StageRect } from './LabRoom';
import { useGarageStore, type GarageStore } from './store';
import { fmt } from './text';

const WRAP = 190;
const sel = (s: GarageStore) => s.state?.bonusOffer ?? null;
const key = (b: BonusOfferState | null) => (b ? `${b.until}` : '');

/**
 * After a free bonus tap, some bonuses offer an optional ad that multiplies the reward
 * just collected. It sits where the bonus was for a few seconds, with a bar that runs
 * down, then goes. Shown only when the placement policy picks it (one offer at a time).
 */
export const BonusOffer = memo(function BonusOffer({ width, height, avoid = null }: { width: number; height: number; avoid?: StageRect | null }) {
  const bonus = useGarage(sel, key);
  return bonus ? <BonusOfferBody width={width} height={height} avoid={avoid} /> : null;
});

const BonusOfferBody = memo(function BonusOfferBody({ width, height, avoid }: { width: number; height: number; avoid: StageRect | null }) {
  const bonus = useGarage(sel, key);
  const placement = useAdPlacement();
  const reduced = useReducedMotion();
  const life = useSharedValue(1);
  useEffect(() => {
    if (!bonus) return;
    const left = Math.max(0, bonus.until - garageNow());
    const total = offerDef(useGarageStore.getState().content, 'bonusMultiply')?.multiplyWindowMs ?? left;
    life.set(Math.min(1, left / Math.max(1, total)));
    life.set(withTiming(0, { duration: left, easing: Easing.linear }));
  }, [bonus, life]);
  const bar = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, life.get())) * 100}%` }));
  const { state, content } = useGarageStore.getState();
  if (!bonus || !state || placement !== 'bonusMultiply' || !(width > 0 && height > 0)) return null;
  const def = offerDef(content, 'bonusMultiply');
  const mult = def?.multiplyMult ?? 2;
  // The ad pays the multiplied bonus or the offer's minimum, whichever is more; the label says which.
  const extra = bonusMultiplyValue(state, content);
  const floored = extra > bonus.reward * (mult - 1) * 1.001;
  const spot = bonus.source === 'happening' ? happeningDef(content, bonus.id)?.spot : undefined;
  const p = spot ? spotPosition(spot, bonus.x, bonus.y, width, height) : { x: bonus.x * width, y: bonus.y * height };
  let left = Math.max(2, Math.min(width - WRAP - 2, p.x - WRAP / 2));
  let top = Math.max(2, Math.min(height - 64, p.y - 22));
  // Never over the model: when it does not fit beside it, it takes the stage's offer slot (top right; empty, one offer at a time).
  if (avoid && overlaps({ x: left, y: top, w: WRAP, h: 60 }, { x: avoid.x - 4, y: avoid.y - 4, w: avoid.w + 8, h: avoid.h + 8 })) {
    left = width - WRAP - spacing.s;
    top = spacing.xs;
  }
  return (
    <Animated.View entering={reduced ? undefined : FadeIn.duration(160)} exiting={reduced ? undefined : FadeOut.duration(160)} style={[styles.wrap, { left, top }]} pointerEvents="box-none" testID="garage-bonus-offer">
      <AdButton
        placement="bonusMultiply"
        compact
        variant="primary"
        label={floored ? t('ui.ads.placement.bonusBig') : t('ui.ads.placement.bonusMultiply', { mult })}
        reward={t('ui.ads.reward.bonusMultiply', { amount: fmt(extra) })}
        status={offerStatus(state, content, 'bonusMultiply', garageNow())}
        onRewarded={() => {
          const r = useGarageStore.getState().claim('bonusMultiply');
          if (r?.ok) {
            successHaptic();
            useGarageStore.getState().setFlash(`+${fmt(r.gained ?? 0)}`);
          }
        }}
      />
      <View style={styles.track}>
        <Animated.View style={[styles.fill, bar]} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', width: WRAP, alignItems: 'center', gap: 2 },
  track: { width: '80%', height: 3, backgroundColor: colors.raised, marginTop: spacing.xs / 2 },
  fill: { height: '100%', backgroundColor: colors.player },
});
