import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { colors, radius, shape, spacing, touch, type, voice } from '../theme';
import { Text } from './Text';
import { cased } from './casing';
import { LOCALES, type Locale } from './current';
import { setLocale, useLocale } from './store';

function Segment({ locale, active, short }: { locale: Locale; active: boolean; short?: boolean }) {
  const name = t(`ui.locale.${locale}`);
  return (
    <Pressable
      onPress={() => setLocale(locale)}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={name}
      testID={`locale-${locale}`}
      hitSlop={short ? 6 : undefined}
      style={({ pressed }) => [short ? styles.segShort : styles.seg, active && styles.segActive, pressed && !active && styles.segPressed]}
    >
      <Text style={[short ? styles.shortText : styles.segText, active && styles.segTextActive]} numberOfLines={1}>
        {short ? cased(styles.shortText, t(`ui.locale.short.${locale}`)) : name}
      </Text>
    </Pressable>
  );
}

/**
 * Language setting: a label and a two-option switch (English / Türkçe). The choice is
 * saved and the visible text changes at once (see LocaleRemount).
 */
export function LanguageRow({ style }: { style?: StyleProp<ViewStyle> }) {
  const locale = useLocale();
  return (
    <View style={[styles.row, style]} testID="language-row">
      <Text style={styles.label}>{t('ui.locale.label')}</Text>
      <View style={styles.switch} accessibilityRole="radiogroup" accessibilityLabel={t('ui.locale.label')}>
        {LOCALES.map((l) => (
          <Segment key={l} locale={l} active={l === locale} />
        ))}
      </View>
    </View>
  );
}

/**
 * A small EN | TR toggle for the start screen's top-left corner, placed inside the safe
 * area by itself (one element to mount). `visible={false}` hides it (the start screen shows
 * it on the first step only, where the corner is free).
 */
export function LanguageToggle({ visible = true }: { visible?: boolean }) {
  const locale = useLocale();
  const insets = useInsets();
  if (!visible) return null;
  return (
    <View
      style={[styles.corner, { top: insets.top + spacing.xs, left: insets.left + spacing.s }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('ui.locale.switchTo', { language: t(`ui.locale.${locale}`) })}
      testID="language-toggle"
    >
      {LOCALES.map((l) => (
        <Segment key={l} locale={l} active={l === locale} short />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: touch, gap: spacing.m },
  label: { ...voice.bodyStrong, color: colors.text, fontSize: type.m, flexShrink: 1 },
  switch: { flexDirection: 'row', borderWidth: shape.hairline, borderColor: colors.border, borderRadius: radius.s, overflow: 'hidden' },
  seg: { minHeight: touch, minWidth: 88, paddingHorizontal: spacing.m, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  segShort: { minHeight: 28, minWidth: 36, paddingHorizontal: spacing.s, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: colors.player },
  segPressed: { backgroundColor: colors.raised },
  segText: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  segTextActive: { color: colors.onPlayer },
  shortText: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs },
  corner: {
    position: 'absolute',
    flexDirection: 'row',
    borderWidth: shape.hairline,
    borderColor: colors.border,
    borderRadius: radius.s,
    overflow: 'hidden',
    backgroundColor: colors.chrome,
  },
});
