import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { garageContent } from '../garage/content';
import { gt } from '../garage/text';
import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { upper } from '../locale/casing';
import { colors, layer, radius, spacing, type, voice } from '../theme';
import { startMissions } from './install';
import { useMissionsStore, type MissionToast as Toast } from './store';

export const MISSION_TOAST_MS = 2800;
const EXIT_MS = 200;

function ToastCard({ toast }: { toast: Toast }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withSpring(1, { damping: 16, stiffness: 180 }));
    const hide = setTimeout(() => v.set(withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad) })), MISSION_TOAST_MS);
    const done = setTimeout(() => useMissionsStore.getState().dismissToast(toast.key), MISSION_TOAST_MS + EXIT_MS);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [toast.key, v]);
  const style = useAnimatedStyle(() => ({
    opacity: v.get(),
    transform: [{ translateY: (1 - v.get()) * -20 }],
  }));
  const def = garageContent().missions?.defs.find((d) => d.id === toast.id);
  if (!def) return null;
  const [a, b] = def.goals.map((g) => g.goal);
  return (
    <Animated.View style={[styles.toast, style]} testID="mission-toast">
      <Pressable style={styles.inner} onPress={() => useMissionsStore.getState().dismissToast(toast.key)} accessibilityRole="alert">
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✓</Text>
        </View>
        <View style={styles.texts}>
          <Text style={styles.kicker}>{upper(t('ui.missions.toast.kicker'))}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {gt(def.titleKey, { a: a ?? 0, b: b ?? 0 })}
          </Text>
          <Text style={styles.desc} numberOfLines={1}>
            {t('ui.missions.toast.claim')}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * A small toast when a daily mission completes during play (never an interruption: it
 * sits at the top, passes touches around it, and goes by itself). Mount once per screen.
 */
export function MissionToastHost() {
  const toast = useMissionsStore((s) => s.toasts[0] ?? null);
  const insets = useInsets();
  useEffect(() => startMissions(), []);
  if (!toast) return null;
  return (
    <View
      style={[
        styles.host,
        {
          top: insets.top + 50,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
      pointerEvents="box-none"
    >
      <ToastCard key={toast.key} toast={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: layer.toast,
    elevation: layer.toast,
  },
  toast: {
    maxWidth: 360,
    minWidth: 240,
    borderRadius: radius.l,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.player,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.good,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...voice.bodyStrong, color: colors.onPlayer, fontSize: type.m },
  texts: { flex: 1 },
  kicker: { ...voice.bodyStrong, color: colors.goodText, fontSize: type.xs },
  name: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  desc: { ...voice.body, color: colors.dim, fontSize: type.xs },
});
