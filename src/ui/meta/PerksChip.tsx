import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { garageContent } from '../garage/content';
import { t } from '../i18n';
import { colors, radius, spacing, touch, type, voice } from '../theme';
import { LabRepBadge } from './LabRepBadge';
import { labRepLevel, racePerks } from './logic';
import { useMetaStore } from './store';
import { perkSummary } from './text';

export interface PerksChipProps {
  onOpen: () => void;
}

/**
 * The start screen's perks chip: the Lab Rep badge (level and bar to the next perk) and what
 * the perks add ("+$30M Cash, +8 Hype", or "perks off"). With no Lab Rep yet it is a pointer instead: "The Garage earns race perks".
 * Opens the perks sheet either way.
 */
export function PerksChip({ onOpen }: PerksChipProps) {
  const loaded = useMetaStore((s) => s.loaded);
  const labRep = useMetaStore((s) => s.labRep);
  const perksOn = useMetaStore((s) => s.perksOn);
  useEffect(() => {
    void useMetaStore.getState().load();
  }, []);
  if (!loaded) return null;
  const content = garageContent();
  const { level } = labRepLevel(content, labRep);
  const perks = racePerks(content, level);
  if (level < 1 || perks.length === 0) {
    return (
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.chip, styles.pointer, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={t('ui.meta.pointer.a11y')} testID="perks-pointer" hitSlop={6}>
        <View style={styles.dot} />
        <Text style={styles.pointerText} numberOfLines={1}>
          {t('ui.meta.pointer')}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    );
  }
  const label = perksOn ? t('ui.meta.chip', { level, summary: perkSummary(perks) }) : t('ui.meta.chip.off', { level });
  return (
    <Pressable onPress={onOpen} style={({ pressed }) => [styles.chip, !perksOn && styles.off, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={label} testID="perks-chip" hitSlop={6}>
      <LabRepBadge total={labRep} showNext={false} style={styles.badge} testID="perks-chip-rep" />
      <Text style={[styles.text, !perksOn && styles.textOff]} numberOfLines={1}>
        {perksOn ? perkSummary(perks) : t('ui.meta.chip.offShort')}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    minHeight: touch - 12,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.player,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 1,
  },
  pointer: { borderColor: colors.info, borderStyle: 'dashed' },
  off: { borderColor: colors.border },
  pressed: { opacity: 0.8 },
  badge: { flexShrink: 0, width: 132 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.info },
  text: { ...voice.bodyStrong, color: colors.text, fontSize: type.s, flexShrink: 1 },
  textOff: { color: colors.dim },
  pointerText: { ...voice.bodyStrong, color: colors.info, fontSize: type.s, flexShrink: 1 },
  chevron: { color: colors.dim, fontSize: type.l, lineHeight: type.l, marginTop: -2 },
});
