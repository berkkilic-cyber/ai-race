import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '../i18n';
import { useWide } from '../events/useWide';
import { useGameStore } from '../store/game';
import { colors, radius, spacing, type } from '../theme';
import { currentToast, dismissToast, EMPTY_QUEUE, enqueueToasts, newAchievementIds, type Toast, type ToastQueue } from './queue';

/** How long a toast stays up. */
export const TOAST_MS = 3000;
const EXIT_MS = 220;

function AchievementToast({ toast, onDone, wide }: { toast: Toast; onDone: (key: number) => void; wide: boolean }) {
  const def = useGameStore((s) => s.pack.achievements.find((a) => a.id === toast.achievementId));
  const v = useSharedValue(0);

  useEffect(() => {
    v.set(withSpring(1, { damping: 15, stiffness: 180 }));
    const hide = setTimeout(() => v.set(withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad) })), TOAST_MS);
    const done = setTimeout(() => onDone(toast.key), TOAST_MS + EXIT_MS);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [toast.key, onDone, v]);

  const style = useAnimatedStyle(() => ({ opacity: v.get(), transform: [{ translateY: (1 - v.get()) * -80 }] }));
  if (!def) return null;
  const secret = def.secret;
  return (
    <Animated.View style={[styles.toast, wide && styles.toastWide, secret ? styles.secret : styles.normal, style]} testID="achievement-toast">
      <Pressable style={[styles.inner, wide && styles.innerWide]} onPress={() => onDone(toast.key)} accessibilityRole="alert">
        <View style={[styles.badge, secret ? styles.badgeSecret : styles.badgeNormal]}>
          <Text style={styles.badgeText}>{secret ? '?' : '★'}</Text>
        </View>
        <View style={styles.texts}>
          <Text style={[styles.kicker, { color: secret ? colors.info : colors.player }]}>
            {t(secret ? 'ui.achievements.secretFound' : 'ui.achievements.unlocked').toUpperCase()}
          </Text>
          <Text style={styles.name} numberOfLines={1}>
            {t(def.nameKey)}
          </Text>
          <Text style={styles.desc} numberOfLines={wide ? 1 : 2}>
            {t(def.descKey)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Shows a toast at the top for each achievement the player earns, one at a time.
 * Waits while an event card or its result is up. Mount once in the game shell.
 */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const [queue, setQueue] = useState<ToastQueue>(EMPTY_QUEUE);
  const blocked = useGameStore((s) => !!s.state?.pendingEvent || s.eventResult !== null);

  useEffect(
    () =>
      useGameStore.subscribe((s, prev) => {
        if (s.state === prev.state) return;
        if (!s.state || !prev.state || s.state.seed !== prev.state.seed) {
          // New run or no run: drop what is waiting.
          setQueue(EMPTY_QUEUE);
          return;
        }
        const ids = newAchievementIds(prev.state.achievements, s.state.achievements);
        if (ids.length) setQueue((q) => enqueueToasts(q, ids));
      }),
    [],
  );

  const [onDone] = useState(() => (key: number) => setQueue((q) => dismissToast(q, key)));

  const current = currentToast(queue, blocked);
  if (!current) return null;
  return (
    // Wide: a narrow card at the top centre, clear of the speed control at the top right.
    <View style={[styles.host, wide && styles.hostWide, { top: insets.top + (wide ? spacing.xs : spacing.s) }]} pointerEvents="box-none">
      <AchievementToast key={current.key} toast={current} onDone={onDone} wide={wide} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.m, right: spacing.m, alignItems: 'center' },
  hostWide: { left: 0, right: 0 },
  toast: { width: '100%', maxWidth: 440, borderRadius: radius.l, borderWidth: 2, backgroundColor: colors.raised },
  normal: { borderColor: colors.player },
  secret: { borderColor: colors.info, borderStyle: 'dashed', backgroundColor: colors.surface },
  toastWide: { maxWidth: 380 },
  innerWide: { paddingVertical: spacing.s },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, padding: spacing.m },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badgeNormal: { backgroundColor: colors.player },
  badgeSecret: { backgroundColor: colors.info },
  badgeText: { color: colors.onPlayer, fontSize: type.l, fontWeight: '900' },
  texts: { flex: 1, gap: 1 },
  kicker: { fontSize: type.xs, fontWeight: '900', letterSpacing: 1.2 },
  name: { color: colors.text, fontSize: type.m, fontWeight: '800' },
  desc: { color: colors.dim, fontSize: type.s },
});
