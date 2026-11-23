import { memo, useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { comboAt, comboMultiplier, currentStage, nextStage, totalRate, unitCost } from '@/idle';

import { Icon } from '../icons';
import { t } from '../i18n';
import { cased } from '../locale';
import { Text } from '../locale/Text';
import { Mascot, type MascotMood } from '../mascot';
import { useAmbientClock, wave } from '../motion/ambient';
import { colors, flatShadow, radius, shape, spacing, tabular, type, voice } from '../theme';
import { garageNow } from './clock';
import { tapHaptic } from './haptics';
import { useGarage } from './hooks';
import { OfferSlot } from './adOffer';
import { BonusOffer } from './BonusOffer';
import { GoldenBubble } from './GoldenBubble';
import { HappeningBubble } from './HappeningBubble';
import { LiveText } from './LiveText';
import { bucketKey, LabRoom, roomBuckets, type RoomBuckets, type StageRect as Rect } from './LabRoom';
import { StatusRow } from './StatusRow';
import { useGarageStore, type GarageStore } from './store';
import { fmt, fmtMult, gt, requirementText } from './text';

/** Pop-out numbers kept mounted and reused round-robin (no mounting per tap). */
const POPS = 12;

interface PopHandle {
  fire(x: number, y: number, text: string): void;
}

/** One pop-out number: its text and motion are shared values, so firing it commits nothing in React. */
const PopSlot = memo(function PopSlot({ handle }: { handle: Ref<PopHandle> }) {
  const text = useSharedValue('');
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const p = useSharedValue(1);
  const drift = useSharedValue(0);
  useImperativeHandle(handle, () => ({
    fire(px, py, label) {
      text.set(label);
      x.set(px);
      y.set(py);
      drift.set((Math.random() - 0.5) * 36);
      p.set(0);
      p.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    },
  }));
  const style = useAnimatedStyle(() => {
    const v = p.get();
    // Full strength while it rises, then a quick fade: no half-faded number lingers.
    return {
      opacity: v >= 1 ? 0 : v < 0.5 ? 1 : 1 - ((v - 0.5) / 0.5) ** 2,
      transform: [{ translateX: x.get() - 60 + drift.get() * v }, { translateY: y.get() - 22 - 64 * v }, { scale: 1.25 - 0.35 * v }],
    };
  });
  return (
    <Animated.View style={[styles.pop, style]} pointerEvents="none">
      <LiveText text={text} initial="" style={styles.popText} />
    </Animated.View>
  );
});

/**
 * Tokens and rate, counted smoothly on a light timer. The numbers are shared values shown
 * through LiveText, so the counter never re-renders (React commits nothing for it).
 */
export const LiveCounter = memo(function LiveCounter() {
  const tokens = useSharedValue('0');
  const rateText = useSharedValue('');
  useEffect(() => {
    let lastTokens = '';
    let lastRate = '';
    const update = () => {
      const { state, content } = useGarageStore.getState();
      if (!state) return;
      const now = garageNow();
      const rate = totalRate(state, content, now);
      const ahead = Math.max(0, Math.min(1000, now - state.now));
      const nextTokens = fmt(state.tokens + (rate * ahead) / 1000);
      const nextRate = t('ui.garage.perSec', { amount: fmt(rate) });
      if (nextTokens !== lastTokens) tokens.set((lastTokens = nextTokens));
      if (nextRate !== lastRate) rateText.set((lastRate = nextRate));
    };
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [tokens, rateText]);
  return (
    <View style={styles.counter} accessibilityRole="summary" accessibilityLabel={t('ui.garage.tokens')}>
      <View style={styles.tokensRow}>
        <Icon name="speech" size={20} color={colors.text} accent={colors.player} />
        <LiveText text={tokens} initial="0" style={styles.tokens} testID="garage-tokens" />
      </View>
      <LiveText text={rateText} initial="" style={styles.rate} testID="garage-rate" />
    </View>
  );
});

const selMood = (s: GarageStore): MascotMood => {
  const st = s.state;
  if (!st) return 'calm';
  if (st.incident && st.incident.until > st.now) return 'sweating';
  if (st.frenzy && st.frenzy.until > st.now) return 'smug';
  if (st.combo.count >= 30 && st.now - st.combo.lastAt < 1500) return 'pleased';
  return 'calm';
};
const id = <T,>(v: T) => v as unknown as string;

/** The combo meter's live values, written by the tap target and read on the UI thread. */
interface ComboDisplay {
  /** 0 = at rest (the tap hint shows), 1 = the meter shows. */
  on: SharedValue<number>;
  count: SharedValue<string>;
  mult: SharedValue<string>;
  /** Progress to the next stack, 0..1. */
  frac: SharedValue<number>;
}

/** The combo lapses this long after the last tap (a little after the engine's window, so it never flickers). */
const COMBO_IDLE_MS = 650;

function useComboDisplay(): ComboDisplay {
  const on = useSharedValue(0);
  const count = useSharedValue('');
  const mult = useSharedValue('');
  const frac = useSharedValue(0);
  return { on, count, mult, frac };
}

/** Writes the combo after a tap (no React state): count, multiplier and progress; at rest the hint. */
function showCombo(d: ComboDisplay): void {
  const { state, content } = useGarageStore.getState();
  const count = state ? comboAt(state, content, garageNow()) : 0;
  if (!state || count <= 0) {
    d.on.set(0);
    return;
  }
  const m = comboMultiplier(state, content, count);
  const step = content.tap.comboStep;
  const maxed = m >= comboMultiplier(state, content, 1e9);
  d.count.set(t('ui.garage.combo', { count }));
  d.mult.set(t('ui.garage.comboMult', { mult: fmtMult(m) }));
  d.frac.set(maxed ? 1 : (count % step) / step);
  d.on.set(1);
}

/** The combo meter: count, multiplier and progress to the next stack; a tap hint at rest. Never re-renders per tap. */
const ComboMeter = memo(function ComboMeter({ display }: { display: ComboDisplay }) {
  const meter = useAnimatedStyle(() => ({ opacity: display.on.get() }));
  const hint = useAnimatedStyle(() => ({ opacity: 1 - display.on.get() }));
  const fill = useAnimatedStyle(() => ({ width: `${Math.round(Math.max(0, Math.min(1, display.frac.get())) * 100)}%` }));
  return (
    <View style={styles.combo}>
      <Animated.View style={[styles.comboLayer, hint]} pointerEvents="none">
        <RestHint />
      </Animated.View>
      <Animated.View style={[styles.comboLayer, meter]} pointerEvents="none" testID="garage-combo">
        <LiveText text={display.count} initial="" style={styles.comboText} />
        <View style={styles.comboTrack}>
          <Animated.View style={[styles.comboFill, fill]} />
        </View>
        <LiveText text={display.mult} initial="" style={[styles.comboText, styles.comboMult]} />
      </Animated.View>
    </View>
  );
});

const ROUND = shape.panel === 'sticker' || shape.panel === 'plain';

/**
 * The big tap target: the player's model (the mascot) on a pedestal of rings. Takes every
 * touch through the core responder system (no gesture-handler): each new finger is one tap,
 * so several fingers count. Visual feedback runs on shared values; the only React updates
 * per tap are the one pop-out label that fires.
 */
function TapTarget({ size, combo }: { size: number; combo: ComboDisplay }) {
  const reduced = useReducedMotion();
  const lapse = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (lapse.current) clearTimeout(lapse.current);
    },
    [],
  );
  const kick = useSharedValue(0);
  const active = useRef(new Set<number>());
  const pops = useRef<(PopHandle | null)[]>([]);
  const next = useRef(0);
  const mood = useGarage(selMood, id);
  const clock = useAmbientClock(!reduced);

  const fireTap = useCallback(
    (x: number, y: number) => {
      const gained = useGarageStore.getState().tap();
      tapHaptic();
      if (!reduced) {
        kick.set(withSequence(withTiming(1, { duration: 40 }), withSpring(0, { damping: 11, stiffness: 320 })));
      }
      const slot = pops.current[next.current % POPS];
      next.current += 1;
      slot?.fire(x, y, `+${fmt(gained)}`);
      showCombo(combo);
      if (lapse.current) clearTimeout(lapse.current);
      lapse.current = setTimeout(() => showCombo(combo), COMBO_IDLE_MS);
    },
    [kick, reduced, combo],
  );

  /** New fingers since the last event, each counted once. */
  const onStart = useCallback(
    (e: GestureResponderEvent) => {
      const touches = e.nativeEvent.changedTouches?.length ? e.nativeEvent.changedTouches : [e.nativeEvent];
      for (const touch of touches) {
        const key = Number(touch.identifier ?? 0);
        if (active.current.has(key)) continue;
        active.current.add(key);
        fireTap(touch.locationX ?? size / 2, touch.locationY ?? size / 2);
      }
    },
    [fireTap, size],
  );
  const onEnd = useCallback((e: GestureResponderEvent) => {
    const ended = e.nativeEvent.changedTouches?.length ? e.nativeEvent.changedTouches : [e.nativeEvent];
    for (const touch of ended) active.current.delete(Number(touch.identifier ?? 0));
    if (!e.nativeEvent.touches || e.nativeEvent.touches.length === 0) active.current.clear();
  }, []);
  const onRelease = useCallback(() => active.current.clear(), []);

  const modelStyle = useAnimatedStyle(() => {
    const bob = clock ? wave(clock.get(), 2.6) : 0;
    return { transform: [{ translateY: -3 * bob }, { scale: 1 - 0.07 * kick.get() }] };
  });
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.06 * kick.get() }], opacity: 0.55 + 0.45 * kick.get() }));
  const ring2Style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.12 * kick.get() }], opacity: 0.25 + 0.5 * kick.get() }));

  const ring = (s: number) => ({ width: s, height: s, borderRadius: ROUND ? s / 2 : radius.s });
  return (
    <View style={styles.targetBox}>
      <View
        style={[styles.surface, { width: size * 1.5, height: size }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onStart}
        onResponderStart={onStart}
        onResponderEnd={onEnd}
        onResponderRelease={onRelease}
        onResponderTerminate={onRelease}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('ui.garage.tapLabel')}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => fireTap(size * 0.75, size / 2)}
        testID="garage-tap"
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.centre}>
            <Animated.View style={[styles.ring2, ring(size * 1.04), ring2Style]} />
            <Animated.View style={[styles.ring, ring(size * 0.88), ringStyle]} />
            <View style={[styles.pad, ring(size * 0.74)]} />
            <Animated.View style={modelStyle}>
              <Mascot mood={mood} size={Math.round(size * 0.62)} />
            </Animated.View>
          </View>
          {Array.from({ length: POPS }, (_, i) => (
            <PopSlot
              key={i}
              handle={(h: PopHandle | null) => {
                pops.current[i] = h;
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

/** A centred reward line that rises and fades (golden moments, crates). */
function FlashLine() {
  const flash = useGarageStore((s) => s.flash);
  const p = useSharedValue(1);
  useEffect(() => {
    if (!flash) return;
    p.set(0);
    p.set(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }));
  }, [flash, p]);
  const style = useAnimatedStyle(() => ({ opacity: p.get() >= 1 ? 0 : Math.min(1, (1 - p.get()) * 2.2), transform: [{ translateY: -30 * p.get() }] }));
  if (!flash) return null;
  return (
    <Animated.View style={[styles.flash, style]} pointerEvents="none">
      <Text style={styles.flashText} numberOfLines={1} testID="garage-flash">
        {flash.text}
      </Text>
    </Animated.View>
  );
}

/** Room buckets from the generator counts: the first tier fills desks, the next four racks, the rest a shelf. */
const selBuckets = (s: GarageStore): RoomBuckets => {
  const st = s.state;
  const gens = s.content.generators;
  if (!st) return { desks: 0, racks: 0, shelf: [] };
  return roomBuckets(st.generators, gens.slice(0, 1).map((g) => g.id), gens.slice(1, 5).map((g) => g.id), gens.slice(5).map((g) => ({ id: g.id, icon: g.icon })));
};
const selScene = (s: GarageStore) => (s.state ? (currentStage(s.state, s.content)?.scene ?? 'garage') : 'garage');
const same = (v: string) => v;

/** The room itself, re-rendered only when the stage or a bucket changes. */
const Room = memo(function Room({ w, h, ceiling }: { w: number; h: number; ceiling: number }) {
  const buckets = useGarage(selBuckets, bucketKey);
  const scene = useGarage(selScene, same);
  return <LabRoom scene={scene} buckets={buckets} w={w} h={h} ceiling={ceiling} />;
});

const selNextStage = (s: GarageStore) => {
  const st = s.state;
  if (!st) return '';
  const next = nextStage(st, s.content);
  return next ? `${next.index}|${Math.floor(next.progress * 100)}` : '';
};

/** The next stage as a goal: where the lab moves next on one line, what it takes on the next, and the progress. */
export const NextStageGoal = memo(function NextStageGoal() {
  const key = useGarage(selNextStage, same);
  const { state, content } = useGarageStore.getState();
  if (!key || !state) return null;
  const next = nextStage(state, content);
  if (!next) return null;
  const name = t('ui.garage.stage.nextName', { name: gt(next.def.nameKey) });
  const goal = requirementText(next.requirement);
  return (
    <View style={styles.goal} testID="garage-next-stage" accessibilityLabel={t('ui.garage.stage.next', { name: gt(next.def.nameKey), goal })}>
      <Text style={styles.goalName} numberOfLines={1}>
        {cased(styles.goalName, name)}
      </Text>
      <Text style={styles.goalText} numberOfLines={1}>
        {goal}
      </Text>
      <View style={styles.goalTrack}>
        <View style={[styles.goalFill, { width: `${Math.round(next.progress * 100)}%` }]} />
      </View>
    </View>
  );
});

/** A one-line nudge for a brand-new lab, gone after the first purchase: tap, then buy the first generator. */
const selFirst = (s: GarageStore) => {
  const st = s.state;
  if (!st || st.stats.modelsShipped > 0 || st.generation > 1 || st.stage > 0) return '';
  for (const id in st.generators) if ((st.generators[id] ?? 0) > 0) return '';
  const first = s.content.generators[0];
  return first && st.tokens >= unitCost(first, st.generators[first.id] ?? 0) ? 'buy' : 'tap';
};

function RestHint() {
  const first = useGarage(selFirst, same);
  const gen = useGarageStore.getState().content.generators[0];
  const text = first === 'buy' && gen ? t('ui.garage.hint.buy', { name: gt(gen.nameKey) }) : first === 'tap' ? t('ui.garage.hint.tap') : t('ui.garage.tapHint');
  return (
    <Text style={[styles.hint, first !== '' && styles.hintFirst]} numberOfLines={1} testID={first ? `garage-hint-${first}` : undefined}>
      {cased(styles.hint, text)}
    </Text>
  );
}

/**
 * The left half of the screen: the lab as a room you can see, with the counter and the
 * next goal over its back wall, timed effects and the one ad offer at the top right, the
 * model (the tap target) on the floor, the combo meter, golden moments and lab happenings.
 */
export function TapStage({ compact }: { compact?: boolean }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const combo = useComboDisplay();
  const [target, setTarget] = useState(150);
  const [area, setArea] = useState<Rect | null>(null);
  const [ceiling, setCeiling] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: width, h: height }));
  };
  const onTargetLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    const s = Math.max(80, Math.min(height * 0.92, width / 2.2, compact ? 120 : 150));
    setTarget((prev) => (Math.abs(prev - s) < 2 ? prev : Math.floor(s)));
    setArea((a) => (a && Math.abs(a.x - x) < 1 && Math.abs(a.y - y) < 1 && Math.abs(a.w - width) < 1 && Math.abs(a.h - height) < 1 ? a : { x, y, w: width, h: height }));
  };
  // The HUD plate sits on the room's ceiling band: the room draws its wall below it, so no furniture shows behind the numbers.
  const onHudLayout = (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    const bottom = Math.ceil(y + height);
    setCeiling((c) => (Math.abs(c - bottom) < 2 ? c : bottom));
  };
  // The ring around the model (1.04 x its size), at the bottom centre of the target area.
  const avoid: Rect | null = area ? { x: area.x + area.w / 2 - target * 0.52, y: area.y + area.h - target * 1.02, w: target * 1.04, h: target * 1.04 } : null;
  return (
    <View style={styles.stage} onLayout={onLayout} testID="garage-stage">
      <Room w={box.w} h={box.h} ceiling={ceiling} />
      <View style={styles.hud} pointerEvents="box-none" onLayout={onHudLayout}>
        <View style={styles.hudLeft} pointerEvents="box-none" testID="garage-hud">
          <LiveCounter />
          <NextStageGoal />
        </View>
        <OfferSlot />
      </View>
      <StatusRow />
      <View style={[styles.targetArea, compact && styles.targetAreaCompact]} onLayout={onTargetLayout} pointerEvents="box-none">
        <TapTarget size={target} combo={combo} />
        <FlashLine />
      </View>
      <ComboMeter display={combo} />
      <HappeningBubble width={box.w} height={box.h} avoid={avoid} />
      <GoldenBubble width={box.w} height={box.h} avoid={avoid} />
      <BonusOffer width={box.w} height={box.h} avoid={avoid} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, paddingHorizontal: spacing.s, paddingTop: spacing.xs, paddingBottom: spacing.xs, overflow: 'hidden' },
  hud: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.s },
  hudLeft: { width: 204, flexShrink: 1, minWidth: 0, backgroundColor: colors.bg, paddingHorizontal: spacing.s, paddingTop: 1, paddingBottom: spacing.xs, borderRadius: radius.s, borderWidth: shape.hairline, borderColor: colors.border },
  counter: { alignItems: 'flex-start' },
  tokensRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' },
  tokens: { ...voice.calmNumber, ...tabular, color: colors.text, fontSize: 27, lineHeight: 31, height: 31, letterSpacing: -0.5, width: 158 },
  rate: { ...voice.calmNumber, ...tabular, color: colors.playerText, fontSize: type.s, lineHeight: 15, height: 15, width: 186 },
  goal: { marginTop: 3, paddingTop: 2, gap: 0, borderTopWidth: shape.hairline, borderColor: colors.border },
  goalName: { ...voice.calmLabel, color: colors.text, fontSize: 10, lineHeight: 13 },
  goalText: { ...voice.body, color: colors.dim, fontSize: type.xs, lineHeight: 13 },
  goalTrack: { height: 3, marginTop: 2, backgroundColor: colors.raised, borderRadius: radius.pill, overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: colors.player },
  targetArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 90 },
  targetAreaCompact: { minHeight: 80 },
  targetBox: { alignItems: 'center', justifyContent: 'center' },
  surface: { alignItems: 'center', justifyContent: 'center' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: shape.outline + 0.5, borderColor: colors.player },
  ring2: { position: 'absolute', borderWidth: shape.hairline, borderColor: colors.border, borderStyle: 'dashed' },
  pad: { position: 'absolute', backgroundColor: colors.surface, borderWidth: shape.panel === 'plain' ? StyleSheet.hairlineWidth : shape.outline, borderColor: shape.panel === 'sticker' ? colors.outline : colors.border, ...flatShadow() },
  pop: { position: 'absolute', left: 0, top: 0, width: 120, alignItems: 'center' },
  popText: { ...voice.calmNumber, ...tabular, color: colors.playerText, fontSize: type.l + 2, width: 120, height: 26, textAlign: 'center', textShadowColor: colors.bg, textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  combo: { height: 28 },
  comboLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s },
  hint: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs },
  hintFirst: { color: colors.playerText },
  comboText: { ...voice.calmNumber, ...tabular, color: colors.text, fontSize: type.s, width: 84, height: 18 },
  comboMult: { color: colors.playerText, textAlign: 'right', width: 48 },
  comboTrack: { width: 90, height: 6, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden', borderWidth: shape.panel === 'sticker' ? 1 : 0, borderColor: colors.outline },
  comboFill: { height: '100%', backgroundColor: colors.player },
  flash: { position: 'absolute', top: '18%', left: 0, right: 0, alignItems: 'center' },
  flashText: { ...voice.loudHeadline, fontSize: 26, lineHeight: 28, color: colors.newsInk, backgroundColor: colors.newsPaper, paddingHorizontal: spacing.s, overflow: 'hidden' },
});
