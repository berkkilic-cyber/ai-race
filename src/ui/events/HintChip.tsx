import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { colors, radius, spacing, type } from '../theme';
import { HINT_LABEL_KEYS, type EffectHint } from './hints';

/** Direction-only chip: an arrow and the thing that moves, green when good for the player, red when bad. */
export const HintChip = memo(function HintChip({ hint, muted }: { hint: EffectHint; muted?: boolean }) {
  const subject = t(HINT_LABEL_KEYS[hint.subject]);
  const color = muted ? colors.dim : hint.good ? colors.good : colors.bad;
  return (
    <View
      style={[styles.chip, { borderColor: color }]}
      accessibilityLabel={t(hint.dir === 'up' ? 'ui.events.hint.up' : 'ui.events.hint.down', { subject })}
    >
      <Text style={[styles.arrow, { color }]}>{hint.dir === 'up' ? '▲' : '▼'}</Text>
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {subject}
      </Text>
    </View>
  );
});

/** Amber "Risky" tag for choices with a gamble. */
export function RiskTag({ muted }: { muted?: boolean }) {
  const color = muted ? colors.dim : colors.player;
  return (
    <View style={[styles.chip, styles.risk, { borderColor: color }]}>
      <Text style={[styles.text, styles.riskText, { color }]}>{t('ui.events.risky')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.s,
    paddingVertical: 2,
    backgroundColor: colors.bg,
  },
  arrow: { fontSize: 8, fontWeight: '900' },
  text: { fontSize: type.xs, fontWeight: '700' },
  risk: { borderStyle: 'dashed' },
  riskText: { textTransform: 'uppercase', letterSpacing: 0.5 },
});
