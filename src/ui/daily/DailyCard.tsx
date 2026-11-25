import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ContentPack } from '@/engine';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { fmtDuration, fmtInt } from '../format';
import { regionName, t } from '../i18n';
import { Text } from '../locale/Text';
import { buildShareText } from '../share/text';
import { useShare } from '../share/useShare';
import { cellsFromCode } from '../frontpage/story';
import { colors, spacing, tabular, type, voice } from '../theme';
import { dailyStatus, keyToMs, msUntilNextDaily, streakOf, type DailyDef, type DailyResult } from './logic';
import { dailyNow, todayKey, todaysDaily, useDailyStore } from './store';

/** "25 Nov" / "25 Kasım" for a date key. */
export function dailyDateText(key: string): string {
  const d = new Date(keyToMs(key));
  if (!Number.isFinite(d.getTime())) return key;
  return t('ui.daily.date', { day: d.getUTCDate(), month: t(`ui.daily.month.${d.getUTCMonth() + 1}`) });
}

/** The twist's name and line, with the day's rival filled in. */
export function twistTexts(def: DailyDef): { name: string; desc: string } {
  const params = def.rivalId ? { rival: def.rivalId } : undefined;
  return { name: t(def.twist.nameKey, params), desc: t(def.twist.descKey, params) };
}

/** A daily result's one line: "Reached AGI first · day 212", or "Left early". */
export function resultLine(r: DailyResult, abandoned = 'ui.daily.abandoned'): string {
  if (r.ending === null || !r.trigger) return t(abandoned);
  return t('ui.daily.result', { ending: t(`share.ending.${r.trigger}`), days: fmtInt(r.days) });
}

/** Countdown to the next daily: a timer per second in the last hour, else every 30 s (never per frame). */
function useCountdown(): number {
  const [now, setNow] = useState(dailyNow);
  const left = msUntilNextDaily(now);
  useEffect(() => {
    const id = setTimeout(() => setNow(dailyNow()), left < 3_600_000 ? 1000 : 30_000);
    return () => clearTimeout(id);
  }, [now, left]);
  return left;
}

export interface DailyCardProps {
  pack: ContentPack;
  /** Start today's daily (scored when it is still available). */
  onPlay: (scored: boolean) => void;
  /** Continue the saved daily. */
  onContinue: () => void;
  onHistory: () => void;
}

/**
 * The start screen's daily challenge card: today's date and number, the twist in one line,
 * the countdown to the next one and, once played, the result with Share and Practise again.
 */
