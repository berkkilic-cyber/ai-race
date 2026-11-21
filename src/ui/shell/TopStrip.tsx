import type { ReactNode } from 'react';

import { getCapabilityLevel, getCompute, getIncome, getMeters } from '@/engine';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { CountingNumber } from '../components/CountingNumber';
import { dangerKey, useComposure, useComposureProgress } from '../composure';
import { fmtCash, fmtCompact, fmtDay, fmtPerDay } from '../format';
import { useKeyedSelector } from '../hooks/useKeyedSelector';
import { useInsets } from '../hooks/useInsets';
import { labName, t } from '../i18n';
import { DEBUG_LONG_PRESS_MS } from '../diagnostics/BuildStamp';
import { toggleTouchDebug } from '../map/touchDebug';
import { Mascot, useMascotMood } from '../mascot';
import { useGameStore, type GameStore } from '../store/game';
import { colors, layout, spacing, voice } from '../theme';
import { useTutorialTarget } from '../tutorial/targets';
import { wideShellLayout } from './shellLayout';
import { StripMeter } from './StripMeter';

/** Smallest meter width that still shows a full label like "Regulation" at the strip's label size. */
const METER_MIN = 54;

/** Below this strip width the cash income sub-label is dropped so nothing wraps or clips. */
const ROOM_FOR_INCOME = 880;

const fmtTier = (tier: number) => t('ui.resource.tier', { tier: Math.round(tier) });

/**
 * Wide-mode header in the calm voice: the mascot and the lab name in serif, then the
 * resources as serif figures under small caps labels, separated by hairlines, then the
 * meters and the speed control. The rule under the strip carries composure: it turns
 * amber at level 1 and alarm red from level 2.
 */
export function TopStrip({ right }: { right?: ReactNode }) {
  const name = useGameStore((s) => (s.state ? labName(s.state.labs[s.state.playerLabId]) : ''));
  const mood = useMascotMood();
  const composure = useComposure();
  const progress = useComposureProgress();
  const { width, height } = useWindowDimensions();
  const insets = useInsets();
  const { stripWidth } = wideShellLayout(width, height, insets);
  const showIncome = stripWidth >= ROOM_FOR_INCOME;
  const resourcesRef = useTutorialTarget('shell.resources');
  const metersRef = useTutorialTarget('shell.meters');
  const tagFor = (key: 'regulation' | 'backlash' | 'rival') => (composure.level >= 2 && composure.driver === key ? t(dangerKey(key)) : null);

  const ruleStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      backgroundColor: interpolateColor(p, [0, 1, 2, 3], [colors.border, colors.amber, colors.alarm, colors.alarm]),
      height: p < 0.5 ? 1 : 2,
    };
  });

  return (
    <View style={styles.strip}>
      <View style={styles.brand}>
        <Pressable onLongPress={toggleTouchDebug} delayLongPress={DEBUG_LONG_PRESS_MS} accessible={false}>
          <Mascot mood={mood} size={26} testID="mascot" />
        </Pressable>
        <View style={styles.title}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <DayText />
        </View>
      </View>
      <View style={styles.rule} />
      <View style={styles.stats} ref={resourcesRef}>
        <HypeStat />
        <CashStat showIncome={showIncome} />
        <ComputeStat />
        <TierStat />
      </View>
      <View style={styles.rule} />
      <View style={styles.meters} ref={metersRef}>
        <MeterSlot meter="regulation" label={t('term.regulation')} color={colors.info} tag={tagFor('regulation')} testID="meter-regulation" />
        <MeterSlot meter="backlash" label={t('term.backlash')} color={colors.alarm} tag={tagFor('backlash')} testID="meter-backlash" />
        <MeterSlot meter="rival" label={t('term.rival')} color={colors.amber} tag={tagFor('rival')} testID="meter-rival" />
      </View>
      {right}
      <Animated.View style={[styles.composureRule, ruleStyle]} pointerEvents="none" testID="composure-rule" />
    </View>
  );
}

// Each figure subscribes to what it shows (the formatted text, a whole or half percent),
// not to the raw numbers, which change every tick: a tick re-renders only the figures whose
// text changed, and the strip itself not at all.

