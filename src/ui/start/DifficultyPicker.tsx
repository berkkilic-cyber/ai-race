import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { colors, radius, spacing, type, voice } from '../theme';
import type { DifficultyOption } from './difficulty';

export interface DifficultyPickerProps {
  options: readonly DifficultyOption[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  /** The options side by side in one row (landscape). */
  wide?: boolean;
}

/** Compact difficulty choice on the founder step: one small card per level, easiest first. */
export function DifficultyPicker({ options, selected, onSelect, wide }: DifficultyPickerProps) {
  if (options.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label} accessibilityRole="header">
        {t('ui.difficulty.title')}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('ui.difficulty.title')} style={[styles.list, wide && styles.listWide]}>
        {options.map((o) => {
          const on = selected === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => onSelect(o.id)}
              style={({ pressed }) => [styles.option, wide && styles.optionWide, on && styles.optionOn, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${o.name}. ${o.desc} ${o.score}`}
              testID={`difficulty-${o.id}`}
            >
              <View style={styles.head}>
                <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
                  {o.name}
                </Text>
                <Text style={styles.score} numberOfLines={1}>
                  {o.score}
                </Text>
              </View>
              <Text style={styles.desc} numberOfLines={wide ? 2 : 3}>
                {o.desc}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...voice.calmLabel, color: colors.dim },
  list: { gap: spacing.s },
  listWide: { flexDirection: 'row' },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    gap: 2,
  },
  optionWide: { flex: 1, paddingHorizontal: spacing.s, paddingVertical: spacing.xs + 2 },
  optionOn: { borderColor: colors.player, backgroundColor: colors.raised },
  pressed: { opacity: 0.85 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.s },
  name: { ...voice.calmHeading, color: colors.text, fontSize: type.s, flexShrink: 1 },
  nameOn: { color: colors.playerText },
  score: { color: colors.dim, fontSize: type.xs },
  desc: { color: colors.dim, fontSize: type.xs, lineHeight: 14 },
});
