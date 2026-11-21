import type { ReactNode } from 'react';

import { getCompute, getIncome, getMeters } from '@/engine';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';

import { mixColor } from '../color';
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
import { PanelDeco, Stripes } from '../components/Deco';
import { colors, flatShadow, layout, radius, shape, spacing, voice } from '../theme';
import { useTutorialTarget } from '../tutorial/targets';
import { haveText, needText } from '../explain/model';
import { isStuck, useModelStatus } from '../explain/useModelStatus';
import { Icon, type IconName } from '../icons';
import { useAmbientClock } from '../motion/ambient';
import { useStripPanel, type StripPanel } from './panels/store';
import { RaceMeter } from './RaceMeter';
import { wideShellLayout } from './shellLayout';
import { StripMeter } from './StripMeter';

/**
 * Room the three meters always keep: a meter with its danger tag ("REGULATORS CIRCLING"), a
 * plain meter (an abbreviated label over a short track and "100%") and the race bar (a track
 * and "100 vs 100%"), with the gaps between them. The lab name gives way first.
 */
const METERS_MIN = 296;

/** Below this strip width the cash income sub-label is dropped so nothing wraps or clips. */
const ROOM_FOR_INCOME = 880;

/**
 * From this strip width the resource figures carry their icons. Below it (phones in landscape)
 * the room goes to the labels and numbers, which must never clip.
 */
const ROOM_FOR_ICONS = 860;

/** Below this strip width the gaps between the strip's groups tighten (phones with side insets). */
const TIGHT_BELOW = 820;

/** Hazard: the strip stands on a thin band of warning stripes. */
const TAPE = 4;
const sticker = shape.panel === 'sticker';

/** Candy composure: the strip's stickers lose their colour as the meters rise (level 0..3). */
const STICKER_DRAIN = [colors.surface, colors.surface, mixColor(colors.surface, colors.drain, 0.55), colors.drain];

/** Neon composure: the strip's figures flicker now and then from level 2 (more often at 3). */
const FLICKER = shape.composure === 'alert';

/** Opacity of the flickering figures at ambient time t (seconds): mostly 1, a brief dip at random slots. */
function flickerAt(t: number, level: number): number {
  'worklet';
  if (level < 2 || !Number.isFinite(t) || t <= 0) return 1;
  const slot = Math.floor(t * 12);
  const r = Math.abs(Math.sin(slot * 12.9898) * 43758.5453) % 1;
  return r > (level >= 3 ? 0.92 : 0.965) ? 0.4 : 1;
}

