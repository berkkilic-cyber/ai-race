import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { colors, spacing, voice } from '../theme';
import { HINT_LABEL_KEYS, type EffectHint } from './hints';

/**
 * Direction-only chip: an arrow and the thing that moves, green when good for the
 * player, red when bad. Hard-edged newsprint label (it sits on an ink choice button).
 */
export const HintChip = memo(function HintChip({ hint, muted }: { hint: EffectHint; muted?: boolean }) {
  const subject = t(HINT_LABEL_KEYS[hint.subject]);
  const color = muted ? colors.newsDim : hint.good ? colors.newsGood : colors.newsRed;
  return (
    <View
      style={[styles.chip, muted && styles.chipMuted]}
      accessibilityLabel={t(hint.dir === 'up' ? 'ui.events.hint.up' : 'ui.events.hint.down', { subject })}
    >
      <Text style={[styles.arrow, { color }]}>{hint.dir === 'up' ? '▲' : '▼'}</Text>
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {subject}
      </Text>
    </View>
  );
});

/** "Risky" as a rotated red stamp for choices with a gamble. */
export function RiskTag({ muted }: { muted?: boolean }) {
  return (
    <View style={[styles.stamp, muted && styles.stampMuted]}>
      <Text style={[styles.stampText, muted && styles.stampTextMuted]}>{t('ui.events.risky')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: colors.newsPaper,
  },
  chipMuted: { backgroundColor: colors.newsWash },
  arrow: { fontSize: 8 },
  text: { ...voice.loudKicker, fontSize: 12, lineHeight: 15, letterSpacing: 0.6 },
  stamp: {
    marginLeft: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderWidth: 2,
    borderColor: colors.newsRed,
    backgroundColor: colors.newsRed,
    transform: [{ rotate: '-6deg' }],
  },
  stampMuted: { backgroundColor: colors.newsWash, borderColor: colors.newsRed },
  stampText: { ...voice.loudKicker, fontSize: 12, lineHeight: 15, letterSpacing: 1.6, color: colors.newsPaper },
  stampTextMuted: { color: colors.newsRed },
});
