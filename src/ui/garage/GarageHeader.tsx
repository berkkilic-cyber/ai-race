import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { currentStage, hypeMultiplier } from '@/idle';

import { BannerSlot } from '../ads';
import { Icon } from '../icons';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { useGarage } from './hooks';
import { stageAccent } from './stageColors';
import { useGarageStore, type GarageStore } from './store';
import { fmt, fmtMult, generationLabel, gt } from './text';

const selTitle = (s: GarageStore) => (s.state ? `${s.state.generation}|${s.state.hype}|${s.state.stage}` : '');
const same = (v: string) => v;

/** Where the lab is, the model's name and the Hype multiplier. */
function Title() {
  const key = useGarage(selTitle, same);
  const { state, content } = useGarageStore.getState();
  if (!state || !key) return <View style={styles.title} />;
  const stage = currentStage(state, content);
  return (
    <View style={styles.title}>
      <Text style={styles.kicker} numberOfLines={1}>
        <Text style={[styles.kicker, { color: stageAccent(stage?.scene) ?? colors.dim }]} testID="garage-stage-name">
          {stage ? gt(stage.nameKey) : t('ui.garage.title')}
        </Text>
        {state.hype > 0 ? ` · ${t('ui.garage.hypeMult', { hype: fmt(state.hype), mult: fmtMult(hypeMultiplier(state, content)) })}` : ''}
      </Text>
      <Text style={styles.model} numberOfLines={1} testID="garage-model">
        {generationLabel(state.generation)}
      </Text>
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
 * The top bar, kept quiet: back to the mode choice, where the lab is and the current model,
 * the reserved banner slot (off by default, kept clear of controls), stats and settings.
 * Ad offers are not here: one at a time appears where it applies (see adOffer.tsx).
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
      <IconButton icon="trophy" label={t('ui.garage.statsButton')} onPress={onStats} testID="garage-stats" />
      <IconButton icon="settings" label={t('ui.garage.settingsButton')} onPress={onSettings} testID="garage-settings" />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 46, paddingHorizontal: spacing.s, borderBottomWidth: shape.hairline, borderColor: colors.border, backgroundColor: colors.chrome },
  back: { minHeight: touch, minWidth: touch, justifyContent: 'center', paddingHorizontal: spacing.s, borderRadius: radius.s, borderWidth: shape.hairline, borderColor: colors.border },
  backText: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  title: { flexShrink: 1, minWidth: 80 },
  kicker: { ...voice.calmLabel, ...tabular, color: colors.dim },
  model: { ...voice.calmHeading, color: colors.text, fontSize: type.m },
  spacer: { flex: 1 },
  iconButton: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
