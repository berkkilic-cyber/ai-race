import { Redirect, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { GameState, NewsItem } from '@/engine';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Meter } from '../components/Meter';
import { fmtPct, fmtUsers } from '../format';
import { usePackEntry } from '../hooks/useGame';
import { labColor, labName, regionName, t } from '../i18n';
import { mixColor } from '../map/mapColors';
import { newsText } from '../news/newsText';
import { useGameStore } from '../store/game';
import { colors, radius, spacing, tabular, type } from '../theme';
import { FinalMap } from './FinalMap';
import { endStats, pickNotableHeadlines, playAgainSetup } from './logic';
import { useWide } from '../start/useWide';
import { useCountUp } from './useCountUp';

const TONE = { good: colors.good, bad: colors.bad, neutral: colors.info } as const;

function Section({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  return (
    <Card style={styles.section} testID={testID}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Headline({ item }: { item: NewsItem }) {
  return (
    <View style={styles.headline}>
      <View style={[styles.toneBar, { backgroundColor: TONE[item.tone] }]} />
      <View style={styles.headlineText}>
        <Text style={styles.headlineDay}>{t('ui.end.day', { day: item.tick + 1 })}</Text>
        <Text style={styles.headlineBody}>{newsText(item)}</Text>
      </View>
    </View>
  );
}

/** Ending: result banner, score, stats, final map, headlines, achievements, Play again / New lab. */
export function EndScreen() {
  // Snapshot the finished run once: starting a new run from here must not re-render this screen with it.
  const [state] = useState<GameState | null>(() => {
    const s = useGameStore.getState().state;
    return s && s.status === 'ended' && s.ending ? s : null;
  });
  if (!state) return <Redirect href="/" />;
  return <EndView state={state} />;
}

function EndView({ state }: { state: GameState }) {
  const router = useRouter();
  const { pack, geometry } = usePackEntry();
  const newGame = useGameStore((s) => s.newGame);
  const reset = useGameStore((s) => s.reset);
  const ending = state.ending!;
  const score = useCountUp(Math.round(ending.score));
  const wide = useWide();

  const def = pack.endings.find((e) => e.id === ending.endingId);
  const player = state.labs[state.playerLabId];
  const win = ending.kind === 'win';
  const accent = win ? colors.good : colors.bad;
  const params = { lab: state.playerLabId, ...(ending.winnerLabId ? { rival: ending.winnerLabId } : {}) };
  const winner = !win && ending.winnerLabId && ending.winnerLabId !== state.playerLabId ? state.labs[ending.winnerLabId] : undefined;
  const founder = pack.founders.find((f) => f.id === player.founderId);
  const stats = endStats(state, pack);
  const headlines = pickNotableHeadlines(state.news, state.playerLabId);
  const achievements = state.achievements.flatMap((id) => pack.achievements.filter((a) => a.id === id));

  const playAgain = () => {
    newGame(playAgainSetup(state));
    router.replace('/game');
  };
  const newLab = () => {
    reset();
    router.replace('/');
  };

  const bannerEl = (
    <View style={[styles.banner, { borderColor: accent, backgroundColor: mixColor(colors.surface, accent, 0.14) }]} testID="end-banner">
      <View style={[styles.kindPill, { backgroundColor: accent }]}>
        <Text style={styles.kind}>{t(win ? 'ui.end.victory' : 'ui.end.defeat')}</Text>
      </View>
      <Text style={[styles.title, wide && styles.titleWide]} testID="end-title">
        {def ? t(def.titleKey, params) : ''}
      </Text>
      {def ? <Text style={[styles.body, wide && styles.bodyWide]}>{t(def.bodyKey, params)}</Text> : null}
      {winner ? (
        <View style={styles.winner}>
          <View style={[styles.swatch, { backgroundColor: labColor(winner) }]} />
          <Text style={styles.winnerText}>{t('ui.end.wonBy', { rival: winner.id })}</Text>
        </View>
      ) : null}
    </View>
  );
  const scoreEl = (
    <Card style={styles.scoreCard}>
      <Text style={styles.scoreLabel}>{t('ui.end.scoreLabel')}</Text>
      <Text style={styles.score} testID="end-score">
        {score.toLocaleString('en-US')}
      </Text>
      <Text style={styles.labLine} numberOfLines={2}>
        {t('ui.end.labLine', { name: labName(player), founder: founder ? t(founder.nameKey) : '', region: regionName(player.homeRegion) })}
      </Text>
    </Card>
  );
  const scoreRowEl = (
    <View style={styles.scoreRow}>
      <View style={styles.scoreRowText}>
        <Text style={styles.scoreLabel}>{t('ui.end.scoreLabel')}</Text>
        <Text style={styles.labLineLeft} numberOfLines={2}>
          {t('ui.end.labLine', { name: labName(player), founder: founder ? t(founder.nameKey) : '', region: regionName(player.homeRegion) })}
        </Text>
      </View>
      <Text style={styles.scoreCompact} testID="end-score">
        {score.toLocaleString('en-US')}
      </Text>
    </View>
  );
  const sectionsEl = (
    <>
        <Section title={t('ui.end.stats')}>
          <View style={styles.grid}>
            <Stat label={t('ui.end.stat.days')} value={stats.days.toLocaleString('en-US')} />
            <Stat label={t('ui.end.stat.peakShare')} value={fmtPct(stats.peakWorldShare)} />
            <Stat label={t('ui.end.stat.users')} value={fmtUsers(stats.users)} />
            <Stat label={t('ui.end.stat.tier')} value={t('ui.resource.tier', { tier: stats.tier })} />
            <Stat label={t('ui.end.stat.nodes')} value={String(stats.nodesBought)} />
            <Stat label={t('ui.end.stat.dataCentres')} value={String(stats.dataCentresBuilt)} />
            <Stat label={t('ui.end.stat.events')} value={String(stats.eventsResolved)} />
          </View>
          <Text style={styles.subTitle}>{t('ui.end.finalMeters')}</Text>
          <View style={styles.meters}>
            <Meter label={t('term.regulation')} value={stats.meters.regulation} pulseAbove={101} />
            <Meter label={t('term.backlash')} value={stats.meters.backlash} pulseAbove={101} />
            <Meter label={t('term.rival')} value={stats.meters.rival} pulseAbove={101} />
          </View>
        </Section>

        <Section title={t('ui.end.map')}>
          <FinalMap state={state} pack={pack} geometry={geometry} />
        </Section>

        <Section title={t('ui.end.headlines')} testID="end-headlines">
          {headlines.length === 0 ? <Text style={styles.empty}>{t('ui.end.noHeadlines')}</Text> : headlines.map((item, i) => <Headline key={i} item={item} />)}
        </Section>

        <Section title={t('ui.end.achievements')} testID="end-achievements">
          {achievements.length === 0 ? (
            <Text style={styles.empty}>{t('ui.end.noAchievements')}</Text>
          ) : (
            achievements.map((a) => (
              <View key={a.id} style={[styles.achievement, a.secret && styles.secret]}>
                <View style={styles.achHead}>
                  <Text style={[styles.achName, a.secret && styles.secretName]}>{t(a.nameKey)}</Text>
                  {a.secret ? (
                    <View style={styles.secretPill}>
                      <Text style={styles.secretPillText}>{t('ui.end.secret')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.achDesc}>{t(a.descKey)}</Text>
              </View>
            ))
          )}
        </Section>
    </>
  );
  const buttonsEl = (
    <View style={[styles.footer, wide && styles.footerWide]}>
        <Button label={t('ui.end.newLab')} sublabel={t('ui.end.newLabHint')} variant="secondary" onPress={newLab} style={styles.footerBtn} testID="end-new-lab" />
        <Button label={t('ui.end.again')} sublabel={t('ui.end.againHint')} variant="primary" onPress={playAgain} style={styles.footerBtn} testID="end-play-again" />
    </View>
  );

  if (wide) {
    return (
      <SafeAreaView style={[styles.safe, styles.row]} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.leftPane}>
          <ScrollView contentContainerStyle={styles.leftContent}>{bannerEl}</ScrollView>
          {scoreRowEl}
          {buttonsEl}
        </View>
        <ScrollView style={styles.rightPane} contentContainerStyle={styles.rightContent} testID="end-right">
          {sectionsEl}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {bannerEl}
        {scoreEl}
        {sectionsEl}
      </ScrollView>
      {buttonsEl}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row' },
  leftPane: { width: 400, borderRightWidth: 1, borderColor: colors.border },
  leftContent: { padding: spacing.l, paddingBottom: spacing.s },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingVertical: spacing.s },
  scoreRowText: { flex: 1, gap: 2 },
  labLineLeft: { color: colors.dim, fontSize: type.xs },
  scoreCompact: { color: colors.player, fontSize: type.display, fontWeight: '900', ...tabular },
  rightPane: { flex: 1 },
  rightContent: { padding: spacing.l, gap: spacing.m },
  footerWide: { borderTopWidth: 0, paddingTop: 0 },
  content: { padding: spacing.l, gap: spacing.m, paddingBottom: spacing.xl },
  banner: { borderWidth: 1, borderTopWidth: 4, borderRadius: radius.l, padding: spacing.l, gap: spacing.s },
  kindPill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.m, paddingVertical: spacing.xs },
  kind: { color: colors.onPlayer, fontSize: type.s, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: type.xl + 4, fontWeight: '900', lineHeight: 32 },
  body: { color: colors.text, fontSize: type.m, lineHeight: 22 },
  titleWide: { fontSize: type.xl, lineHeight: 29 },
  bodyWide: { fontSize: type.s + 1, lineHeight: 20 },
  winner: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  winnerText: { color: colors.text, fontSize: type.s, fontWeight: '700', flexShrink: 1 },
  scoreCard: { alignItems: 'center', gap: spacing.xs },
  scoreLabel: { color: colors.dim, fontSize: type.s, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  score: { color: colors.player, fontSize: type.display + 16, fontWeight: '900', ...tabular },
  labLine: { color: colors.dim, fontSize: type.s, textAlign: 'center' },
  section: { gap: spacing.m },
  sectionTitle: { color: colors.text, fontSize: type.l, fontWeight: '800' },
  subTitle: { color: colors.dim, fontSize: type.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.m },
  stat: { width: '50%', paddingRight: spacing.s, gap: 2 },
  statValue: { color: colors.text, fontSize: type.l, fontWeight: '800', ...tabular },
  statLabel: { color: colors.dim, fontSize: type.xs },
  meters: { flexDirection: 'row', gap: spacing.m },
  empty: { color: colors.dim, fontSize: type.s, lineHeight: 19 },
  headline: { flexDirection: 'row', gap: spacing.m },
  toneBar: { width: 3, borderRadius: 2 },
  headlineText: { flex: 1, gap: 2 },
  headlineDay: { color: colors.dim, fontSize: type.xs, ...tabular },
  headlineBody: { color: colors.text, fontSize: type.s, lineHeight: 19 },
  achievement: { backgroundColor: colors.raised, borderRadius: radius.s, borderWidth: 1, borderColor: colors.border, padding: spacing.m, gap: 2 },
  secret: { borderColor: colors.info, backgroundColor: mixColor(colors.raised, colors.info, 0.12) },
  achHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  achName: { color: colors.text, fontSize: type.m, fontWeight: '700', flexShrink: 1 },
  secretName: { color: colors.info },
  secretPill: { backgroundColor: colors.info, borderRadius: radius.pill, paddingHorizontal: spacing.s, paddingVertical: 1 },
  secretPillText: { color: colors.onPlayer, fontSize: type.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  achDesc: { color: colors.dim, fontSize: type.s },
  footer: { flexDirection: 'row', gap: spacing.s, padding: spacing.l, paddingTop: spacing.m, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  footerBtn: { flex: 1, minHeight: 56 },
});
