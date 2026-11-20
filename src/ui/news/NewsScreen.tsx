import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { NewsItem } from '@/engine';

import { fmtDay } from '../format';
import { t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, spacing, type } from '../theme';
import { newsText } from './newsText';

const TONE = { good: colors.good, bad: colors.bad, neutral: colors.info } as const;
const EMPTY: NewsItem[] = [];

/** Placeholder News tab: every item in state.news, newest first. */
export function NewsScreen() {
  const news = useGameStore((s) => s.state?.news ?? EMPTY);
  const items = news.slice().reverse();
  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item, i) => `${item.tick}-${item.textKey}-${items.length - i}`}
      ListEmptyComponent={<Text style={styles.empty}>{t('ui.news.empty')}</Text>}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <View style={[styles.bar, { backgroundColor: TONE[item.tone] }]} />
          <View style={styles.body}>
            <Text style={styles.day}>{fmtDay(item.tick)}</Text>
            <Text style={styles.text}>{newsText(item)}</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.m, gap: spacing.s },
  empty: { color: colors.dim, fontSize: type.m, textAlign: 'center', marginTop: spacing.xl },
  item: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, overflow: 'hidden' },
  bar: { width: 4 },
  body: { flex: 1, padding: spacing.m, gap: 2 },
  day: { color: colors.dim, fontSize: type.xs },
  text: { color: colors.text, fontSize: type.s },
});