export function DailyCard({ pack, onPlay, onContinue, onHistory }: DailyCardProps) {
  const record = useDailyStore((s) => s.record);
  const loaded = useDailyStore((s) => s.loaded);
  useDailyStore((s) => s.clock);
  const left = useCountdown();
  const { share, notice } = useShare();
  useEffect(() => {
    void useDailyStore.getState().load();
  }, []);

  const key = todayKey();
  const def = todaysDaily(pack, key);
  if (!def) return null;
  const twist = twistTexts(def);
  const status = dailyStatus(record, key);
  const streak = streakOf(record, key);
  const founder = pack.founders.find((f) => f.id === def.founderId);
  const length = pack.runLengths?.find((r) => r.id === def.runLength);
  const setupLine = t('ui.daily.setupLine', { founder: founder ? t(founder.nameKey) : '', region: regionName(def.homeRegion), length: length ? t(length.nameKey) : '' });
  const streakText = streak.current > 0 ? `${t('ui.daily.streak', { count: fmtInt(streak.current) })} · ${t('ui.daily.best', { count: fmtInt(streak.best) })}` : streak.best > 0 ? `${t('ui.daily.streakNone')} · ${t('ui.daily.best', { count: fmtInt(streak.best) })}` : t('ui.daily.streakNone');

  const done = status.kind === 'done' ? status.result : null;
  const shareDone = () => {
    if (!done || !done.trigger) return;
    share(buildShareText({ daily: { number: done.number, streak: streak.current }, trigger: done.trigger, days: done.days, race: cellsFromCode(done.race).length ? cellsFromCode(done.race) : ['none', 'none', 'none', 'none', 'none'], score: done.score }), 'daily', 'start');
  };

  return (
    <Card style={styles.card} testID="daily-card">
      <View style={styles.top}>
        <Text style={styles.kicker} accessibilityRole="header" numberOfLines={1}>
          {t('ui.daily.title')}
        </Text>
        <Text style={styles.date} numberOfLines={1} testID="daily-date">
          {`${t('ui.daily.number', { number: def.number })} · ${dailyDateText(key)}`}
        </Text>
      </View>
      <Text style={styles.twist} numberOfLines={1} testID="daily-twist">
        <Text style={styles.twistName}>{twist.name}</Text>
        {`  ${twist.desc}`}
      </Text>
      {done ? (
        <View style={styles.result} testID="daily-result">
          <Text style={styles.resultLine} numberOfLines={1}>
            {resultLine(done)}
          </Text>
          {done.ending !== null ? (
            <Text style={styles.score} numberOfLines={1}>
              {t('ui.daily.score', { score: fmtInt(done.score) })}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.setup} numberOfLines={1}>
          {status.kind === 'inProgress' ? t('ui.daily.inProgress') : setupLine}
        </Text>
      )}
      <View style={styles.meta}>
        <Text style={styles.streak} numberOfLines={1} testID="daily-streak">
          {streakText}
        </Text>
        <Text style={styles.next} numberOfLines={1} testID="daily-next">
          {t('ui.daily.next', { time: fmtDuration(left) })}
        </Text>
      </View>
      <View style={styles.actions}>
        {done ? (
          <>
            {done.ending !== null ? <Button label={notice === 'copied' ? t('ui.daily.copied') : t('ui.daily.share')} variant="primary" compact onPress={shareDone} style={styles.main} testID="daily-share" /> : null}
            <Button label={t('ui.daily.practice')} sublabel={t('ui.daily.practiceHint')} variant="secondary" compact onPress={() => onPlay(false)} style={styles.main} testID="daily-practice" />
          </>
        ) : status.kind === 'inProgress' ? (
          <Button label={t('ui.daily.continue')} variant="primary" compact onPress={onContinue} style={styles.main} testID="daily-continue" />
        ) : (
          <Button label={t('ui.daily.play')} sublabel={t('ui.daily.playHint')} variant="primary" compact disabled={!loaded} onPress={() => onPlay(true)} style={styles.main} testID="daily-play" />
        )}
        <Button label={t('ui.daily.history')} variant="ghost" compact onPress={onHistory} style={styles.side} testID="daily-history" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, borderTopWidth: 3, borderTopColor: colors.player, alignSelf: 'stretch' },
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.s },
  kicker: { ...voice.calmLabel, color: colors.playerText, flexShrink: 1 },
  date: { ...voice.calmNumber, color: colors.dim, fontSize: type.xs, ...tabular },
  twist: { ...voice.body, color: colors.dim, fontSize: type.s },
  twistName: { ...voice.bodyStrong, color: colors.text, fontSize: type.s },
  setup: { ...voice.body, color: colors.dim, fontSize: type.xs },
  result: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.s },
  resultLine: { ...voice.bodyStrong, color: colors.text, fontSize: type.s, flexShrink: 1 },
  score: { ...voice.calmNumber, color: colors.playerText, fontSize: type.m },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.s },
  streak: { ...voice.body, color: colors.text, fontSize: type.xs, flexShrink: 1 },
  next: { ...voice.calmNumber, color: colors.dim, fontSize: type.xs, ...tabular },
  actions: { flexDirection: 'row', gap: spacing.s, marginTop: 2 },
  main: { flex: 1, minHeight: 44 },
  side: { minHeight: 44, paddingHorizontal: spacing.m },
});
