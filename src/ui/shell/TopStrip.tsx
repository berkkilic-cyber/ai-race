import type { ReactNode } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtCash, fmtCompact, fmtDay, fmtPerDay } from '../format';
import { useMeters, useResources } from '../hooks/useGame';
import { labName, t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, layout, radius, spacing, tabular, type } from '../theme';
import { StripMeter } from './StripMeter';

/** Smallest meter width that still shows a full label like "Regulation" at the strip's label size. */
const METER_MIN = 56;

/** Below this strip width the cash income sub-label is dropped so nothing wraps or clips. */
const ROOM_FOR_INCOME = 880;

/**
 * Wide-mode header: one ~40 high row with lab name and day, compact resource pills,
 * compact meters and the speed control (passed in so the shell decides what goes right).
 */
export function TopStrip({ right }: { right?: ReactNode }) {
  const name = useGameStore((s) => (s.state ? labName(s.state.labs[s.state.playerLabId]) : ''));
  const tick = useGameStore((s) => s.state?.tick ?? 0);
  const r = useResources();
  const m = useMeters();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stripWidth = width - insets.left - insets.right - layout.railWidth;
  const income = r.cashPerDay;
  const incomeText = stripWidth >= ROOM_FOR_INCOME ? fmtPerDay(`${income >= 0 ? '+' : ''}${fmtCash(income)}`) : undefined;

  return (
    <View style={styles.strip}>
      <View style={styles.title}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.day} numberOfLines={1}>
          {fmtDay(tick)}
        </Text>
      </View>
      <View style={styles.pills}>
        <Pill label={t('term.hype')} value={fmtCompact(r.hype)} color={colors.info} testID="res-hype" />
        <Pill label={t('term.cash')} value={fmtCash(r.cash)} sub={incomeText} subColor={income >= 0 ? colors.good : colors.bad} color={colors.good} testID="res-cash" />
        <Pill label={t('term.compute')} value={fmtCompact(r.compute)} testID="res-compute" />
        <Pill label={t('term.capability')} value={t('ui.resource.tier', { tier: r.tier })} color={colors.player} testID="res-tier" />
      </View>
      <View style={styles.meters}>
        <StripMeter label={t('term.regulation')} value={m.regulation} color={colors.info} testID="meter-regulation" />
        <StripMeter label={t('term.backlash')} value={m.backlash} color={colors.bad} testID="meter-backlash" />
        <StripMeter label={t('term.rival')} value={m.rival} color={colors.player} testID="meter-rival" />
      </View>
      {right}
    </View>
  );
}

function Pill({ label, value, sub, subColor, color = colors.text, testID }: { label: string; value: string; sub?: string; subColor?: string; color?: string; testID?: string }) {
  return (
    <View style={styles.pill} testID={testID} accessibilityLabel={`${label} ${value}${sub ? ` ${sub}` : ''}`}>
      <Text style={styles.pillLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text style={[styles.pillValue, { color }]} numberOfLines={1}>
          {value}
        </Text>
        {sub ? (
          <Text style={[styles.pillSub, { color: subColor }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    height: layout.stripHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.s,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: { flexShrink: 1, minWidth: 64, maxWidth: 140 },
  name: { color: colors.text, fontSize: type.s, fontWeight: '800' },
  day: { color: colors.dim, fontSize: type.xs, ...tabular },
  pills: { flexDirection: 'row', gap: spacing.xs, flexShrink: 0 },
  pill: {
    height: layout.stripHeight - spacing.s,
    justifyContent: 'center',
    paddingHorizontal: spacing.s,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillLabel: { color: colors.dim, fontSize: type.xs - 1, lineHeight: type.xs + 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  pillValue: { fontSize: type.s, lineHeight: type.s + 3, fontWeight: '700', ...tabular },
  pillSub: { fontSize: type.xs - 1, ...tabular },
  // The lab name gives way before the meters do.
  meters: { flex: 1, minWidth: 3 * METER_MIN + 2 * spacing.s, flexDirection: 'row', gap: spacing.s, paddingHorizontal: spacing.xs },
});