const fmtTier = (tier: number) => t('ui.strip.tier', { tier: Math.round(tier) });

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
  const icons = stripWidth >= ROOM_FOR_ICONS;
  const resourcesRef = useTutorialTarget('shell.resources');
  const metersRef = useTutorialTarget('shell.meters');
  const reduced = useReducedMotion();
  const flickerClock = useAmbientClock(FLICKER && composure.level >= 2 && !reduced);
  const level = composure.level;
  const flicker = useAnimatedStyle(() => (FLICKER && flickerClock ? { opacity: flickerAt(flickerClock.get(), level) } : {}));
  const tagFor = (key: 'regulation' | 'backlash' | 'rival') => (composure.level >= 2 && composure.driver === key ? t(dangerKey(key)) : null);

  const ruleStyle = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      backgroundColor: interpolateColor(p, [0, 1, 2, 3], [colors.border, colors.amber, colors.alarm, colors.alarm]),
      height: p < 0.5 ? 1 : 2,
    };
  });

  // Candy: the two stickers come loose and grey as the run goes wrong (opposite tilts).
  const stickerA = useAnimatedStyle(() => {
    if (!sticker) return {};
    const p = progress.get();
    return { backgroundColor: interpolateColor(p, [0, 1, 2, 3], STICKER_DRAIN), transform: [{ rotate: `${interpolate(p, [0, 1, 2, 3], [0, 0, -1.2, -2.6], 'clamp')}deg` }] };
  });
  const stickerB = useAnimatedStyle(() => {
    if (!sticker) return {};
    const p = progress.get();
    return { backgroundColor: interpolateColor(p, [0, 1, 2, 3], STICKER_DRAIN), transform: [{ rotate: `${interpolate(p, [0, 1, 2, 3], [0, 0.4, 1.4, 3], 'clamp')}deg` }] };
  });

  return (
    <View style={[styles.strip, stripWidth < TIGHT_BELOW && styles.stripTight]}>
      <View style={[styles.brand, styles.brandBox]}>
        <Pressable onLongPress={toggleTouchDebug} delayLongPress={DEBUG_LONG_PRESS_MS} accessible={false}>
          <Mascot mood={mood} size={shape.mascot === 'square' ? 26 : 28} testID="mascot" />
        </Pressable>
        <View style={styles.title}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <DayText />
        </View>
        {shape.panel === 'ticks' ? <PanelDeco /> : null}
      </View>
      <View style={styles.rule} />
      <Animated.View style={[styles.statsBox, styles.group, stickerA, flicker]}>
        <View style={styles.stats} ref={resourcesRef}>
          <HypeStat icons={icons} />
          <CashStat showIncome={showIncome} icons={icons} />
          <ComputeStat icons={icons} />
          <TierStat icons={icons} roomy={showIncome} />
        </View>
      </Animated.View>
      <View style={styles.rule} />
      <Animated.View style={[styles.metersBox, styles.group, stickerB]}>
        <View style={styles.meters} ref={metersRef}>
          <MeterSlot meter="regulation" label={t('term.regulation')} shortLabel={t('ui.strip.short.regulation')} icon="regulation" color={colors.info} tag={tagFor('regulation')} testID="meter-regulation" />
          <MeterSlot meter="backlash" label={t('term.backlash')} shortLabel={t('ui.strip.short.backlash')} icon="backlash" color={colors.alarm} tag={tagFor('backlash')} testID="meter-backlash" />
          {/* The third meter is the AGI race: the player against the leading rival (still the composure's "rival" meter). */}
          <RaceMeter tag={tagFor('rival')} testID="meter-rival" />
        </View>
      </Animated.View>
      {right}
      {shape.composure === 'tape' ? <Stripes height={TAPE} stripe={5} style={styles.tape} /> : null}
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
const selTick = (s: GameStore): number => s.state?.tick ?? 0;
const keyHype = (r: Rate) => fmtCompact(r.v);
const keyCash = (r: Rate) => `${fmtCash(r.v)}|${fmtCash(r.rate)}|${r.rate >= 0}`;
const incomeOf = (rate: number) => fmtPerDay(`${rate >= 0 ? '+' : ''}${fmtCash(rate)}`);
const meterSelectors = {
  regulation: (s: GameStore) => (s.state ? getMeters(s.state, s.state.playerLabId).regulation : 0),
  backlash: (s: GameStore) => (s.state ? getMeters(s.state, s.state.playerLabId).backlash : 0),
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

function HypeStat({ icons }: { icons: boolean }) {
  const r = useKeyedSelector(selHype, keyHype);
  return (
    <Stat label={t('term.hype')} icon={icons ? 'hype' : undefined} panel="hype" target="shell.hype" testID="res-hype" a11y={fmtCompact(r.v)}>
      <CountingNumber value={r.v} format={fmtCompact} notable={Math.max(2, Math.abs(r.rate) * 3)} style={styles.value} />
    </Stat>
  );
}

function CashStat({ showIncome, icons }: { showIncome: boolean; icons: boolean }) {
  const r = useKeyedSelector(selCash, keyCash);
  const incomeText = showIncome ? incomeOf(r.rate) : undefined;
  return (
    <Stat label={t('term.cash')} icon={icons ? 'cash' : undefined} panel="cash" target="shell.cash" testID="res-cash" a11y={`${fmtCash(r.v)}${incomeText ? ` ${incomeText}` : ''}`}>
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

function ComputeStat({ icons }: { icons: boolean }) {
  const v = useKeyedSelector(selCompute, fmtCompact);
  return (
    <Stat label={t('term.compute')} icon={icons ? 'compute' : undefined} panel="model" target="shell.compute" testID="res-compute" a11y={fmtCompact(v)}>
      <CountingNumber value={v} format={fmtCompact} style={styles.value} />
    </Stat>
  );
}

/**
 * The model readout: the tier running now. When the player owns a better model than the
 * compute lets them run, the label says so ("owns 5 · needs compute") in the bad colour and a
 * badge marks the figure; tapping opens the explanation with the numbers.
 */
function TierStat({ icons, roomy }: { icons: boolean; roomy: boolean }) {
  const m = useModelStatus();
  const stuck = isStuck(m);
  // "owns 5 · needs compute" where the strip has room, "owns 5" and the badge where it does not.
  const label = stuck ? t(roomy ? 'ui.strip.owns' : 'ui.strip.ownsShort', { tier: m.owned }) : t('term.capability');
  const a11y = stuck ? `${fmtTier(m.running)}. ${t('ui.explain.model.stuck', { owned: m.owned, required: needText(m.required), compute: haveText(m.compute) })}` : fmtTier(m.running);
  return (
    <Stat label={label} icon={icons ? 'tier' : undefined} panel="model" target="shell.tier" testID="res-tier" a11y={a11y} warn={stuck}>
      <View style={styles.valueRow}>
        <CountingNumber value={m.running} format={fmtTier} style={[styles.value, styles.tier]} color={colors.playerText} />
        {stuck ? (
          <View style={styles.badge} testID="tier-badge">
            <Text style={styles.badgeText}>!</Text>
          </View>
        ) : null}
      </View>
    </Stat>
  );
}

function MeterSlot({ meter, ...rest }: { meter: keyof typeof meterSelectors; label: string; shortLabel: string; icon: IconName; color: string; tag: string | null; testID: string }) {
  const value = useKeyedSelector(meterSelectors[meter], keyMeter);
  return <StripMeter value={value} {...rest} />;
}

interface StatProps {
  label: string;
  a11y: string;
  children: ReactNode;
  icon?: IconName;
  /** Panel the figure opens when tapped. */
  panel?: StripPanel;
  /** The label is a warning (bad colour). */
  warn?: boolean;
  target?: string;
  testID?: string;
}

function Stat({ label, a11y, children, icon, panel, warn, target, testID }: StatProps) {
  const tutorialRef = useTutorialTarget(target ?? null);
  const show = useStripPanel((s) => s.show);
  const labelStyle = [styles.statLabel, warn && styles.statWarn];
  return (
    <Pressable
      style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
      ref={tutorialRef}
      testID={testID}
      onPress={panel ? () => show(panel) : undefined}
      disabled={!panel}
      accessibilityRole={panel ? 'button' : undefined}
      accessibilityLabel={`${label} ${a11y}`}
      accessibilityHint={panel ? t('ui.strip.tapHint') : undefined}
    >
      {icon ? <Icon name={icon} size={16} color={colors.dim} accent={warn ? colors.bad : colors.player} /> : null}
      <View style={styles.statText}>
        <Text style={labelStyle} numberOfLines={1}>
          {label}
        </Text>
        {children}
      </View>
    </Pressable>
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
    paddingBottom: shape.composure === 'tape' ? TAPE : 0,
    backgroundColor: colors.chrome,
  },
  stripTight: { gap: 6, paddingLeft: spacing.xs + 2, paddingRight: spacing.xs + 2 },
  // Wide enough that the day number ("Day 3600") never clips; the lab name gives way first.
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1, minWidth: 104, maxWidth: 196 },
  // Blueprint: the lab sits in a drawing's title block.
  brandBox: (shape.panel === 'ticks' ? { borderWidth: shape.hairline, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, marginVertical: 4, alignSelf: 'stretch' } : {}) as ViewStyle,
  title: { flexShrink: 1, minWidth: 0 },
  name: { ...voice.calmHeading, color: colors.text, fontSize: shape.capsHeadings ? (shape.panel === 'clip' ? 19 : 13) : 15, lineHeight: shape.panel === 'clip' ? 20 : 17 },
  day: { ...voice.calmLabel, color: shape.panel === 'clip' ? colors.playerText : colors.dim, lineHeight: 12, fontVariant: ['tabular-nums'] },
  rule: { width: shape.hairline, alignSelf: 'stretch', marginVertical: 8, backgroundColor: colors.border, opacity: sticker ? 0 : 1 },
  stats: { flexDirection: 'row', gap: shape.panel === 'clip' ? 12 : 10, flexShrink: 0 },
  // Candy: resources and meters are two stickers.
  group: (sticker
    ? { backgroundColor: colors.surface, borderWidth: shape.outline, borderColor: colors.outline, borderRadius: radius.s, paddingHorizontal: 10, paddingVertical: 1, marginVertical: 3, alignSelf: 'stretch', ...flatShadow(2) }
    : {}) as ViewStyle,
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'stretch' },
  statText: { justifyContent: 'center', gap: 1 },
  pressed: { opacity: 0.6 },
  statWarn: { color: colors.bad },
  badge: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.alarm, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  badgeText: { ...voice.bodyStrong, color: colors.newsPaper, fontSize: 10, lineHeight: 12 },
  statLabel: { ...voice.calmLabel, color: colors.dim, fontSize: 9.5, lineHeight: 11, letterSpacing: voice.calmLabel.letterSpacing },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  value: { ...voice.calmNumber, color: colors.text, fontSize: shape.panel === 'clip' ? 19 : shape.panel === 'ticks' ? 15 : 16, lineHeight: shape.panel === 'clip' ? 20 : 19 },
  tier: { color: colors.playerText },
  sub: { ...voice.body, fontSize: 10, fontVariant: ['tabular-nums'] },
  // The lab name gives way before the meters do.
  statsBox: { justifyContent: 'center', flexShrink: 0 },
  metersBox: { flex: 1, minWidth: METERS_MIN, justifyContent: 'center' },
  meters: { flexDirection: 'row', gap: spacing.s + 2 },
  tape: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  composureRule: { position: 'absolute', left: 0, right: 0, bottom: shape.composure === 'tape' ? TAPE : 0 },
});
