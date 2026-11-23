import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, radius, spacing, type, voice } from '../theme';
import type { DifficultyOption } from './difficulty';

export interface DifficultyPickerProps {
  options: readonly DifficultyOption[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  /** The options side by side in one row (landscape). */
  wide?: boolean;
  /** Right of the "Difficulty" label (the Lab Rep perks chip on wide screens). */
  headerRight?: ReactNode;
}

/** Compact difficulty choice on the founder step: one small card per level, easiest first. */
export function DifficultyPicker({ options, selected, onSelect, wide, headerRight }: DifficultyPickerProps) {
  if (options.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label} accessibilityRole="header">
          {t('ui.difficulty.title')}
        </Text>
        {headerRight ? <View style={styles.headRight}>{headerRight}</View> : null}
      </View>
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
  wrap: { gap: 2 },
  label: { ...voice.calmLabel, color: colors.dim },
  labelRow: { flexDirection: 'row', alignItems: 'flex-end' },
  // Out of the flow, so the row stays one label high and the founder cards keep their height.
  headRight: { position: 'absolute', right: 0, bottom: -2, left: 120, flexDirection: 'row', justifyContent: 'flex-end' },
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
  optionWide: { flex: 1, paddingHorizontal: spacing.s, paddingVertical: spacing.xs },
  optionOn: { borderColor: colors.player, backgroundColor: colors.raised },
  pressed: { opacity: 0.85 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.s },
  name: { ...voice.calmHeading, color: colors.text, fontSize: type.s, flexShrink: 1 },
  nameOn: { color: colors.playerText },
  score: { color: colors.dim, fontSize: type.xs },
  desc: { color: colors.dim, fontSize: type.xs, lineHeight: 14 },
});
