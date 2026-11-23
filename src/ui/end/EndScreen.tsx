import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { GameState, NewsItem } from '@/engine';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Ground } from '../components/Deco';
import { Meter } from '../components/Meter';
import { fmtInt, fmtPct, fmtUsers } from '../format';
import { usePackEntry } from '../hooks/useGame';
import { useInsets } from '../hooks/useInsets';
import { labName, readableLabColor, regionName, t } from '../i18n';
import { cased } from '../locale/casing';
import { mixColor } from '../map/mapColors';
import { newsText } from '../news/newsText';
import { useGameStore } from '../store/game';
import { colors, flatShadow, radius, shape, spacing, tabular, type, voice } from '../theme';
import { FinalMap } from './FinalMap';
import { difficultyEndLine } from '../start/difficulty';
import { closeCall, closeCallText, endStats, pickNotableHeadlines, playAgainSetup, rematchSetup } from './logic';
import { runEndLine } from '../start/runLength';
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
  if (!state) return Platform.OS === 'web' ? <WebHome /> : <Redirect href="/" />;
  return <EndView state={state} />;
}

/**
 * Web, /end opened with no finished run (a reload or a typed URL): a full load of the start
 * page. The client-side redirect would require the start route's chunk, which a fresh /end
 * page has not loaded ("Requiring unknown module"). Native has one bundle and redirects.
 */
function WebHome() {
  useEffect(() => {
    if (typeof window !== 'undefined') window.location.replace('/');
  }, []);
  return null;
}

