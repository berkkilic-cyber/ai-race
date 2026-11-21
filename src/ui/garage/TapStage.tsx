import { memo, useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { comboAt, comboMultiplier, totalRate } from '@/idle';

import { Icon } from '../icons';
import { t } from '../i18n';
import { Mascot, type MascotMood } from '../mascot';
import { useAmbientClock, wave } from '../motion/ambient';
import { colors, flatShadow, radius, shape, spacing, tabular, type, voice } from '../theme';
import { garageNow } from './clock';
import { tapHaptic } from './haptics';
import { useGarage } from './hooks';
import { StatusRow } from './StatusRow';
import { GoldenBubble } from './GoldenBubble';
import { useGarageStore, type GarageStore } from './store';
import { fmt, fmtMult } from './text';

/** Pop-out numbers kept mounted and reused round-robin (no mounting per tap). */
const POPS = 12;

interface PopHandle {
  fire(x: number, y: number, text: string): void;
}

/** One pop-out number. Only this small view re-renders when it fires. */
const PopSlot = memo(function PopSlot({ handle }: { handle: Ref<PopHandle> }) {
  const [text, setText] = useState('');
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const p = useSharedValue(1);
  const drift = useSharedValue(0);
  useImperativeHandle(handle, () => ({
    fire(px, py, label) {
      setText(label);
      x.set(px);
      y.set(py);
      drift.set((Math.random() - 0.5) * 36);
      p.set(0);
      p.set(withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) }));
    },
  }));
  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v >= 1 ? 0 : 1 - v * v,
      transform: [{ translateX: x.get() - 60 + drift.get() * v }, { translateY: y.get() - 22 - 64 * v }, { scale: 1.25 - 0.35 * v }],
    };
  });
  return (
    <Animated.View style={[styles.pop, style]} pointerEvents="none">
      <Text style={styles.popText} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
});