type Rate = { v: number; rate: number };
const NONE: Rate = { v: 0, rate: 0 };
const selHype = (s: GameStore): Rate => {
  const st = s.state;
  if (!st) return NONE;
  return { v: st.labs[st.playerLabId].hype, rate: getIncome(st, s.pack, st.playerLabId).hype };
};
const selCash = (s: GameStore): Rate => {
  const st = s.state;
  if (!st) return NONE;
  return { v: st.labs[st.playerLabId].cash, rate: getIncome(st, s.pack, st.playerLabId).cash };
};
const selCompute = (s: GameStore): number => (s.state ? getCompute(s.state, s.pack, s.state.playerLabId) : 0);
const selTier = (s: GameStore): number => (s.state ? getCapabilityLevel(s.state, s.pack, s.state.playerLabId) : 0);
const selTick = (s: GameStore): number => s.state?.tick ?? 0;
const keyHype = (r: Rate) => fmtCompact(r.v);
const keyCash = (r: Rate) => `${fmtCash(r.v)}|${fmtCash(r.rate)}|${r.rate >= 0}`;
const incomeOf = (rate: number) => fmtPerDay(`${rate >= 0 ? '+' : ''}${fmtCash(rate)}`);
const meterSelectors = {
  regulation: (s: GameStore) => (s.state ? getMeters(s.state, s.state.playerLabId).regulation : 0),
  backlash: (s: GameStore) => (s.state ? getMeters(s.state, s.state.playerLabId).backlash : 0),
  rival: (s: GameStore) => (s.state ? getMeters(s.state, s.state.playerLabId).rival : 0),
};
/** Half-percent steps: the text shows whole percents, the bar cannot show finer. */
const keyMeter = (v: number) => Math.floor(v * 2);

function DayText() {
  const tick = useKeyedSelector(selTick, fmtDay);
  return (
    <Text style={styles.day} numberOfLines={1}>
      {fmtDay(tick)}
    </Text>
  );
}

function HypeStat() {
  const r = useKeyedSelector(selHype, keyHype);
  return (
    <Stat label={t('term.hype')} target="shell.hype" testID="res-hype" a11y={fmtCompact(r.v)}>
      <CountingNumber value={r.v} format={fmtCompact} notable={Math.max(2, Math.abs(r.rate) * 3)} style={styles.value} />
    </Stat>
  );
}

function CashStat({ showIncome }: { showIncome: boolean }) {
  const r = useKeyedSelector(selCash, keyCash);
  const incomeText = showIncome ? incomeOf(r.rate) : undefined;
  return (
    <Stat label={t('term.cash')} target="shell.cash" testID="res-cash" a11y={`${fmtCash(r.v)}${incomeText ? ` ${incomeText}` : ''}`}>
      <View style={styles.valueRow}>
        <CountingNumber value={r.v} format={fmtCash} notable={Math.max(1, Math.abs(r.rate) * 3)} style={styles.value} />
        {incomeText ? (
          <Text style={[styles.sub, { color: r.rate >= 0 ? colors.goodText : colors.bad }]} numberOfLines={1}>
            {incomeText}
          </Text>
        ) : null}
      </View>
    </Stat>
  );
}

function ComputeStat() {
  const v = useKeyedSelector(selCompute, fmtCompact);
  return (
    <Stat label={t('term.compute')} target="shell.compute" testID="res-compute" a11y={fmtCompact(v)}>
      <CountingNumber value={v} format={fmtCompact} style={styles.value} />
    </Stat>
  );
}

function TierStat() {
  const v = useKeyedSelector(selTier, fmtTier);
  return (
    <Stat label={t('term.capability')} target="shell.tier" testID="res-tier" a11y={fmtTier(v)}>
      <CountingNumber value={v} format={fmtTier} style={[styles.value, styles.tier]} color={colors.playerText} />
    </Stat>
  );
}

function MeterSlot({ meter, ...rest }: { meter: keyof typeof meterSelectors; label: string; color: string; tag: string | null; testID: string }) {
  const value = useKeyedSelector(meterSelectors[meter], keyMeter);
  return <StripMeter value={value} {...rest} />;
}

function Stat({ label, a11y, children, target, testID }: { label: string; a11y: string; children: ReactNode; target?: string; testID?: string }) {
  const tutorialRef = useTutorialTarget(target ?? null);
  return (
    <View style={styles.stat} ref={tutorialRef} testID={testID} accessibilityLabel={`${label} ${a11y}`}>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    height: layout.stripHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: spacing.s,
    paddingRight: spacing.s,
    backgroundColor: colors.bg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1, minWidth: 90, maxWidth: 196 },
  title: { flexShrink: 1, minWidth: 0 },
  name: { ...voice.calmHeading, color: colors.text, fontSize: 15, lineHeight: 18 },
  day: { ...voice.calmLabel, color: colors.dim, lineHeight: 12, fontVariant: ['tabular-nums'] },
  rule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 8, backgroundColor: colors.border },
  stats: { flexDirection: 'row', gap: 10, flexShrink: 0 },
  stat: { justifyContent: 'center', gap: 1 },
  statLabel: { ...voice.calmLabel, color: colors.dim, fontSize: 9.5, lineHeight: 11, letterSpacing: 0.3 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  value: { ...voice.calmNumber, color: colors.text, fontSize: 16, lineHeight: 19 },
  tier: { color: colors.playerText },
  sub: { fontSize: 10, fontVariant: ['tabular-nums'] },
  // The lab name gives way before the meters do.
  meters: { flex: 1, minWidth: 3 * METER_MIN + 2 * spacing.s, flexDirection: 'row', gap: spacing.s + 2 },
  composureRule: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
