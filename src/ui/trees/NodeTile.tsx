import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { mixColor } from '../color';
import { fmtCash, fmtCompact } from '../format';
import { t } from '../i18n';
import { Icon } from '../icons';
import { useAmbientClock, wave } from '../motion/ambient';
import { useTutorialTarget } from '../tutorial/targets';
import { PanelDeco } from '../components/Deco';
import { colors, flatShadow, glow, radius, shape, spacing, tabular, type, voice } from '../theme';
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
  /** Model nodes: compute the tier needs to run, as shown. */
  computeNeed?: string;
  /** The player has less compute than `computeNeed`. */
  computeShort?: boolean;
  /** The player's compute as shown (for the accessibility label). */
  computeHave?: string;
}

export function priceText(hype: number, cash: number): string {
  const parts = [`${fmtCompact(hype)} ${t('term.hype')}`];
  if (cash > 0) parts.push(fmtCash(cash));
  return parts.join(' + ');
}

function NodeTileImpl({ nodeId, name, status, costHype, costCash, accent, rect, flashKey, onPress, computeNeed, computeShort = false, computeHave = '0' }: NodeTileProps) {
  const flash = useSharedValue(0);
  const buyable = status === 'buyable';
  // The glow breathes on the shell's shared ambient clock (still off screen, paused or with reduced motion).
  const clock = useAmbientClock(buyable);
  const tutorialRef = useTutorialTarget(`node:${nodeId}`);

  useEffect(() => {
    if (flashKey === 0) return;
    flash.set(withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) })));
  }, [flashKey, flash]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.15 + (clock ? wave(clock.get(), 1.8) : 0.5) * 0.65 }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.get() * 0.9,
    transform: [{ scale: 1 + flash.get() * 0.12 }],
  }));
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + flash.get() * 0.06 }] }));

  const owned = status === 'owned';
  const locked = status === 'locked';
  // Schematic and module tiles stay linework: owned ones are tinted, not filled, and keep light type.
  const ownedFg = LINEWORK ? colors.text : colors.onPlayer;
  const fg = owned ? ownedFg : colors.text;
  const costColor = status === 'expensive' ? colors.bad : buyable ? colors.text : colors.dim;
  const price = priceText(costHype, costCash);

  return (
    <Animated.View style={[styles.wrap, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }, bumpStyle]} ref={tutorialRef}>
      {buyable ? <Animated.View pointerEvents="none" style={[styles.glow, { borderColor: accent }, glowStyle]} /> : null}
      <Animated.View pointerEvents="none" style={[styles.flash, { backgroundColor: accent }, flashStyle]} />
      <Pressable
        onPress={() => onPress(nodeId)}
        testID={`node-${nodeId}`}
        accessibilityRole="button"
        accessibilityLabel={`${t('ui.trees.tileLabel', { name, state: t(`ui.trees.state.${status}`), cost: price })}${computeNeed !== undefined ? `. ${t('ui.trees2.computeA11y', { compute: computeNeed, have: computeHave })}` : ''}`}
        style={({ pressed }) => [
          styles.tile,
          owned && (LINEWORK ? { backgroundColor: mixColor(colors.surface, accent, shape.tile === 'module' ? 0.14 : 0.28), borderColor: accent, borderWidth: shape.tile === 'module' ? 1 : 1.5 } : { backgroundColor: accent, borderColor: accent }),
          buyable && { borderColor: accent, borderWidth: 2 },
          locked && styles.locked,
          pressed && styles.pressed,
        ]}
      >
        {shape.tile === 'plate' ? <Rivets color={owned ? colors.onPlayer : colors.border} /> : null}
        <View style={styles.head}>
          <Icon name={nodeId} size={ICON} color={owned ? fg : locked ? colors.dim : colors.text} accent={owned && !LINEWORK ? fg : accent} />
          <Text style={[styles.name, styles.nameRoom, { color: fg }]} numberOfLines={2}>
            {name}
          </Text>
        </View>
        <View style={styles.foot}>
          {owned ? (
            <Text style={[styles.cost, styles.ownedText, styles.footText, { color: LINEWORK ? accent : colors.onPlayer }]} numberOfLines={1}>
              {t('ui.trees.state.owned')}
            </Text>
          ) : (
            <Text style={[styles.cost, styles.footText, { color: costColor }]} numberOfLines={1}>
              {price}
            </Text>
          )}
          {computeNeed !== undefined ? (
            <View style={[styles.need, computeShort && styles.needShort]} testID={`node-need-${nodeId}`}>
              <Icon name="compute" size={11} color={computeShort ? needShortFg : owned ? fg : colors.dim} />
              <Text style={[styles.needText, { color: computeShort ? needShortFg : owned ? fg : colors.dim }]} numberOfLines={1}>
                {computeNeed}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      {shape.tile === 'schematic' ? <Pins color={owned || buyable ? accent : colors.border} /> : null}
      {shape.tile === 'module' && !locked ? <View pointerEvents="none" style={[styles.status, { backgroundColor: owned || buyable ? accent : colors.outline }, owned && glow(accent, { strength: 0.6 })]} /> : null}
      {shape.tile === 'plate' ? <PanelDeco ground={colors.bg} color={owned ? accent : buyable ? accent : colors.border} edgeWidth={buyable ? 2 : shape.outline} clip={8} corners={['tr']} /> : null}
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

/** Blueprint: the tile is a schematic component with a pin stub on each side. */
function Pins({ color }: { color: string }) {
  return (
    <>
      <View pointerEvents="none" style={[styles.pin, { left: -PIN, backgroundColor: color }]} />
      <View pointerEvents="none" style={[styles.pin, { right: -PIN, backgroundColor: color }]} />
    </>
  );
}

/** Hazard: the tile is a bolted plate. */
function Rivets({ color }: { color: string }) {
  return (
    <>
      <View pointerEvents="none" style={[styles.rivet, { left: 3, top: 3, borderColor: color }]} />
      <View pointerEvents="none" style={[styles.rivet, { left: 3, bottom: 3, borderColor: color }]} />
      <View pointerEvents="none" style={[styles.rivet, { right: 3, bottom: 3, borderColor: color }]} />
    </>
  );
}

const PIN = 6;
/** Tiles drawn as linework (schematic, module): owned ones are tinted, not filled. */
const LINEWORK = shape.tile === 'schematic' || shape.tile === 'module';
/** Node icon on the tile: big enough to read at a glance next to a two-line name. */
const ICON = shape.tile === 'plate' ? 18 : 22;
/** The "not enough compute" chip: the bad colour as a fill, readable text on it. */
const needShortFg = colors.newsPaper;

export const NodeTile = memo(NodeTileImpl);

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  tile: {
    flex: 1,
    borderRadius: radius.s,
    borderWidth: shape.tile === 'plain' ? 1 : shape.outline,
    borderColor: shape.tile === 'sticker' ? colors.outline : colors.border,
    backgroundColor: LINEWORK ? colors.surface : colors.raised,
    paddingHorizontal: shape.tile === 'plate' ? spacing.s + 3 : spacing.s,
    paddingLeft: shape.tile === 'module' ? spacing.s + 3 : undefined,
    paddingVertical: 6,
    justifyContent: 'space-between',
    ...flatShadow(),
  },
  // Module: a status bar down the left edge (lit in the tree's accent when owned or buyable).
  status: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: radius.s, borderBottomLeftRadius: radius.s },
  pin: { position: 'absolute', top: '50%', width: PIN, height: shape.outline + 0.5, marginTop: -0.5 },
  rivet: { position: 'absolute', width: 4, height: 4, borderRadius: 2, borderWidth: 1 },
  glow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: radius.s + (radius.s ? 4 : 0), borderWidth: 2, borderStyle: shape.tile === 'schematic' ? 'dashed' : 'solid' },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.s },
  locked: { opacity: 0.5, backgroundColor: colors.surface, borderStyle: shape.tile === 'schematic' ? 'dashed' : 'solid', boxShadow: 'none' },
  pressed: { opacity: 0.75 },
  name:
    LINEWORK
      ? { ...voice.bodyStrong, fontSize: 12, lineHeight: 14, letterSpacing: 0.1 }
      : shape.tile === 'plate'
        ? { ...voice.calmHeading, fontSize: 13, lineHeight: 14, letterSpacing: 0 }
        : { ...voice.bodyStrong, fontSize: type.xs, lineHeight: 14 },
  // Keeps the name clear of the corner badge (owned check, lock).
  nameRoom: { paddingRight: 10, flex: 1 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footText: { flex: 1 },
  need: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 3, borderRadius: radius.xs },
  needShort: { backgroundColor: colors.alarm },
  needText: { ...voice.calmNumber, fontSize: 10.5, lineHeight: 13, ...tabular },
  corner: {
    position: 'absolute',
    top: -6,
    right: shape.tile === 'plate' ? 6 : -6,
    width: 20,
    height: 20,
    borderRadius: shape.tile === 'schematic' || shape.tile === 'plate' ? 0 : shape.tile === 'module' ? radius.xs : 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerLocked: { backgroundColor: colors.bg, borderColor: colors.border },
  cost: { ...(shape.tile === 'plain' ? { fontWeight: '600' as const } : voice.calmNumber), fontSize: type.xs, ...tabular },
  ownedText: { color: colors.onPlayer, ...(shape.tile === 'plain' ? { fontWeight: '800' as const } : voice.calmLabel), fontSize: shape.tile === 'plain' ? type.xs : 10 },
});
