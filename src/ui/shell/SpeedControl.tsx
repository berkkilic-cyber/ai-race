import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../i18n';
import { SPEEDS, useGameStore } from '../store/game';
import { colors, flatShadow, layout, radius, shape, touch, voice } from '../theme';
import { useTutorialTarget } from '../tutorial/targets';

/** Extra hit area so each compact button still takes a 44-point touch. */
const SLOP = Math.ceil((touch - layout.speedButton) / 2);
const SEGMENT = 28;
/** Soft themes fill the active speed with ink; the others with the player's colour. */
const SELECTED_BG = shape.panel === 'plain' ? colors.text : colors.player;
const SELECTED_FG = shape.panel === 'plain' ? colors.bg : colors.onPlayer;

/** Pause glyph drawn from two bars (no font glyph, so it matches every face). */
function PauseGlyph({ color }: { color: string }) {
  return (
    <View style={styles.pause}>
      <View style={[styles.bar, { backgroundColor: color }]} />
      <View style={[styles.bar, { backgroundColor: color }]} />
    </View>
  );
}

/** Pause / 1x / 2x / 3x as one quiet outlined pill; the active segment is filled with ink. */
export function SpeedControl() {
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const tutorialRef = useTutorialTarget('shell.speed');
  return (
    <View style={styles.pill} ref={tutorialRef}>
      {SPEEDS.map((s) => {
        const selected = speed === s;
        const label = s === 0 ? t('ui.speed.pause') : t('ui.speed.play', { speed: s });
        const fg = selected ? SELECTED_FG : colors.dim;
        return (
          <Pressable
            key={s}
            onPress={() => setSpeed(s)}
            hitSlop={{ top: SLOP, bottom: SLOP, left: 1, right: 1 }}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.btn, selected && styles.selected, pressed && !selected && styles.pressed]}
            testID={`speed-${s}`}
          >
            {s === 0 ? <PauseGlyph color={fg} /> : <Text style={[styles.label, { color: fg }]}>{label}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    flexShrink: 0,
    padding: 2,
    gap: 1,
    borderRadius: radius.pill,
    borderWidth: shape.panel === 'sticker' ? shape.outline : shape.hairline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    backgroundColor: shape.panel === 'sticker' ? colors.surface : colors.transparent,
    ...flatShadow(2),
  },
  btn: { width: SEGMENT, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: SELECTED_BG },
  pressed: { backgroundColor: colors.raised, transform: [{ scale: 0.94 }] },
  label: { ...voice.calmNumber, fontSize: 12, lineHeight: 14 },
  pause: { flexDirection: 'row', gap: 2.5 },
  bar: { width: 2.5, height: 9, borderRadius: 1 },
});
