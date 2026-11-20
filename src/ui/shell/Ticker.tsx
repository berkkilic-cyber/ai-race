import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { newsText } from '../news/newsText';
import { useGameStore } from '../store/game';
import { colors, spacing, touch, type } from '../theme';

const TONE = { good: colors.good, bad: colors.bad, neutral: colors.info } as const;

/** Latest headline; tap opens the News tab. */
export function Ticker() {
  const router = useRouter();
  const item = useGameStore((s) => (s.state && s.state.news.length > 0 ? s.state.news[s.state.news.length - 1] : null));
  // Subscribing to labs is not needed: names are resolved at render time from the i18n context.
  return (
    <Pressable style={styles.ticker} onPress={() => router.navigate('/game/news')} accessibilityRole="button" testID="ticker">
      <Text style={[styles.dot, { color: item ? TONE[item.tone] : colors.dim }]}>●</Text>
      <Text style={styles.text} numberOfLines={1}>
        {item ? newsText(item) : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ticker: {
    minHeight: touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  dot: { fontSize: type.xs },
  text: { flex: 1, color: colors.text, fontSize: type.s },
});