/** Tokens and rate, counted smoothly on a light timer without re-rendering anything else. */
export const LiveCounter = memo(function LiveCounter() {
  const [shown, setShown] = useState({ tokens: '0', rate: '0' });
  useEffect(() => {
    const update = () => {
      const { state, content } = useGarageStore.getState();
      if (!state) return;
      const now = garageNow();
      const rate = totalRate(state, content, now);
      const ahead = Math.max(0, Math.min(1000, now - state.now));
      const next = { tokens: fmt(state.tokens + (rate * ahead) / 1000), rate: fmt(rate) };
      setShown((prev) => (prev.tokens === next.tokens && prev.rate === next.rate ? prev : next));
    };
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.counter} accessibilityRole="summary" accessibilityLabel={`${shown.tokens} ${t('ui.garage.tokens')}, ${t('ui.garage.perSec', { amount: shown.rate })}`}>
      <View style={styles.tokensRow}>
        <Icon name="hype" size={26} color={colors.text} accent={colors.player} />
        <Text style={styles.tokens} numberOfLines={1} adjustsFontSizeToFit testID="garage-tokens">
          {shown.tokens}
        </Text>
      </View>
      <Text style={styles.rate} numberOfLines={1} testID="garage-rate">
        {t('ui.garage.perSec', { amount: shown.rate })}
      </Text>
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
const selCombo = (s: GarageStore) => (s.state ? comboAt(s.state, s.content, garageNow()) : 0);

/** The combo meter: count, multiplier and progress to the next stack; a tap hint at rest. */
const ComboMeter = memo(function ComboMeter() {
  const [, force] = useState(0);
  const count = useGarage(selCombo, Number);
  // The combo lapses without a tap: check again shortly after the last one.
  useEffect(() => {
    if (count <= 0) return;
    const timer = setTimeout(() => force((n) => n + 1), 650);
    return () => clearTimeout(timer);
  });
  const { state, content } = useGarageStore.getState();
  if (!state || count <= 0) {
    return (
      <View style={styles.combo}>
        <Text style={styles.hint}>{t('ui.garage.tapHint')}</Text>
      </View>
    );
  }
  const m = comboMultiplier(state, content, count);
  const step = content.tap.comboStep;
  const maxed = m >= comboMultiplier(state, content, 1e9);
  const frac = maxed ? 1 : (count % step) / step;
  return (
    <View style={styles.combo} testID="garage-combo">
      <Text style={styles.comboText}>{t('ui.garage.combo', { count })}</Text>
      <View style={styles.comboTrack}>
        <View style={[styles.comboFill, { width: `${Math.round(frac * 100)}%` }]} />
      </View>
      <Text style={[styles.comboText, styles.comboMult]}>{t('ui.garage.comboMult', { mult: fmtMult(m) })}</Text>
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
function TapTarget({ size }: { size: number }) {
  const reduced = useReducedMotion();
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
    },
    [kick, reduced],
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
            <Animated.View style={[styles.ring2, ring(size * 0.98), ring2Style]} />
            <Animated.View style={[styles.ring, ring(size * 0.8), ringStyle]} />
            <View style={[styles.pad, ring(size * 0.62)]} />
            <Animated.View style={modelStyle}>
              <Mascot mood={mood} size={Math.round(size * 0.5)} />
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

/** The left half of the screen: counter, status chips, the tap target, the combo meter and golden moments. */
export function TapStage({ compact }: { compact?: boolean }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [target, setTarget] = useState(180);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: width, h: height }));
  };
  const onTargetLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const s = Math.max(96, Math.min(height, width / 1.5, 260));
    setTarget((prev) => (Math.abs(prev - s) < 2 ? prev : Math.floor(s)));
  };
  return (
    <View style={styles.stage} onLayout={onLayout} testID="garage-stage">
      <LiveCounter />
      <StatusRow />
      <View style={[styles.targetArea, compact && styles.targetAreaCompact]} onLayout={onTargetLayout}>
        <TapTarget size={target} />
        <FlashLine />
      </View>
      <ComboMeter />
      <GoldenBubble width={box.w} height={box.h} />
    </View>
  );
}


const styles = StyleSheet.create({
  stage: { flex: 1, paddingHorizontal: spacing.m, paddingTop: spacing.s, paddingBottom: spacing.xs },
  counter: { alignItems: 'center' },
  tokensRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, maxWidth: '100%' },
  tokens: { ...voice.calmNumber, ...tabular, color: colors.text, fontSize: 38, lineHeight: 44, letterSpacing: -0.5 },
  rate: { ...voice.calmNumber, ...tabular, color: colors.playerText, fontSize: type.m },
  targetArea: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 110 },
  targetAreaCompact: { minHeight: 96 },
  targetBox: { alignItems: 'center', justifyContent: 'center' },
  surface: { alignItems: 'center', justifyContent: 'center' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: shape.outline + 0.5, borderColor: colors.player },
  ring2: { position: 'absolute', borderWidth: shape.hairline, borderColor: colors.border, borderStyle: 'dashed' },
  pad: { position: 'absolute', backgroundColor: colors.surface, borderWidth: shape.panel === 'plain' ? StyleSheet.hairlineWidth : shape.outline, borderColor: shape.panel === 'sticker' ? colors.outline : colors.border, ...flatShadow() },
  pop: { position: 'absolute', left: 0, top: 0, width: 120, alignItems: 'center' },
  popText: { ...voice.calmNumber, ...tabular, color: colors.playerText, fontSize: type.l + 2, textShadowColor: colors.bg, textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  combo: { height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s },
  hint: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs },
  comboText: { ...voice.calmNumber, ...tabular, color: colors.text, fontSize: type.s, minWidth: 74 },
  comboMult: { color: colors.playerText, textAlign: 'right', minWidth: 40 },
  comboTrack: { width: 90, height: 6, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden', borderWidth: shape.panel === 'sticker' ? 1 : 0, borderColor: colors.outline },
  comboFill: { height: '100%', backgroundColor: colors.player },
  flash: { position: 'absolute', top: '18%', left: 0, right: 0, alignItems: 'center' },
  flashText: { ...voice.loudHeadline, fontSize: 26, lineHeight: 28, color: colors.newsInk, backgroundColor: colors.newsPaper, paddingHorizontal: spacing.s, overflow: 'hidden' },
});
