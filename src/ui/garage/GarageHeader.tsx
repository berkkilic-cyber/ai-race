import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { crateValue, hypeMultiplier, offerDef, offerStatus } from '@/idle';

import { AdButton, BannerSlot } from '../ads';
import { Icon } from '../icons';
import { t } from '../i18n';
import { colors, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { successHaptic } from './haptics';
import { useGarage, useNowEvery } from './hooks';
import { useGarageStore, type GarageStore } from './store';
import { fmt, fmtMult, generationLabel } from './text';

const selTitle = (s: GarageStore) => (s.state ? `${s.state.generation}|${s.state.hype}` : '');
const same = (v: string) => v;

/** Model name and Hype multiplier. */
function Title() {
  const key = useGarage(selTitle, same);
  const { state, content } = useGarageStore.getState();
  if (!state || !key) return <View style={styles.title} />;
  return (
    <View style={styles.title}>
      <Text style={styles.kicker} numberOfLines={1}>
        {t('ui.garage.title')}
        {state.hype > 0 ? ` · ${t('ui.garage.hypeMult', { hype: fmt(state.hype), mult: fmtMult(hypeMultiplier(state, content)) })}` : ''}
      </Text>
      <Text style={styles.model} numberOfLines={1} testID="garage-model">
        {generationLabel(state.generation)}
      </Text>
    </View>
  );
}

/** The two always-there ad offers: the production boost and the bonus crate (with their cooldowns). */
export function OfferButtons({ compact }: { compact?: boolean }) {
  const now = useNowEvery(1000);
  // Re-render when the boost window or the offer uses change.
  useGarage((s: GarageStore) => (s.state ? `${s.state.boostUntil}|${s.state.offers.boost.length}|${s.state.offers.crate.length}` : ''), same);
  const { state, content } = useGarageStore.getState();
  if (!state) return null;
  const boost = offerDef(content, 'boost');
  return (
    <View style={styles.offers}>
      <AdButton
        placement="boost"
        compact={compact}
        variant="primary"
        label={t('ui.ads.placement.boost', { mult: boost?.boostMult ?? 2 })}
        reward={t('ui.ads.reward.boost', { minutes: Math.round((boost?.boostMs ?? 0) / 60000), hours: Math.round((boost?.boostCapMs ?? 0) / 3600000) })}
        status={offerStatus(state, content, 'boost', now)}
        showCooldown
        now={now}
        onRewarded={() => {
          useGarageStore.getState().claim('boost');
          successHaptic();
        }}
      />
      <AdButton
        placement="crate"
        compact={compact}
        label={t('ui.ads.placement.crate')}
        reward={t('ui.ads.reward.crate', { amount: fmt(crateValue(state, content)) })}
        status={offerStatus(state, content, 'crate', now)}
        showCooldown
        now={now}
        onRewarded={() => {
          const r = useGarageStore.getState().claim('crate');
          if (r?.ok) {
            successHaptic();
            useGarageStore.getState().setFlash(`+${fmt(r.gained ?? 0)}`);
          }
        }}
      />
    </View>
  );
}

function IconButton({ icon, label, onPress, testID }: { icon: string; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} testID={testID}>
      <Icon name={icon} size={22} color={colors.text} accent={colors.player} />
    </Pressable>
  );
}

/**
 * The top bar: back to the mode choice, the current model, the reserved banner slot (off
 * by default, kept clear of controls), the boost and crate offers, stats and settings.
 */
export function GarageHeader({ onStats, onSettings, wide }: { onStats: () => void; onSettings: () => void; wide: boolean }) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel={t('ui.garage.backLabel')} style={({ pressed }) => [styles.back, pressed && styles.pressed]} testID="garage-back">
        <Text style={styles.backText}>‹ {t('ui.garage.back')}</Text>
      </Pressable>
      <Title />
      <View style={styles.spacer} />
      {wide ? <BannerSlot /> : null}
      {wide ? <OfferButtons compact /> : null}
      <IconButton icon="trophy" label={t('ui.garage.statsButton')} onPress={onStats} testID="garage-stats" />
      <IconButton icon="settings" label={t('ui.garage.settingsButton')} onPress={onSettings} testID="garage-settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 50, paddingHorizontal: spacing.s, borderBottomWidth: shape.hairline, borderColor: colors.border, backgroundColor: colors.chrome },
  back: { minHeight: touch, minWidth: touch, justifyContent: 'center', paddingHorizontal: spacing.s, borderRadius: radius.s, borderWidth: shape.hairline, borderColor: colors.border },
  backText: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  title: { flexShrink: 1, minWidth: 80 },
  kicker: { ...voice.calmLabel, ...tabular, color: colors.dim },
  model: { ...voice.calmHeading, color: colors.text, fontSize: type.m },
  spacer: { flex: 1 },
  offers: { flexDirection: 'row', gap: spacing.s, alignItems: 'center' },
  iconButton: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
