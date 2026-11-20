import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FounderDef } from '@/engine';

import { t } from '../i18n';
import { colors, radius, spacing, type } from '../theme';
import { founderPerkLines } from './logic';

export interface FounderStepProps {
  founders: readonly FounderDef[];
  selected: string | null;
  onSelect: (id: string) => void;
  /** The cards side by side in one row. */
  wide?: boolean;
}

const TONE = { good: colors.good, bad: colors.bad, neutral: colors.text } as const;

/** Step 2: the founders as selectable cards with their perks. */
export function FounderStep({ founders, selected, onSelect, wide }: FounderStepProps) {
  return (
    <View style={[styles.wrap, wide && styles.wrapWide]}>
      <View style={[styles.head, wide && styles.headWide]}>
        <Text style={styles.title} accessibilityRole="header">
          {t('ui.start.founderTitle')}
        </Text>
        <Text style={styles.hint}>{t('ui.start.founderHint')}</Text>
      </View>
      <View accessibilityRole="radiogroup" style={[styles.list, wide && styles.listWide]}>
        {founders.map((f) => {
          const on = selected === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => onSelect(f.id)}
              style={({ pressed }) => [styles.card, wide && styles.cardWide, on && styles.cardOn, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(f.nameKey)}
              testID={`founder-${f.id}`}
            >
              <View style={styles.cardHead}>
                <Text style={styles.name}>{t(f.nameKey)}</Text>
                <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
              </View>
              <Text style={styles.desc}>{t(f.descKey)}</Text>
              <View style={styles.perks}>
                {founderPerkLines(f).map((line) => (
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.l },
  wrapWide: { flex: 1, gap: spacing.m },
  head: { gap: spacing.xs },
  headWide: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.m, flexWrap: 'wrap' },
  title: { color: colors.text, fontSize: type.xl, fontWeight: '800' },
  hint: { color: colors.dim, fontSize: type.s },
  list: { gap: spacing.m },
  listWide: { flex: 1, flexDirection: 'row' },
  card: { backgroundColor: colors.surface, borderRadius: radius.l, borderWidth: 2, borderColor: colors.border, padding: spacing.l, gap: spacing.s },
  cardWide: { flex: 1, padding: spacing.m },
  cardOn: { borderColor: colors.player, backgroundColor: colors.raised },
  pressed: { opacity: 0.85 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s },
  name: { color: colors.text, fontSize: type.l, fontWeight: '800', flexShrink: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.player },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.player },
  desc: { color: colors.dim, fontSize: type.s, lineHeight: 19 },
  perks: { gap: spacing.xs, marginTop: spacing.xs },
  perk: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  bullet: { width: 6, height: 6, borderRadius: 3 },
  perkText: { fontSize: type.s, fontWeight: '600' },
});
