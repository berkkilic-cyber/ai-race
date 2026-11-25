import { useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { Button } from '../components/Button';
import { PanelDeco, Stripes } from '../components/Deco';
import { t } from '../i18n';
import { ModeChoice } from '../garage/ModeChoice';
import { Text } from '../locale/Text';
import { Mascot } from '../mascot';
import { colors, flatShadow, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { MAX_LAB_NAME, missingText } from './logic';

export interface NameStepProps {
  name: string;
  onName: (name: string) => void;
  onDice: () => void;
  onHowTo: () => void;
  onSubmit: () => void;
  /** Two panes side by side: title on the left, the name field on the right. */
  wide?: boolean;
  /**
   * Keyboard up in landscape: only the field shows (no title pane, no How to play), so the
   * field fits in the little height the keyboard leaves.
   */
  compact?: boolean;
  /** The daily challenge card (src/ui/daily), shown under the title in place of the tagline. */
  daily?: ReactNode;
}

/** Step 1: title, tagline, lab name with a random-name button, How to play. */
export function NameStep({ name, onName, onDice, onHowTo, onSubmit, wide, compact, daily }: NameStepProps) {
  const [touched, setTouched] = useState(false);
  const problem = missingText({ name, founderId: 'x', homeRegion: 'x' });
  return (
    <View style={[styles.wrap, wide && styles.wrapWide]}>
      {compact ? null : (
        <View style={[styles.hero, wide && styles.pane]}>
          {daily && wide ? null : <Mascot mood={name.trim() ? 'pleased' : 'calm'} size={64} />}
          <View style={styles.titleBox}>
            {shape.panel === 'clip' ? <Stripes height={8} stripe={9} /> : null}
            <Text style={styles.title} accessibilityRole="header">
              {t('ui.start.gameTitle')}
            </Text>
            {shape.panel === 'clip' ? <Stripes height={8} stripe={9} flip /> : null}
            {shape.panel === 'ticks' ? <PanelDeco /> : null}
          </View>
          {daily ?? <Text style={styles.tagline}>{t('ui.start.tagline')}</Text>}
        </View>
      )}

      <View style={[styles.right, wide && styles.pane]}>
        {compact ? null : <ModeChoice />}
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
              onSubmitEditing={() => {
                Keyboard.dismiss();
                onSubmit();
              }}
              submitBehavior="blurAndSubmit"
              placeholder={t('ui.start.namePlaceholder')}
              placeholderTextColor={colors.dim}
              maxLength={MAX_LAB_NAME + 8}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
              enterKeyHint="done"
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
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

        {compact ? null : <Button label={t('ui.start.howTo')} variant="ghost" onPress={onHowTo} style={styles.howTo} testID="start-howto-open" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xl, paddingTop: spacing.xl },
  wrapWide: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingTop: 0, gap: spacing.xl + spacing.l },
  pane: { flex: 1 },
  right: { gap: spacing.l },
  hero: { gap: spacing.s, alignItems: 'center', paddingVertical: spacing.l },
  // The title per shape: a drawing's title block (blueprint), between warning stripes (hazard), a tilted sticker (candy).
  titleBox: (shape.panel === 'ticks'
    ? { borderWidth: shape.hairline, borderColor: colors.border, paddingHorizontal: spacing.l, marginTop: spacing.s }
    : shape.panel === 'sticker'
      ? { backgroundColor: colors.raised, borderWidth: shape.outline, borderColor: colors.outline, borderRadius: radius.l, paddingHorizontal: spacing.l, marginTop: spacing.s, transform: [{ rotate: '-3deg' }], ...flatShadow(5) }
      : { marginTop: spacing.s }) as ViewStyle,
  title: {
    ...voice.calmHeading,
    color: colors.text,
    fontSize: shape.panel === 'clip' ? type.display + 30 : type.display + 12,
    lineHeight: shape.panel === 'clip' ? type.display + 30 : type.display + 18,
    letterSpacing: shape.panel === 'ticks' ? 2 : shape.panel === 'clip' ? 1 : -1.5,
  },
  tagline: { ...voice.body, color: colors.dim, fontSize: type.m, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  field: { gap: spacing.s },
  label: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs },
  inputRow: { flexDirection: 'row', gap: spacing.s },
  input: {
    flex: 1,
    // Web gives inputs an intrinsic width (~20 characters); without this the dice button overflows a narrow pane.
    minWidth: 0,
    minHeight: touch + 8,
    backgroundColor: colors.surface,
    borderRadius: shape.panel === 'sticker' ? radius.pill : radius.s,
    borderWidth: shape.panel === 'plain' ? StyleSheet.hairlineWidth : shape.outline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    color: colors.text,
    ...voice.calmHeading,
    fontSize: type.l + 2,
    paddingHorizontal: spacing.m,
  },
  inputBad: { borderColor: colors.bad },
  dice: { width: touch + 8, minHeight: touch + 8, paddingHorizontal: 0 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s },
  meta: { ...voice.calmNumber, color: colors.dim, fontSize: type.xs, ...tabular },
  error: { color: colors.bad, flexShrink: 1 },
  howTo: { alignSelf: 'center', paddingHorizontal: spacing.xl },
});
