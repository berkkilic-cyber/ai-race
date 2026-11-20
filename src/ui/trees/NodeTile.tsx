import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { fmtCash, fmtCompact } from '../format';
import { t } from '../i18n';
import { colors, radius, spacing, tabular, type } from '../theme';
import { CheckGlyph, LockGlyph } from './Glyphs';
import type { TileRect } from './layout';
import type { NodeStatus } from './status';

export interface NodeTileProps {
  nodeId: string;
  name: string;
  status: NodeStatus;
  costHype: number;
  costCash: number;
  accent: string;
  rect: TileRect;
  /** Changes to a new non-zero value to play the purchase highlight. */
  flashKey: number;
  onPress: (nodeId: string) => void;
}

export function priceText(hype: number, cash: number): string {
  const parts = [`${fmtCompact(hype)} ${t('term.hype')}`];
  if (cash > 0) parts.push(fmtCash(cash));
  return parts.join(' + ');
}

function NodeTileImpl({ nodeId, name, status, costHype, costCash, accent, rect, flashKey, onPress }: NodeTileProps) {
  const pulse = useSharedValue(0);
  const flash = useSharedValue(0);
  const buyable = status === 'buyable';

  useEffect(() => {
    if (buyable) {
      pulse.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
    } else {
      cancelAnimation(pulse);
      pulse.set(0);
    }
  }, [buyable, pulse]);

  useEffect(() => {
    if (flashKey === 0) return;
    flash.set(withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) })));
  }, [flashKey, flash]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.15 + pulse.get() * 0.65 }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.get() * 0.9,
    transform: [{ scale: 1 + flash.get() * 0.12 }],
  }));
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + flash.get() * 0.06 }] }));

  const owned = status === 'owned';
  const locked = status === 'locked';
  const fg = owned ? colors.onPlayer : colors.text;
  const costColor = status === 'expensive' ? colors.bad : buyable ? colors.text : colors.dim;
  const price = priceText(costHype, costCash);

  return (
    <Animated.View style={[styles.wrap, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }, bumpStyle]}>
      {buyable ? <Animated.View pointerEvents="none" style={[styles.glow, { borderColor: accent }, glowStyle]} /> : null}
      <Animated.View pointerEvents="none" style={[styles.flash, { backgroundColor: accent }, flashStyle]} />
      <Pressable
        onPress={() => onPress(nodeId)}
        testID={`node-${nodeId}`}
        accessibilityRole="button"
        accessibilityLabel={t('ui.trees.tileLabel', { name, state: t(`ui.trees.state.${status}`), cost: price })}
        style={({ pressed }) => [
          styles.tile,
          owned && { backgroundColor: accent, borderColor: accent },
          buyable && { borderColor: accent, borderWidth: 2 },
          locked && styles.locked,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.name, { color: fg }]} numberOfLines={2}>
          {name}
        </Text>
        {owned ? (
          <Text style={[styles.cost, styles.ownedText]} numberOfLines={1}>
            {t('ui.trees.state.owned')}
          </Text>
        ) : (
          <Text style={[styles.cost, { color: costColor }]} numberOfLines={1}>
            {price}
          </Text>
        )}
      </Pressable>
      {owned ? (
        <View pointerEvents="none" style={[styles.corner, { backgroundColor: colors.onPlayer, borderColor: accent }]}>
          <CheckGlyph color={accent} size={11} />
        </View>
      ) : null}
      {locked ? (
        <View pointerEvents="none" style={[styles.corner, styles.cornerLocked]}>
          <LockGlyph color={colors.dim} size={10} />
        </View>
      ) : null}
    </Animated.View>
  );
}

export const NodeTile = memo(NodeTileImpl);

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  tile: {
    flex: 1,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    paddingHorizontal: spacing.s,
    paddingVertical: 6,
    justifyContent: 'space-between',
  },
  glow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: radius.s + 4, borderWidth: 2 },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.s },
  locked: { opacity: 0.5, backgroundColor: colors.surface },
  pressed: { opacity: 0.75 },
  name: { fontSize: type.xs, fontWeight: '700', lineHeight: 14 },
  corner: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerLocked: { backgroundColor: colors.bg, borderColor: colors.border },
  cost: { fontSize: type.xs, fontWeight: '600', ...tabular },
  ownedText: { color: colors.onPlayer, fontWeight: '800' },
});
