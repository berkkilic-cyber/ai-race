import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { t } from '../i18n';
import { Text } from '../locale/Text';
import { upper } from '../locale/casing';
import { useWide } from '../events/useWide';
import { useInsets } from '../hooks/useInsets';
import { wideShellLayout } from '../shell/shellLayout';
import { useGameStore } from '../store/game';
import { useTutorialStore } from '../tutorial/store';
import { colors, layer, layout, radius, spacing, type, voice } from '../theme';
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

  // Wide: drops in from under the top strip; narrow: rises from above the tab bar.
  const style = useAnimatedStyle(() => ({ opacity: v.get(), transform: [{ translateY: (1 - v.get()) * (wide ? -24 : 60) }] }));
  if (!def) return null;
  const secret = def.secret;
  return (
    <Animated.View style={[styles.toast, wide && styles.toastWide, secret ? styles.secret : styles.normal, style]} testID="achievement-toast">
      <Pressable style={[styles.inner, wide && styles.innerWide]} onPress={() => onDone(toast.key)} accessibilityRole="alert">
        <View style={[styles.badge, secret ? styles.badgeSecret : styles.badgeNormal]}>
          <Text style={styles.badgeText}>{secret ? '?' : '★'}</Text>
        </View>
        <View style={styles.texts}>
          <Text style={[styles.kicker, { color: secret ? colors.info : colors.playerText }]}>
            {upper(t(secret ? 'ui.achievements.secretFound' : 'ui.achievements.unlocked'))}
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
 * Waits while an event card or its result, or a tutorial coach mark, is up. Mount once in the game shell.
 */
export function ToastHost() {
  const insets = useInsets();
  const wide = useWide();
  const { width, height } = useWindowDimensions();
  const [queue, setQueue] = useState<ToastQueue>(EMPTY_QUEUE);
  const eventUp = useGameStore((s) => !!s.state?.pendingEvent || s.eventResult !== null);
  // Toasts also wait while a tutorial coach mark is up.
  const coaching = useTutorialStore((s) => s.showing);
  const blocked = eventUp || coaching;

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
    // Wide: a narrow card at the top centre of the main column (right of the rail, left of
    // the right inset), clear of the speed control at the top right.
    <View style={[styles.host, hostFrame(wide, width, height, insets)]} pointerEvents="box-none">
      <AchievementToast key={current.key} toast={current} onDone={onDone} wide={wide} />
    </View>
  );
}

/**
 * Where the toast sits: never over the resource figures and meters. Wide: just under the top
 * strip, centred in the main column. Narrow (the header is three rows of numbers): at the
 * bottom, above the ticker and the tab bar.
 */
function hostFrame(wide: boolean, width: number, height: number, insets: ReturnType<typeof useInsets>) {
  if (!wide) return { bottom: insets.bottom + NARROW_BOTTOM, left: insets.left + spacing.m, right: insets.right + spacing.m };
  const main = wideShellLayout(width, height, insets).main;
  return { top: main.top + layout.stripHeight + spacing.s, left: main.left + spacing.s, right: main.right + spacing.s };
}

/** Narrow mode: room for the tab bar and the ticker under the toast. */
const NARROW_BOTTOM = 44 + 28 + spacing.l;

const styles = StyleSheet.create({
  // Above the shell, below the tutorial and the event card (and hidden while a card is up).
  host: { position: 'absolute', alignItems: 'center', zIndex: layer.toast, elevation: layer.toast },
  toast: { width: '100%', maxWidth: 440, borderRadius: radius.l, borderWidth: 2, backgroundColor: colors.raised },
  normal: { borderColor: colors.player },
  secret: { borderColor: colors.info, borderStyle: 'dashed', backgroundColor: colors.surface },
  toastWide: { maxWidth: 340 },
  innerWide: { paddingVertical: 6, gap: spacing.s },
  inner: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, padding: spacing.m },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badgeNormal: { backgroundColor: colors.player },
  badgeSecret: { backgroundColor: colors.info },
  badgeText: { color: colors.onPlayer, fontSize: type.l, fontWeight: '900' },
  texts: { flex: 1, gap: 1 },
  kicker: { fontSize: type.xs, fontWeight: '900', letterSpacing: 1.2 },
  name: { ...voice.calmHeading, color: colors.text, fontSize: type.m + 1 },
  desc: { color: colors.dim, fontSize: type.s },
});
