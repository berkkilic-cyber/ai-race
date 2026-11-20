import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { fmtCompact, fmtPct } from '../format';
import { t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, spacing, tabular, type } from '../theme';

/** Placeholder end screen: ending title and body, score, a few stats, Play again. */
export function EndScreen() {
  const router = useRouter();
  const state = useGameStore((s) => s.state);
  const pack = useGameStore((s) => s.pack);
  const reset = useGameStore((s) => s.reset);
  const playAgain = () => {
    reset();
    router.replace('/');
  };

  const ending = state?.ending;
  const def = ending ? pack.endings.find((e) => e.id === ending.endingId) : undefined;
  if (!state || !ending || !def) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <Text style={styles.body}>{t('ui.end.noRun')}</Text>
          <Button label={t('ui.end.playAgain')} variant="primary" onPress={playAgain} />
        </View>
      </SafeAreaView>
    );
  }
  const player = state.labs[state.playerLabId];
  const win = ending.kind === 'win';
  const params = { lab: state.playerLabId, ...(ending.winnerLabId ? { rival: ending.winnerLabId } : {}) };
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.kind, { color: win ? colors.good : colors.bad }]}>{t(win ? 'ui.end.win' : 'ui.end.lose')}</Text>
        <Text style={styles.title} testID="end-title">
          {t(def.titleKey, params)}
        </Text>
        <Text style={styles.body}>{t(def.bodyKey, params)}</Text>
        <Card style={styles.card}>
          <Text style={styles.scoreLabel}>{t('ui.end.score')}</Text>
          <Text style={styles.score}>{fmtCompact(ending.score)}</Text>
          <Text style={styles.stat}>{t('ui.end.day', { day: ending.tick + 1 })}</Text>
          <Text style={styles.stat}>
            {t('ui.end.share')}: {fmtPct(player.stats.peakWorldShare)}
          </Text>
          <Text style={styles.stat}>
            {t('ui.end.nodes')}: {player.stats.nodesBought}
          </Text>
        </Card>
      </ScrollView>
      <View style={styles.footer}>
        <Button label={t('ui.end.playAgain')} variant="primary" onPress={playAgain} testID="end-play-again" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.m },
  kind: { fontSize: type.s, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: colors.text, fontSize: type.xl, fontWeight: '800' },
  body: { color: colors.text, fontSize: type.m, lineHeight: 22 },
  card: { gap: spacing.xs, marginTop: spacing.m },
  scoreLabel: { color: colors.dim, fontSize: type.s },
  score: { color: colors.player, fontSize: type.display, fontWeight: '800', ...tabular },
  stat: { color: colors.text, fontSize: type.s },
  footer: { padding: spacing.l, borderTopWidth: 1, borderColor: colors.border },
});
