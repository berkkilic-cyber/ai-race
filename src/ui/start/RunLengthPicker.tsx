import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { colors, radius, spacing, type, voice } from '../theme';
import type { RunLengthOption } from './runLength';

export interface RunLengthPickerProps {
  options: readonly RunLengthOption[];
  selected: string | undefined;
  onSelect: (id: string) => void;
  /** Landscape: a narrow column beside the difficulty picker (name and minutes only). */
  wide?: boolean;
}

/** Sprint / Full run choice on the founder step, beside the difficulty picker, with the minutes shown. */
export function RunLengthPicker({ options, selected, onSelect, wide }: RunLengthPickerProps) {
  if (options.length === 0) return null;
  return (
    <View style={[styles.wrap, wide && styles.wrapWide]}>
      <Text style={styles.label} accessibilityRole="header">
        {t('ui.sprint.length.title')}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('ui.sprint.length.title')} style={[styles.list, !wide && styles.listRow]}>
        {options.map((o) => {
          const on = selected === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => onSelect(o.id)}
              style={({ pressed }) => [styles.option, !wide && styles.optionRow, on && styles.optionOn, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, checked: on }}
              accessibilityLabel={`${o.name}, ${o.minutes}. ${o.desc} ${o.score}`}
              testID={`runlength-${o.id}`}
            >
              <View style={styles.head}>
                <Text style={[styles.name, on && styles.nameOn]} numberOfLines={1}>
                  {o.name}
                </Text>
                <Text style={[styles.minutes, on && styles.minutesOn]} numberOfLines={1}>
                  {o.minutes}
                </Text>
              </View>
              {wide ? null : (
                <Text style={styles.desc} numberOfLines={2}>
                  {o.desc}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  wrapWide: { width: 172 },
  label: { ...voice.calmLabel, color: colors.dim },
  list: { gap: spacing.xs },
  listRow: { flexDirection: 'row', gap: spacing.s },
  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    gap: 2,
    minHeight: 30,
    justifyContent: 'center',
  },
  optionRow: { flex: 1, paddingHorizontal: spacing.m, paddingVertical: spacing.s },
  optionOn: { borderColor: colors.player, backgroundColor: colors.raised },
  pressed: { opacity: 0.85 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.s },
  name: { ...voice.calmHeading, color: colors.text, fontSize: type.s, flexShrink: 1 },
  nameOn: { color: colors.playerText },
  minutes: { color: colors.dim, fontSize: type.xs, fontWeight: '600' },
  minutesOn: { color: colors.text },
  desc: { color: colors.dim, fontSize: type.xs, lineHeight: 14 },
});
