import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatDuration, type OfferStatus } from '@/idle';

import { t } from '../i18n';
import { colors, flatShadow, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { adReady, requestRewardedAd } from './ads';
import { useAdStore } from './store';
import type { PlacementId } from './types';

export interface AdButtonProps {
  placement: PlacementId;
  label: string;
  /** The reward in words, shown on the button and on the ad itself. */
  reward: string;
  /** The offer's state from the idle engine (cooldown, cap, applicable). */
  status: OfferStatus;
  /** Called once the reward is earned (or granted with ads removed). */
  onRewarded: () => void;
  /** With a cooldown or cap, show a disabled "Ready in …" button instead of nothing. */
  showCooldown?: boolean;
  /** Clock for the cooldown text. */
  now?: number;
  variant?: 'primary' | 'secondary';
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * An opt-in rewarded-ad button: says what the reward is before the player commits, shows
 * a small "AD" badge (or "Free" once ads are removed), and disappears when no ad can be
 * shown or the offer does not apply, so the screen falls back to the plain version.
 */
export function AdButton({ placement, label, reward, status, onRewarded, showCooldown, now, variant = 'secondary', compact, style, testID }: AdButtonProps) {
  const adsRemoved = useAdStore((s) => s.adsRemoved);
  // Re-render when the test ad opens or closes (provider availability follows it).
  useAdStore((s) => s.mock !== null);
  const [busy, setBusy] = useState(false);
  const waiting = !status.available && (status.reason === 'cooldown' || status.reason === 'dailyCap') && status.readyAt !== undefined;
  if (!status.available && !(showCooldown && waiting)) return null;
  if (!adsRemoved && !adReady(placement) && !busy) return null;
  const disabled = !status.available || busy;
  const press = () => {
    if (disabled) return;
    setBusy(true);
    requestRewardedAd(placement, reward)
      .then((r) => {
        if (r === 'rewarded') onRewarded();
      })
      .finally(() => setBusy(false));
  };
  const primary = variant === 'primary' && !disabled;
  const fg = primary ? colors.onPlayer : disabled ? colors.dim : colors.text;
  return (
    <Pressable
      onPress={press}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${reward}. ${adsRemoved ? t('ui.ads.free') : t('ui.ads.watch')}`}
      accessibilityState={{ disabled }}
      testID={testID ?? `ad-${placement}`}
      style={({ pressed }) => [styles.base, compact && styles.compact, primary ? styles.primary : styles.secondary, disabled && styles.disabled, pressed && styles.pressed, style]}
    >
      <View style={[styles.badge, primary ? styles.badgeOnPrimary : null]}>
        <Text style={[styles.badgeText, primary && styles.badgeTextOnPrimary]}>{adsRemoved ? t('ui.ads.free') : `▶ ${t('ui.ads.banner')}`}</Text>
      </View>
      <View style={styles.texts}>
        <Text style={[styles.label, compact && styles.labelCompact, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.sub, { color: fg }]} numberOfLines={1}>
          {waiting && !status.available ? t('ui.ads.ready', { time: formatDuration((status.readyAt ?? 0) - (now ?? status.readyAt ?? 0)) }) : reward}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: shape.panel === 'sticker' ? radius.pill : radius.s,
    borderWidth: shape.panel === 'plain' ? StyleSheet.hairlineWidth : shape.outline,
  },
  compact: { paddingHorizontal: spacing.s, gap: spacing.xs },
  primary: { backgroundColor: colors.player, borderColor: shape.panel === 'sticker' ? colors.outline : colors.player, ...flatShadow() },
  secondary: { backgroundColor: colors.surface, borderColor: shape.panel === 'plain' ? colors.border : colors.outline },
  disabled: { borderStyle: 'dashed', borderColor: colors.dim, backgroundColor: colors.transparent },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.85 },
  badge: { paddingHorizontal: 5, paddingVertical: 1, backgroundColor: colors.newsInk, borderRadius: radius.xs },
  badgeOnPrimary: { backgroundColor: colors.onPlayer },
  badgeText: { ...voice.loudKicker, fontSize: 11, lineHeight: 13, letterSpacing: 0.8, color: colors.newsPaper },
  badgeTextOnPrimary: { color: colors.player },
  texts: { flexShrink: 1 },
  label: { ...voice.bodyStrong, fontSize: type.s },
  labelCompact: { fontSize: type.xs + 1 },
  sub: { ...voice.body, ...tabular, fontSize: type.xs, opacity: 0.85 },
});
