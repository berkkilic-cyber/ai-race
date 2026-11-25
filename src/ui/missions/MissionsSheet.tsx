import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dailyRewardQuote, deserialize, type GarageState } from '@/idle';

import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { feedback } from '../feel';
import { fmtDuration, fmtNum, fmtPct } from '../format';
import { garageNow } from '../garage/clock';
import { garageContent } from '../garage/content';
import { SAVE_KEY as GARAGE_SAVE_KEY, useGarageStore } from '../garage/store';
import { fmt, gt } from '../garage/text';
import { Icon } from '../icons';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, radius, shape, spacing, tabular, type, voice } from '../theme';
import { readValue } from '../tutorial/storage';
import { DAY_MS, canOpenCrate, dayProgress, msToNextDay, streakView, type MissionProgress } from './logic';
import { missionsConfig, missionsNow, useMissionsStore } from './store';

/** The open Garage's state, else the save, read once when the sheet opens (reward previews). */
function useGarageSnapshot(visible: boolean): GarageState | null {
  const open = useGarageStore((s) => s.state);
  const [saved, setSaved] = useState<GarageState | null>(null);
  const seq = useMissionsStore((s) => s.claimSeq);
  useEffect(() => {
    if (!visible || open) return;
    let live = true;
    void readValue(GARAGE_SAVE_KEY)
      .catch(() => null)
      .then((text) => {
        if (live) setSaved(deserialize(text, garageContent(), garageNow()).state);
      });
    return () => {
      live = false;
    };
  }, [visible, open, seq]);
  return open ?? saved;
}

