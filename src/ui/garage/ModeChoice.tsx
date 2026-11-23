import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '../icons';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, flatShadow, radius, shape, spacing, touch, type, voice } from '../theme';

/**
 * The mode choice on the start screen's title step: Race (the flow below: name, founder,
 * home region) or Garage, which opens the idle clicker straight away.
 */
export function ModeChoice({ beforeGarage }: { beforeGarage?: Promise<unknown> }) {
  const router = useRouter();
  const openGarage = () => {
    const go = () => router.push('/garage');
    if (beforeGarage) beforeGarage.then(go, go);
    else go();
  };
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={t('ui.garage.mode.title')} testID="mode-choice">
      <View style={[styles.card, styles.on]} accessibilityRole="radio" accessibilityState={{ selected: true }} testID="mode-race">
        <Icon name="race" size={22} color={colors.onPlayer} />
        <View style={styles.texts}>
          <Text style={[styles.name, styles.nameOn]}>{t('ui.garage.mode.race')}</Text>
          <Text style={[styles.line, styles.lineOn]} numberOfLines={2}>
            {t('ui.garage.mode.raceLine')}
          </Text>
        </View>
      </View>
      <Pressable onPress={openGarage} accessibilityRole="radio" accessibilityState={{ selected: false }} style={({ pressed }) => [styles.card, styles.off, pressed && styles.pressed]} testID="mode-garage">
        <Icon name="rack-1" size={22} color={colors.text} accent={colors.player} />
        <View style={styles.texts}>
          <Text style={styles.name}>{t('ui.garage.mode.garage')} ›</Text>
          <Text style={styles.line} numberOfLines={2}>
            {t('ui.garage.mode.garageLine')}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: spacing.s },
  card: {
    flex: 1,
    minHeight: touch + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: shape.panel === 'sticker' ? radius.l : radius.s,
    borderWidth: shape.panel === 'plain' ? StyleSheet.hairlineWidth : shape.outline,
  },
  on: { backgroundColor: colors.player, borderColor: shape.panel === 'sticker' ? colors.outline : colors.player, ...flatShadow() },
  off: { backgroundColor: colors.surface, borderColor: shape.panel === 'plain' ? colors.border : colors.outline },
  pressed: { opacity: 0.8, transform: [{ translateY: 1 }] },
  texts: { flex: 1 },
  name: { ...voice.calmHeading, fontSize: type.m, color: colors.text },
  nameOn: { color: colors.onPlayer },
  line: { ...voice.body, fontSize: type.xs + 1, color: colors.dim, lineHeight: 15 },
  lineOn: { color: colors.onPlayer },
});
