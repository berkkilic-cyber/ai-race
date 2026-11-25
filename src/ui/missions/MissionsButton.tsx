import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../icons';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, radius, shape, spacing, touch, type, voice } from '../theme';
import { badgeCount } from './logic';
import { MissionsSheet } from './MissionsSheet';
import { installMissions, missionsConfig, useMissionsStore } from './store';

/** Missions done and waiting for a claim (and the crate when ready): re-renders only when the number changes. */
export function useMissionsBadge(): number {
  return useMissionsStore((s) => {
    const cfg = missionsConfig();
    return cfg ? badgeCount(cfg, s.save.today) : 0;
  });
}

/**
 * The missions button with its badge; opens the missions sheet. `variant` 'icon' for the
 * Garage header, 'pill' (with its label) for the start screen.
 */
export function MissionsButton({ variant = 'icon', testID = 'missions-button' }: { variant?: 'icon' | 'pill'; testID?: string }) {
  const [open, setOpen] = useState(false);
  const badge = useMissionsBadge();
  useEffect(() => installMissions(), []);
  if (!missionsConfig()) return null;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('ui.missions.buttonA11y', { count: badge })}
        style={({ pressed }) => [variant === 'pill' ? styles.pill : styles.icon, pressed && styles.pressed]}
        testID={testID}
      >
        <Icon name="check" size={variant === 'pill' ? 18 : 22} color={colors.text} accent={colors.player} />
        {variant === 'pill' ? <Text style={styles.pillText}>{t('ui.missions.button')}</Text> : null}
        {badge > 0 ? (
          <View style={[styles.badge, variant === 'pill' ? styles.badgeInline : styles.badgeCorner]} testID={`${testID}-badge`}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </Pressable>
      <MissionsSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  icon: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  pill: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.m,
    borderRadius: shape.panel === 'ticks' ? radius.s : radius.pill,
    borderWidth: shape.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillText: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  pressed: { opacity: 0.7 },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: shape.panel === 'ticks' ? 0 : 9, backgroundColor: colors.player, alignItems: 'center', justifyContent: 'center' },
  badgeCorner: { position: 'absolute', top: 3, right: 1 },
  badgeInline: {},
  badgeText: { ...voice.bodyStrong, fontSize: 11, color: colors.onPlayer },
});