/** "New missions in 5h 12m": its own clock, mounted only while the sheet is open (minutes, no per-frame state). */
function Countdown() {
  const [now, setNow] = useState(missionsNow);
  useEffect(() => {
    const id = setInterval(() => setNow(missionsNow()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <Text style={styles.countdown} testID="missions-countdown">
      {t('ui.missions.countdown', { time: fmtDuration(Math.ceil(msToNextDay(now) / 60_000) * 60_000) })}
    </Text>
  );
}

function rewardLine(tokens: number, rep: number): string {
  return t('ui.missions.reward', { tokens: fmt(tokens), rep: fmtNum(rep, 1) });
}

function MissionRow({ p, garage, onClaim, busy }: { p: MissionProgress; garage: GarageState | null; onClaim: (id: string) => void; busy: boolean }) {
  const content = garageContent();
  const [a, b] = p.def.goals.map((g) => g.goal);
  const quote = garage ? dailyRewardQuote(garage, content, 'mission') : null;
  return (
    <View style={[styles.mission, p.claimed && styles.missionClaimed]} testID={`mission-${p.def.id}`}>
      <View style={styles.missionHead}>
        <Icon name={p.claimed ? 'check' : p.def.slot === 'race' ? 'race' : p.def.slot === 'garage' ? 'rack-1' : 'star'} size={18} color={p.claimed ? colors.goodText : colors.text} accent={colors.player} />
        <Text style={styles.missionTitle} numberOfLines={2}>
          {gt(p.def.titleKey, { a: a ?? 0, b: b ?? 0 })}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, p.done && styles.fillDone, { width: `${Math.round(p.progress * 100)}%` }]} />
      </View>
      <View style={styles.missionFoot}>
        <Text style={styles.small}>{t('ui.missions.progress', { value: fmtNum(Math.floor(p.value), 0), goal: fmtNum(p.goal, 0) })}</Text>
        {p.claimed ? (
          <Text style={styles.claimed}>{t('ui.missions.claimed')}</Text>
        ) : p.done ? (
          <Button label={t('ui.missions.claim')} sublabel={quote ? rewardLine(quote.tokens, quote.rep) : undefined} variant="primary" compact disabled={busy} onPress={() => onClaim(p.def.id)} testID={`mission-claim-${p.def.id}`} />
        ) : quote ? (
          <Text style={styles.small}>{rewardLine(quote.tokens, quote.rep)}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** The day's three missions, the streak with its day off, the daily crate and the countdown. */
export function MissionsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const save = useMissionsStore((s) => s.save);
  const garage = useGarageSnapshot(visible);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) void useMissionsStore.getState().ensureDay();
  }, [visible]);
  const cfg = missionsConfig();
  if (!cfg) return null;
  const today = save.today;
  const list = dayProgress(cfg, today);
  const sv = streakView(save.streak, today?.day ?? 0);
  const crateReady = canOpenCrate(today);
  const crate = garage ? dailyRewardQuote(garage, garageContent(), 'crate', { streak: sv.current }) : null;
  const claim = (id: string) => {
    setBusy(true);
    void useMissionsStore
      .getState()
      .claim(id)
      .then((ok) => {
        if (ok) feedback('garageGolden');
      })
      .finally(() => setBusy(false));
  };
  const openCrate = () => {
    setBusy(true);
    void useMissionsStore
      .getState()
      .openCrate()
      .then((ok) => {
        if (ok) feedback('achievement');
      })
      .finally(() => setBusy(false));
  };
  const bonusPct = fmtPct(cfg.crate.streakBonus * Math.min(sv.current, cfg.crate.streakCap));
  return (
    <Sheet visible={visible} onClose={onClose} title={t('ui.missions.title')} safeArea testID="missions-sheet">
      <View style={styles.body}>
        {visible ? <Countdown /> : null}
        {list.length === 0 ? <Text style={styles.small}>{t('ui.missions.empty')}</Text> : null}
        {list.map((p) => (
          <MissionRow key={p.def.id} p={p} garage={garage} onClaim={claim} busy={busy} />
        ))}

        <View style={[styles.card, crateReady && styles.cardReady]} testID="missions-crate">
          <View style={styles.missionHead}>
            <Icon name="gpu-crate" size={20} color={colors.text} accent={colors.player} />
            <Text style={styles.cardTitle}>{t('ui.missions.crate.title')}</Text>
          </View>
          {today?.crate ? (
            <Text style={styles.claimed}>{t('ui.missions.crate.opened')}</Text>
          ) : (
            <>
              {crate ? (
                <Text style={styles.small}>
                  {rewardLine(crate.tokens, crate.rep)}
                  {crate.trainingRuns > 0 ? ` · ${t('ui.missions.crate.training', { count: crate.trainingRuns })}` : ''}
                  {crate.streakMult > 1 ? ` · ${t('ui.missions.crate.streak', { mult: fmtNum(crate.streakMult, 1) })}` : ''}
                </Text>
              ) : null}
              {crateReady ? (
                <Button label={t('ui.missions.crate.open')} variant="primary" disabled={busy} onPress={openCrate} testID="missions-crate-open" />
              ) : (
                <Text style={styles.small}>{t('ui.missions.crate.locked')}</Text>
              )}
            </>
          )}
        </View>

        <View style={styles.card} testID="missions-streak">
          <Text style={styles.label}>{t('ui.missions.streak.title')}</Text>
          {sv.current > 0 ? (
            <Text style={styles.streak} testID="missions-streak-value">
              {t('ui.missions.streak.line', { count: sv.current })}
            </Text>
          ) : (
            <Text style={styles.small}>{t('ui.missions.streak.zero')}</Text>
          )}
          {sv.current > 0 ? <Text style={styles.small}>{sv.countedToday ? t('ui.missions.streak.today') : t('ui.missions.streak.claimToday')}</Text> : null}
          {sv.coveringYesterday || (sv.countedToday && save.streak.coveredDay === (today?.day ?? 0) - 1) ? (
            <Text style={[styles.small, styles.good]} testID="missions-dayoff-used">
              {t('ui.missions.streak.covering')}
            </Text>
          ) : null}
          <Text style={styles.small}>{sv.dayOffReady ? t('ui.missions.streak.dayOffReady') : t('ui.missions.streak.dayOffIn', { time: fmtDuration(sv.dayOffInDays * DAY_MS) })}</Text>
          <Text style={styles.small}>{t('ui.missions.streak.bonus', { pct: bonusPct, max: fmtPct(cfg.crate.streakBonus * cfg.crate.streakCap), days: cfg.crate.streakCap })}</Text>
          {save.streak.best > 0 ? <Text style={styles.small}>{t('ui.missions.streak.best', { count: save.streak.best })}</Text> : null}
        </View>
      </View>
    </Sheet>
  );
}

const panel = {
  gap: spacing.xs,
  padding: spacing.m,
  backgroundColor: colors.surface,
  borderRadius: radius.s,
  borderWidth: shape.panel === 'sticker' ? shape.outline : shape.hairline,
  borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
} as const;

const styles = StyleSheet.create({
  body: { gap: spacing.s },
  countdown: { ...voice.body, ...tabular, color: colors.dim, fontSize: type.s },
  mission: panel,
  missionClaimed: { opacity: 0.75 },
  missionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  missionTitle: { ...voice.bodyStrong, color: colors.text, fontSize: type.s, flexShrink: 1 },
  missionFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s, flexWrap: 'wrap' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.player },
  fillDone: { backgroundColor: colors.good },
  small: { ...voice.body, ...tabular, color: colors.dim, fontSize: type.xs + 1, lineHeight: 16 },
  claimed: { ...voice.bodyStrong, color: colors.goodText, fontSize: type.s },
  card: panel,
  cardReady: { borderColor: colors.player },
  cardTitle: { ...voice.calmHeading, color: colors.text, fontSize: type.m },
  label: { ...voice.calmLabel, color: colors.dim },
  streak: { ...voice.calmNumber, ...tabular, color: colors.text, fontSize: type.l },
  good: { color: colors.goodText },
});
