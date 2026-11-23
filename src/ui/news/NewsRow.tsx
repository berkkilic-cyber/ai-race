import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NewsItem } from '@/engine';

import { t } from '../i18n';
import { cased } from '../locale/casing';
import { colors, radius, spacing, type } from '../theme';
import { newsText } from './newsText';

const TONE = { good: colors.good, bad: colors.bad, neutral: colors.info } as const;

export interface NewsRowProps {
  item: NewsItem;
  /** Colour of the lab the item is about, or null for world news. */
  labColor: string | null;
  onOpenRegion?: (regionId: string) => void;
}

/** One headline: tone bar, lab dot, text; items with a region link to the map. */
export const NewsRow = memo(function NewsRow({ item, labColor, onOpenRegion }: NewsRowProps) {
  const text = newsText(item);
  const regionId = item.regionId;
  const content = (
    <>
      <View style={[styles.bar, { backgroundColor: TONE[item.tone] }]} />
      <View style={styles.body}>
        <View style={styles.line}>
          <View style={[styles.dot, labColor ? { backgroundColor: labColor } : styles.worldDot]} />
          <Text style={styles.text}>{text}</Text>
        </View>
        {regionId && onOpenRegion ? <Text style={styles.link}>{`${t('ui.news.openMap')} ›`}</Text> : null}
      </View>
    </>
  );
  if (regionId && onOpenRegion) {
    return (
      <Pressable
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        onPress={() => onOpenRegion(regionId)}
        accessibilityRole="button"
        accessibilityLabel={`${text}. ${t('ui.news.openMap')}`}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={styles.item}>{content}</View>;
});

export const DayHeader = memo(function DayHeader({ tick }: { tick: number }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerText}>{cased(styles.headerText, t('ui.news.dayHeader', { day: tick + 1 }))}</Text>
      <View style={styles.rule} />
    </View>
  );
});

const styles = StyleSheet.create({
  item: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.s, overflow: 'hidden', marginBottom: spacing.s },
  pressed: { backgroundColor: colors.raised },
  bar: { width: 4 },
  body: { flex: 1, paddingHorizontal: spacing.m, paddingVertical: spacing.s + 2, gap: spacing.xs },
  line: { flexDirection: 'row', gap: spacing.s, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  worldDot: { backgroundColor: colors.transparent, borderWidth: 1, borderColor: colors.dim },
  text: { flex: 1, color: colors.text, fontSize: type.s, lineHeight: 19 },
  link: { color: colors.info, fontSize: type.xs, fontWeight: '600', marginLeft: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingTop: spacing.s, paddingBottom: spacing.s },
  headerText: { color: colors.dim, fontSize: type.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
});
