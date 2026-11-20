import { useIsFocused, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { AchievementsSheet } from '../achievements/AchievementsSheet';
import { useWide } from '../events/useWide';
import { labColor, t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, radius, spacing, touch, type } from '../theme';
import { buildNewsRows, NEWS_FILTERS, type NewsFilter, type NewsRow as Row } from './feed';
import { DayHeader, NewsRow } from './NewsRow';
import { useNewsLog, useNewsSeen } from './useNews';

/** Lab id -> display colour; a stable object while no lab changes colour. */
function useLabColors(): Record<string, string> {
  return useGameStore(
    useShallow((s) => {
      const out: Record<string, string> = {};
      if (s.state) for (const id of s.state.labOrder) out[id] = labColor(s.state.labs[id]);
      return out;
    }),
  );
}

/** Widest the log gets in wide mode. */
const MAX_LINE_WIDTH = 680;

/** Chips are 36 high; the slop brings the touch target to 44. */
const HIT_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };

const FilterChip = memo(function FilterChip({ filter, active, onPress }: { filter: NewsFilter; active: boolean; onPress: (f: NewsFilter) => void }) {
  return (
    <Pressable
      onPress={() => onPress(filter)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      testID={`news-filter-${filter}`}
      hitSlop={HIT_SLOP}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(`ui.news.filter.${filter}`)}</Text>
    </Pressable>
  );
});

/** News tab: the log, newest first, grouped by day, filterable, with the achievements sheet. */
export function NewsScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const wide = useWide();
  const news = useNewsLog();
  const playerId = useGameStore((s) => s.state?.playerLabId ?? '');
  const earned = useGameStore((s) => s.state?.achievements.length ?? 0);
  const total = useGameStore((s) => s.pack.achievements.length);
  const colorsById = useLabColors();
  const markSeen = useNewsSeen((s) => s.markSeen);
  const [filter, setFilter] = useState<NewsFilter>('all');
  const [sheetOpen, setSheetOpen] = useState(false);

  const latest = news.length > 0 ? news[news.length - 1] : null;
  useEffect(() => {
    if (focused) markSeen(latest);
  }, [focused, latest, markSeen]);

  const rows = useMemo(() => buildNewsRows(news, filter, playerId), [news, filter, playerId]);
  const openRegion = useCallback(() => router.navigate('/game'), [router]);

  const renderItem = useCallback<ListRenderItem<Row>>(
    ({ item: row }) =>
      row.kind === 'day' ? (
        <DayHeader tick={row.tick} />
      ) : (
        <NewsRow item={row.item} labColor={row.item.labId ? (colorsById[row.item.labId] ?? null) : null} onOpenRegion={openRegion} />
      ),
    [colorsById, openRegion],
  );

  return (
    <View style={styles.screen} testID="news-screen">
      <View style={styles.toolbarWrap}>
        <View style={[styles.toolbar, wide && styles.centred]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterScroll}>
            {NEWS_FILTERS.map((f) => (
              <FilterChip key={f} filter={f} active={f === filter} onPress={setFilter} />
            ))}
          </ScrollView>
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            testID="news-achievements"
            hitSlop={HIT_SLOP}
            accessibilityLabel={t('ui.news.achievements', { earned, total })}
            style={({ pressed }) => [styles.achButton, pressed && styles.achPressed]}
          >
            <Text style={styles.achIcon}>{'★'}</Text>
            <Text style={styles.achText} numberOfLines={1}>
              {wide ? t('ui.news.achievements', { earned, total }) : `${earned}/${total}`}
            </Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.content, wide && styles.centred]}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderItem}
        initialNumToRender={16}
        windowSize={7}
        ListEmptyComponent={<Text style={styles.empty}>{t(filter === 'all' ? 'ui.news.emptyAll' : 'ui.news.emptyFilter')}</Text>}
      />
      <AchievementsSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  toolbarWrap: { borderBottomWidth: 1, borderColor: colors.border },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingRight: spacing.m },
  filterScroll: { flex: 1 },
  filters: { gap: spacing.s, paddingHorizontal: spacing.m, paddingVertical: spacing.s },
  chip: {
    minHeight: 36,
    minWidth: touch,
    paddingHorizontal: spacing.m,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.player, borderColor: colors.player },
  chipText: { color: colors.text, fontSize: type.s, fontWeight: '600' },
  chipTextActive: { color: colors.onPlayer, fontWeight: '800' },
  achButton: {
    minHeight: 36,
    minWidth: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.m,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.player,
  },
  achPressed: { backgroundColor: colors.raised },
  achIcon: { color: colors.playerText, fontSize: type.s },
  achText: { color: colors.playerText, fontSize: type.s, fontWeight: '800' },
  list: { flex: 1 },
  /** Wide: keep lines a comfortable length, centred in the main area. */
  centred: { width: '100%', maxWidth: MAX_LINE_WIDTH, alignSelf: 'center' },
  content: { paddingHorizontal: spacing.m, paddingBottom: spacing.m },
  empty: { color: colors.dim, fontSize: type.m, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.xl },
});
