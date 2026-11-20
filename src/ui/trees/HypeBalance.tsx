import { StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { getIncome } from '@/engine';

import { fmtCompact, fmtPerDay } from '../format';
import { t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, flatShadow, radius, shape, spacing, tabular, type, voice } from '../theme';

/** Current Hype and Hype per day, compact. Re-renders only when the shown figures change. */
export function HypeBalance() {
  const [hype, perDay] = useGameStore(
    useShallow((s) => {
      if (!s.state) return ['0', '0'];
      const id = s.state.playerLabId;
      return [fmtCompact(s.state.labs[id].hype), fmtCompact(getIncome(s.state, s.pack, id).hype)];
    }),
  );
  return (
    <View style={styles.box} testID="trees-hype" accessibilityLabel={`${t('term.hype')} ${hype}, ${fmtPerDay(`+${perDay}`)}`}>
      <Text style={styles.label}>{t('term.hype')}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {hype}
        <Text style={styles.sub}>{`  ${fmtPerDay(`+${perDay}`)}`}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minWidth: 96,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.s,
    borderRadius: radius.s,
    borderWidth: shape.panel === 'plain' ? 1 : shape.outline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    backgroundColor: colors.surface,
    ...flatShadow(2),
  },
  label: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs },
  value: { ...(shape.panel === 'plain' ? { fontWeight: '800' as const } : voice.calmNumber), color: colors.info, fontSize: type.m, lineHeight: 18, ...tabular },
  sub: { ...voice.body, color: colors.dim, fontSize: type.xs, ...tabular },
});
