import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { t } from '../i18n';
import { colors, radius, spacing, tabular, touch, type } from '../theme';
import { MAX_LAB_NAME, missingText } from './logic';

export interface NameStepProps {
  name: string;
  onName: (name: string) => void;
  onDice: () => void;
  onHowTo: () => void;
  onSubmit: () => void;
  /** Two panes side by side: title on the left, the name field on the right. */
  wide?: boolean;
}

/** Step 1: title, tagline, lab name with a random-name button, How to play. */
export function NameStep({ name, onName, onDice, onHowTo, onSubmit, wide }: NameStepProps) {
  const [touched, setTouched] = useState(false);
  const problem = missingText({ name, founderId: 'x', homeRegion: 'x' });
  return (
    <View style={[styles.wrap, wide && styles.wrapWide]}>
      <View style={[styles.hero, wide && styles.pane]}>
        <Text style={styles.title} accessibilityRole="header">
          {t('ui.start.gameTitle')}
        </Text>
        <Text style={styles.tagline}>{t('ui.start.tagline')}</Text>
      </View>

      <View style={[styles.right, wide && styles.pane]}>
        <View style={styles.field}>
          <Text style={styles.label}>{t('ui.start.nameLabel')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, touched && problem ? styles.inputBad : null]}
              value={name}
              onChangeText={(v) => {
                setTouched(true);
                onName(v);
              }}
              onBlur={() => setTouched(true)}
              onSubmitEditing={onSubmit}
              placeholder={t('ui.start.namePlaceholder')}
              placeholderTextColor={colors.dim}
              maxLength={MAX_LAB_NAME + 8}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel={t('ui.start.nameLabel')}
              testID="start-name"
            />
            <Button label="⚄" onPress={onDice} accessibilityLabel={t('ui.start.dice')} style={styles.dice} testID="start-dice" />
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.meta, styles.error]} numberOfLines={1}>
              {touched && problem ? problem : ' '}
            </Text>
            <Text style={[styles.meta, name.trim().length > MAX_LAB_NAME && styles.error]}>
              {t('ui.start.nameCount', { count: name.trim().length, max: MAX_LAB_NAME })}
            </Text>
          </View>
        </View>

        <Button label={t('ui.start.howTo')} variant="ghost" onPress={onHowTo} style={styles.howTo} testID="start-howto-open" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl, paddingTop: spacing.xl },
  wrapWide: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingTop: 0, gap: spacing.xl + spacing.l },
  pane: { flex: 1 },
  right: { gap: spacing.l },
  hero: { gap: spacing.s, alignItems: 'center', paddingVertical: spacing.xl },
  title: { color: colors.player, fontSize: type.display + 12, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: colors.text, fontSize: type.m, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  field: { gap: spacing.s },
  label: { color: colors.dim, fontSize: type.s, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  inputRow: { flexDirection: 'row', gap: spacing.s },
  input: {
    flex: 1,
    minHeight: touch + 8,
    backgroundColor: colors.surface,
    borderRadius: radius.s,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: type.l,
    fontWeight: '600',
    paddingHorizontal: spacing.m,
  },
  inputBad: { borderColor: colors.bad },
  dice: { width: touch + 8, minHeight: touch + 8, paddingHorizontal: 0 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s },
  meta: { color: colors.dim, fontSize: type.xs, ...tabular },
  error: { color: colors.bad, flexShrink: 1 },
  howTo: { alignSelf: 'center', paddingHorizontal: spacing.xl },
});
