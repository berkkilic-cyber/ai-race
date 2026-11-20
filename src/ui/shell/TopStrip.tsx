import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountingNumber } from '../components/CountingNumber';
import { dangerKey, useComposure, useComposureProgress } from '../composure';
import { fmtCash, fmtCompact, fmtDay, fmtPerDay } from '../format';
import { useMeters, useResources } from '../hooks/useGame';
import { labName, t } from '../i18n';
import { Mascot, useMascotMood } from '../mascot';
import { useGameStore } from '../store/game';
import { colors, layout, spacing, voice } from '../theme';
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
  const tick = useGameStore((s) => s.state?.tick ?? 0);
  const r = useResources();
  const m = useMeters();
  const mood = useMascotMood();
  const composure = useComposure();
  const progress = useComposureProgress();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stripWidth = width - insets.left - insets.right - layout.railWidth;
  const income = r.cashPerDay;
  const incomeText = stripWidth >= ROOM_FOR_INCOME ? fmtPerDay(`${income >= 0 ? '+' : ''}${fmtCash(income)}`) : undefined;
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
        <Mascot mood={mood} size={26} testID="mascot" />
        <View style={styles.title}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.day} numberOfLines={1}>
            {fmtDay(tick)}
          </Text>
        </View>
      </View>
      <View style={styles.rule} />
      <View style={styles.stats}>
        <Stat label={t('term.hype')} testID="res-hype" a11y={fmtCompact(r.hype)}>
          <CountingNumber value={r.hype} format={fmtCompact} notable={Math.max(2, Math.abs(r.hypePerDay) * 3)} style={styles.value} />
        </Stat>
        <Stat label={t('term.cash')} testID="res-cash" a11y={`${fmtCash(r.cash)}${incomeText ? ` ${incomeText}` : ''}`}>
          <View style={styles.valueRow}>
            <CountingNumber value={r.cash} format={fmtCash} notable={Math.max(1, Math.abs(income) * 3)} style={styles.value} />
            {incomeText ? (
              <Text style={[styles.sub, { color: income >= 0 ? colors.goodText : colors.bad }]} numberOfLines={1}>
                {incomeText}
              </Text>
            ) : null}
          </View>
        </Stat>
        <Stat label={t('term.compute')} testID="res-compute" a11y={fmtCompact(r.compute)}>
          <CountingNumber value={r.compute} format={fmtCompact} style={styles.value} />
        </Stat>
        <Stat label={t('term.capability')} testID="res-tier" a11y={fmtTier(r.tier)}>
          <CountingNumber value={r.tier} format={fmtTier} style={[styles.value, styles.tier]} color={colors.playerText} />
        </Stat>
      </View>
      <View style={styles.rule} />
      <View style={styles.meters}>
        <StripMeter label={t('term.regulation')} value={m.regulation} color={colors.info} tag={tagFor('regulation')} testID="meter-regulation" />
        <StripMeter label={t('term.backlash')} value={m.backlash} color={colors.alarm} tag={tagFor('backlash')} testID="meter-backlash" />
        <StripMeter label={t('term.rival')} value={m.rival} color={colors.amber} tag={tagFor('rival')} testID="meter-rival" />
      </View>
      {right}
      <Animated.View style={[styles.composureRule, ruleStyle]} pointerEvents="none" testID="composure-rule" />
    </View>
  );
}

function Stat({ label, a11y, children, testID }: { label: string; a11y: string; children: ReactNode; testID?: string }) {
  return (
    <View style={styles.stat} testID={testID} accessibilityLabel={`${label} ${a11y}`}>
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
