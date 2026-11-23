import { Pressable, StyleSheet, Text, View } from 'react-native';

import { haveText, needText } from '../explain/model';
import { isStuck, useNudgeStore } from '../explain/useModelStatus';
import { t } from '../i18n';
import { Icon } from '../icons';
import { useStripPanel } from '../shell/panels/store';
import { colors, radius, shape, spacing, touch, type, voice } from '../theme';
import { useTabModelStatus } from './useTabModelStatus';

/**
 * Shown on the Trees screen while the player owns a better model than their compute can
 * run: the numbers, a Details button (the model explanation) and a dismiss button. Stays
 * dismissed until the player owns a different model tier.
 */
export function ModelNudge() {
  const m = useTabModelStatus();
  const dismissedFor = useNudgeStore((s) => s.dismissedFor);
  const dismiss = useNudgeStore((s) => s.dismiss);
  const show = useStripPanel((s) => s.show);
  if (!isStuck(m) || dismissedFor === m.owned) return null;
  return (
    <View style={styles.box} testID="model-nudge" accessibilityRole="alert">
      <Icon name="compute" size={20} color={colors.bad} accent={colors.bad} />
      <Text style={styles.text} numberOfLines={2}>
        {t('ui.trees2.nudge', { owned: m.owned, running: m.running, required: needText(m.required), compute: haveText(m.compute) })}
      </Text>
      <Pressable onPress={() => show('model')} style={({ pressed }) => [styles.more, pressed && styles.pressed]} accessibilityRole="button" testID="model-nudge-more">
        <Text style={styles.moreText}>{t('ui.trees2.nudgeMore')}</Text>
      </Pressable>
      <Pressable
        onPress={() => dismiss(m.owned)}
        hitSlop={6}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('ui.trees2.nudgeDismiss')}
        testID="model-nudge-dismiss"
      >
        <Icon name="close" size={14} color={colors.dim} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    marginHorizontal: spacing.m,
    marginTop: spacing.xs,
    paddingLeft: spacing.s,
    paddingVertical: 2,
    borderWidth: shape.outline,
    borderColor: colors.bad,
    borderRadius: radius.s,
    backgroundColor: colors.surface,
  },
  text: { ...voice.bodyStrong, flex: 1, color: colors.text, fontSize: type.xs + 0.5, lineHeight: 15 },
  more: { minHeight: touch - 12, justifyContent: 'center', paddingHorizontal: spacing.s, borderWidth: shape.hairline, borderColor: colors.bad, borderRadius: radius.pill },
  moreText: { ...voice.calmLabel, color: colors.bad, fontSize: 10 },
  close: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