function EndView({ state }: { state: GameState }) {
  const router = useRouter();
  const { pack, geometry } = usePackEntry();
  const newGame = useGameStore((s) => s.newGame);
  const reset = useGameStore((s) => s.reset);
  const ending = state.ending!;
  const score = useCountUp(Math.round(ending.score));
  const wide = useWide();
  const insets = useInsets();
  // Safe area applied once, explicitly (no SafeAreaView): background to the edges, content inside the insets.
  const safe = [styles.safe, { paddingTop: insets.top, paddingRight: insets.right, paddingBottom: insets.bottom, paddingLeft: insets.left }];

  const def = pack.endings.find((e) => e.id === ending.endingId);
  const player = state.labs[state.playerLabId];
  const win = ending.kind === 'win';
  const accent = win ? colors.goodText : colors.bad;
  const params = { lab: state.playerLabId, ...(ending.winnerLabId ? { rival: ending.winnerLabId } : {}) };
  const winner = !win && ending.winnerLabId && ending.winnerLabId !== state.playerLabId ? state.labs[ending.winnerLabId] : undefined;
  const founder = pack.founders.find((f) => f.id === player.founderId);
  const stats = endStats(state, pack);
  const level = runEndLine(state, pack) ?? difficultyEndLine(state, pack);
  const call = closeCall(state, pack);
  const headlines = pickNotableHeadlines(state.news, state.playerLabId);
  const achievements = state.achievements.flatMap((id) => pack.achievements.filter((a) => a.id === id));

  const playAgain = () => {
    newGame(playAgainSetup(state));
    router.replace('/game');
  };
  const rematch = () => {
    newGame(rematchSetup(state));
    router.replace('/game');
  };
  const newLab = () => {
    reset();
    router.replace('/');
  };

  // How close it was, in one line: in the banner (narrow), above the score outside the scroll (wide).
  const closeCallEl = (
    <Text style={[styles.closeCall, wide && styles.closeCallWide, { color: call.near ? accent : colors.text }]} numberOfLines={wide ? 2 : undefined} testID="end-close-call">
      {closeCallText(call)}
    </Text>
  );
  const bannerEl = (
    <View style={[styles.banner, { borderColor: accent, backgroundColor: mixColor(colors.surface, accent, 0.07) }]} testID="end-banner">
      <View style={[styles.kindPill, { backgroundColor: accent }]}>
        <Text style={styles.kind}>{t(win ? 'ui.end.victory' : 'ui.end.defeat')}</Text>
      </View>
      <Text style={[styles.title, wide && styles.titleWide]} testID="end-title">
        {def ? t(def.titleKey, params) : ''}
      </Text>
      {def ? <Text style={[styles.body, wide && styles.bodyWide]}>{t(def.bodyKey, params)}</Text> : null}
      {wide ? null : closeCallEl}
      {winner ? (
        <View style={styles.winner}>
          <View style={[styles.swatch, { backgroundColor: readableLabColor(winner) }]} />
          <Text style={styles.winnerText}>{t('ui.end.wonBy', { rival: winner.id })}</Text>
        </View>
      ) : null}
    </View>
  );
  const scoreEl = (
    <Card style={styles.scoreCard}>
      <Text style={styles.scoreLabel}>{t('ui.end.scoreLabel')}</Text>
      <Text style={styles.score} testID="end-score">
        {fmtInt(score)}
      </Text>
      <Text style={styles.labLine} numberOfLines={2}>
        {t('ui.end.labLine', { name: labName(player), founder: founder ? t(founder.nameKey) : '', region: regionName(player.homeRegion) })}
      </Text>
      {level ? (
        <Text style={styles.levelLine} numberOfLines={1} testID="end-difficulty">
          {level}
        </Text>
      ) : null}
    </Card>
  );
  const scoreRowEl = (
    <View style={styles.scoreRow}>
      <View style={styles.scoreRowText}>
        <Text style={styles.scoreLabel}>{t('ui.end.scoreLabel')}</Text>
        <Text style={styles.labLineLeft} numberOfLines={2}>
          {t('ui.end.labLine', { name: labName(player), founder: founder ? t(founder.nameKey) : '', region: regionName(player.homeRegion) })}
        </Text>
        {level ? (
          <Text style={styles.levelLineLeft} numberOfLines={1} testID="end-difficulty">
            {level}
          </Text>
        ) : null}
      </View>
      <Text style={styles.scoreCompact} testID="end-score">
        {fmtInt(score)}
      </Text>
    </View>
  );
  const sectionsEl = (
    <>
        <Section title={t('ui.end.stats')}>
          <View style={styles.grid}>
            <Stat label={t('ui.end.stat.days')} value={fmtInt(stats.days)} />
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
                      <Text style={styles.secretPillText}>{cased(styles.secretPillText, t('ui.end.secret'))}</Text>
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
        <Button label={t('ui.sprint.end.newRun')} sublabel={t('ui.sprint.end.newRunHint')} variant="secondary" onPress={playAgain} style={styles.footerBtn} testID="end-play-again" />
        <Button label={t('ui.sprint.end.rematch')} sublabel={t('ui.sprint.end.rematchHint')} variant="primary" onPress={rematch} style={styles.footerBtn} testID="end-rematch" />
    </View>
  );
  const newLabEl = (
    <Button label={t('ui.sprint.end.newLab')} variant="ghost" compact onPress={newLab} style={styles.newLab} testID="end-new-lab" />
  );

  if (wide) {
    return (
      <View style={[safe, styles.row]}>
        <View style={styles.leftPane}>
          <ScrollView contentContainerStyle={styles.leftContent}>{bannerEl}</ScrollView>
          {closeCallEl}
          {scoreRowEl}
          {buttonsEl}
          {newLabEl}
        </View>
        <ScrollView style={styles.rightPane} contentContainerStyle={styles.rightContent} testID="end-right">
          {sectionsEl}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={safe}>
      <Ground />
      <ScrollView contentContainerStyle={styles.content}>
        {bannerEl}
        {scoreEl}
        {sectionsEl}
        {newLabEl}
      </ScrollView>
      {buttonsEl}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row' },
  leftPane: { width: 400, borderRightWidth: shape.hairline, borderColor: colors.border },
  leftContent: { padding: spacing.l, paddingBottom: spacing.s },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingVertical: spacing.s },
  scoreRowText: { flex: 1, gap: 2 },
  labLineLeft: { ...voice.body, color: colors.dim, fontSize: type.xs },
  levelLineLeft: { ...voice.calmLabel, color: colors.playerText },
  scoreCompact: { ...voice.calmNumber, color: colors.playerText, fontSize: type.display, lineHeight: type.display + 6 },
  rightPane: { flex: 1 },
  rightContent: { padding: spacing.l, gap: spacing.m },
  footerWide: { borderTopWidth: 0, paddingTop: 0 },
  content: { padding: spacing.l, gap: spacing.m, paddingBottom: spacing.xl },
  banner: { borderTopWidth: 3, padding: spacing.l, paddingTop: spacing.m, gap: spacing.s, borderRadius: radius.s, borderWidth: shape.panel === 'plain' ? 0 : shape.hairline, borderColor: shape.panel === 'sticker' ? colors.outline : colors.border, ...flatShadow() },
  kindPill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.m, paddingVertical: 3 },
  kind: { ...voice.calmLabel, color: colors.newsPaper, fontSize: type.xs, fontWeight: '700', letterSpacing: 1.4 },
  title: { ...voice.calmHeading, color: colors.text, fontSize: type.xl + 6, lineHeight: 34 },
  body: { ...voice.body, color: colors.text, fontSize: type.m, lineHeight: 22 },
  titleWide: { fontSize: type.xl + 2, lineHeight: 30 },
  bodyWide: { fontSize: type.s + 1, lineHeight: 20 },
  winner: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  winnerText: { ...voice.bodyStrong, color: colors.text, fontSize: type.s, flexShrink: 1 },
  scoreCard: { alignItems: 'center', gap: spacing.xs },
  scoreLabel: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs },
  score: { ...voice.calmNumber, color: colors.playerText, fontSize: type.display + 16, lineHeight: type.display + 24 },
  labLine: { ...voice.body, color: colors.dim, fontSize: type.s, textAlign: 'center' },
  levelLine: { ...voice.calmLabel, color: colors.playerText, textAlign: 'center' },
  section: { gap: spacing.m },
  sectionTitle: { ...voice.calmHeading, color: colors.text, fontSize: type.l + 2 },
  subTitle: { ...voice.calmLabel, color: colors.dim, fontSize: type.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.m },
  stat: { width: '50%', paddingRight: spacing.s, gap: 2 },
  statValue: { ...voice.calmNumber, color: colors.text, fontSize: type.l + 2 },
  statLabel: { ...voice.body, color: colors.dim, fontSize: type.xs },
  meters: { flexDirection: 'row', gap: spacing.m },
  empty: { ...voice.body, color: colors.dim, fontSize: type.s, lineHeight: 19 },
  headline: { flexDirection: 'row', gap: spacing.m },
  toneBar: { width: 3, borderRadius: 2 },
  headlineText: { flex: 1, gap: 2 },
  headlineDay: { color: colors.dim, fontSize: type.xs, ...tabular },
  headlineBody: { ...voice.body, color: colors.text, fontSize: type.s, lineHeight: 19 },
  achievement: { backgroundColor: colors.raised, borderRadius: radius.s, borderWidth: shape.panel === 'plain' ? 1 : shape.hairline, borderColor: shape.panel === 'sticker' ? colors.outline : colors.border, padding: spacing.m, gap: 2 },
  secret: { borderColor: colors.info, backgroundColor: mixColor(colors.raised, colors.info, 0.12) },
  achHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  achName: { ...voice.bodyStrong, color: colors.text, fontSize: type.m, flexShrink: 1 },
  secretName: { color: colors.info },
  secretPill: { backgroundColor: colors.info, borderRadius: radius.pill, paddingHorizontal: spacing.s, paddingVertical: 1 },
  secretPillText: { color: colors.onPlayer, fontSize: type.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  achDesc: { ...voice.body, color: colors.dim, fontSize: type.s },
  footer: { flexDirection: 'row', gap: spacing.s, padding: spacing.l, paddingTop: spacing.m, borderTopWidth: shape.hairline, borderColor: colors.border, backgroundColor: colors.chrome },
  footerBtn: { flex: 1, minHeight: 56 },
  newLab: { alignSelf: 'center', marginBottom: spacing.s },
  closeCall: { ...voice.bodyStrong, fontSize: type.s + 1, lineHeight: 20 },
  closeCallWide: { paddingHorizontal: spacing.l, paddingTop: spacing.s },
});
