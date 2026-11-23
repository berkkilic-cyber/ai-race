import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FounderDef } from '@/engine';

import { t } from '../i18n';
import { colors, radius, spacing, type, voice } from '../theme';
import type { DifficultyOption } from './difficulty';
import { DifficultyPicker } from './DifficultyPicker';
import { founderPerkLines } from './logic';
import type { RunLengthOption } from './runLength';
import { RunLengthPicker } from './RunLengthPicker';

export interface FounderStepProps {
  founders: readonly FounderDef[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** The cards side by side in one row. */
  wide?: boolean;
  /** Difficulty levels under the founders (none: no picker). */
  difficulties?: readonly DifficultyOption[];
  difficulty?: string;
  onDifficulty?: (id: string) => void;
  /** Run lengths beside the difficulty picker (none: no picker). */
  runLengths?: readonly RunLengthOption[];
  runLength?: string;
  onRunLength?: (id: string) => void;
  /** What each founder really starts with at the chosen difficulty, by founder id. */
  starts?: Readonly<Record<string, { hype: number; cash: number }>>;
  /** Shown beside the title (wide, instead of the hint) or above the cards: the Lab Rep perks chip. */
  extra?: ReactNode;
  /** Border colour of the selected card (a Lab Rep frame). */
  frameColor?: string;
}

const TONE = { good: colors.good, bad: colors.bad, neutral: colors.text } as const;

/** Step 2: the founders as selectable cards with their perks. */
export function FounderStep({ founders, selected, onSelect, wide, difficulties = [], difficulty, onDifficulty, runLengths = [], runLength, onRunLength, starts, extra, frameColor }: FounderStepProps) {
  return (
    <View style={[styles.wrap, wide && styles.wrapWide]}>
      <View style={[styles.head, wide && styles.headWide]}>
        <Text style={[styles.title, wide && styles.titleWide]} accessibilityRole="header" numberOfLines={wide ? 1 : undefined}>
          {t('ui.start.founderTitle')}
        </Text>
        <Text style={[styles.hint, wide && styles.hintWide]} numberOfLines={wide ? 2 : undefined}>
          {t('ui.start.founderHint')}
        </Text>
        {!wide && extra ? <View style={styles.extra}>{extra}</View> : null}
        {wide && onRunLength ? (
          <View style={styles.lengthWide}>
            <RunLengthPicker options={runLengths} selected={runLength} onSelect={onRunLength} wide />
          </View>
        ) : null}
      </View>
      <View accessibilityRole="radiogroup" style={[styles.list, wide && styles.listWide]}>
        {founders.map((f) => {
          const on = selected === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => onSelect(f.id)}
              style={({ pressed }) => [styles.card, wide && styles.cardWide, on && styles.cardOn, on && frameColor ? { borderColor: frameColor, borderWidth: 3 } : null, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(f.nameKey)}
              testID={`founder-${f.id}`}
            >
              <View style={styles.cardHead}>
                <Text style={styles.name}>{t(f.nameKey)}</Text>
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
              </View>
              <Text style={[styles.desc, wide && styles.descWide]}>{t(f.descKey)}</Text>
              <View style={[styles.perks, wide && styles.perksWide]}>
                {founderPerkLines(f, starts?.[f.id]).map((line) => (
                  <View key={line.text} style={styles.perk}>
                    <View style={[styles.bullet, { backgroundColor: line.tone === 'neutral' ? colors.dim : TONE[line.tone] }]} />
                    <Text style={[styles.perkText, { color: TONE[line.tone] }]}>{line.text}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      {!wide && onRunLength ? <RunLengthPicker options={runLengths} selected={runLength} onSelect={onRunLength} /> : null}
      {onDifficulty ? <DifficultyPicker options={difficulties} selected={difficulty} onSelect={onDifficulty} wide={wide} headerRight={wide ? extra : undefined} /> : null}
      {wide && extra && !onDifficulty ? <View style={styles.extra}>{extra}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.l },
  wrapWide: { flex: 1, gap: spacing.s },
  head: { gap: spacing.xs },
  headWide: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.m },
  title: { ...voice.calmHeading, color: colors.text, fontSize: type.xl },
  hint: { color: colors.dim, fontSize: type.s },
  list: { gap: spacing.m },
  listWide: { flex: 1, flexDirection: 'row' },
  card: { backgroundColor: colors.surface, borderRadius: radius.l, borderWidth: 2, borderColor: colors.border, padding: spacing.l, gap: spacing.s },
  cardWide: { flex: 1, padding: spacing.m, paddingVertical: spacing.s, gap: spacing.xs },
  cardOn: { borderColor: colors.player, backgroundColor: colors.raised },
  pressed: { opacity: 0.85 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  name: { ...voice.calmHeading, color: colors.text, fontSize: type.l, flexShrink: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.player },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.player },
  desc: { color: colors.dim, fontSize: type.s, lineHeight: 19 },
  perks: { gap: spacing.xs, marginTop: spacing.xs },
  perk: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  bullet: { width: 6, height: 6, borderRadius: 3 },
  perkText: { fontSize: type.s, fontWeight: '600' },
  lengthWide: { marginLeft: 'auto', alignSelf: 'center' },
  titleWide: { flexShrink: 0 },
  descWide: { fontSize: type.s - 1, lineHeight: 17 },
  perksWide: { gap: 2, marginTop: 2 },
  hintWide: { flex: 1, minWidth: 0 },
  extra: { flexDirection: 'row', marginTop: spacing.xs },
});
