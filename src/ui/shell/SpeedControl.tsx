import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { SPEEDS, useGameStore } from '../store/game';
import { colors, layout, radius, spacing, touch, type } from '../theme';

/** Extra hit area so each compact button still takes a 44-point touch. */
const SLOP = Math.ceil((touch - layout.speedButton) / 2);

/** Compact pause / 1x / 2x / 3x segmented control for the wide top strip. */
export function SpeedControl() {
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);
  return (
    <View style={styles.row}>
      {SPEEDS.map((s) => {
        const selected = speed === s;
        const label = s === 0 ? t('ui.speed.pause') : t('ui.speed.play', { speed: s });
        return (
          <Pressable
            key={s}
            onPress={() => setSpeed(s)}
            hitSlop={{ top: SLOP, bottom: SLOP, left: 1, right: 1 }}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.btn, selected && styles.selected, pressed && styles.pressed]}
            testID={`speed-${s}`}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{s === 0 ? '❚❚' : label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2, flexShrink: 0 },
  btn: {
    width: layout.speedButton,
    height: layout.speedButton,
    borderRadius: radius.s,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  selected: { backgroundColor: colors.player },
  pressed: { opacity: 0.8 },
  label: { color: colors.text, fontSize: type.xs, fontWeight: '700' },
  labelSelected: { color: colors.onPlayer },
});
