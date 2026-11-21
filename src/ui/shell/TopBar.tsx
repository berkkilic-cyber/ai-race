import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { fmtDay } from '../format';
import { labName, t } from '../i18n';
import { DEBUG_LONG_PRESS_MS } from '../diagnostics/BuildStamp';
import { toggleTouchDebug } from '../map/touchDebug';
import { Mascot, useMascotMood } from '../mascot';
import { SPEEDS, useGameStore } from '../store/game';
import { colors, spacing, tabular, type, voice } from '../theme';
import { useTutorialTarget } from '../tutorial/targets';

/** Lab name, day counter and the speed control. */
export function TopBar() {
  const name = useGameStore((s) => (s.state ? labName(s.state.labs[s.state.playerLabId]) : ''));
  const tick = useGameStore((s) => s.state?.tick ?? 0);
  const speed = useGameStore((s) => s.speed);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const mood = useMascotMood();
  const speedRef = useTutorialTarget('shell.speed');
  return (
    <View style={styles.bar}>
      <Pressable onLongPress={toggleTouchDebug} delayLongPress={DEBUG_LONG_PRESS_MS} accessible={false}>
          <Mascot mood={mood} size={30} testID="mascot" />
        </Pressable>
      <View style={styles.title}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.day}>{fmtDay(tick)}</Text>
      </View>
      <View style={styles.speeds} ref={speedRef}>
        {SPEEDS.map((s) => (
          <Button
            key={s}
            label={s === 0 ? '❚❚' : t('ui.speed.play', { speed: s })}
            accessibilityLabel={s === 0 ? t('ui.speed.pause') : t('ui.speed.play', { speed: s })}
            compact
            selected={speed === s}
            onPress={() => setSpeed(s)}
            style={styles.speed}
            testID={`speed-${s}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.m, paddingVertical: spacing.xs, gap: spacing.s },
  title: { flex: 1, minWidth: 0 },
  name: { ...voice.calmHeading, color: colors.text, fontSize: type.l },
  day: { color: colors.dim, fontSize: type.s, ...tabular },
  speeds: { flexDirection: 'row', gap: spacing.xs },
  speed: { width: 44, paddingHorizontal: 0 },
});
