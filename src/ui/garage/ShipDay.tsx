import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInLeft, FadeInUp, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { offerStatus, prestigePreview, shipReveal } from '@/idle';

import { AdButton } from '../ads';
import { Button } from '../components/Button';
import { Stamp } from '../components/Deco';
import { Overlay } from '../components/Overlay';
import { useInsets } from '../hooks/useInsets';
import { t } from '../i18n';
import { colors, flatShadow, layer, radius, spacing, tabular, type, voice } from '../theme';
import { useAdPlacement } from './adOffer';
import { successHaptic } from './haptics';
import { useGarageStore } from './store';
import { fmtMult, generationLabel, gt } from './text';

/**
 * Ship day: shipping a model as a short sequence on tabloid paper. 1) the benchmark reveal
 * on the parody leaderboard; 2) the headline and a rival's reaction; 3) the launch choice
 * (hype it, play it safe, open the weights), with the single ad offer of the moment (the
 * launch bonus). The choice modifies the base prestige formula; the engine does the maths.
 */
export function ShipDay() {
  const shipDay = useGarageStore((s) => s.shipDay);
  const state = useGarageStore((s) => s.state);
  const content = useGarageStore((s) => s.content);
  const insets = useInsets();
  const reduced = useReducedMotion();
  const [choice, setChoice] = useState<string | null>(null);
  if (!shipDay || !state) return null;
  const preview = prestigePreview(state, content);
  const reveal = shipReveal(state, content);
  const close = () => useGarageStore.getState().closeShipDay();
  const next = content.generations[preview.nextGeneration];
  const headline = next ? gt(next.headlineKey) : gt(content.endlessHeadlineKey, { n: preview.nextGeneration + 1 });
  const choices = preview.choices;
  const picked = choices.find((c) => c.id === choice) ?? choices.find((c) => c.id === 'safe') ?? choices[0];
  const bonusPct = Math.round((content.offers.find((o) => o.id === 'prestigeBonus')?.prestigeBonus ?? 0) * 100);
  const ship = (bonus: boolean) => {
    const ok = bonus ? useGarageStore.getState().claim('prestigeBonus', picked?.id)?.ok : useGarageStore.getState().ship(false, picked?.id);
    if (ok) successHaptic();
    setChoice(null);
  };
  const enter = (i: number) => (reduced ? undefined : FadeInLeft.delay(120 + i * 140).duration(260));
  const best = reveal ? Math.max(...reveal.rows.map((r) => r.score), 1) : 1;
  return (
    <Overlay visible layer={layer.event} onRequestClose={close} testID="garage-shipday">
      <View style={[styles.scrim, { paddingTop: insets.top + spacing.s, paddingBottom: insets.bottom + spacing.s, paddingLeft: insets.left + spacing.l, paddingRight: insets.right + spacing.l }]}>
        <Animated.View entering={reduced ? undefined : ZoomIn.duration(220)} style={styles.paper}>
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.top}>
              <Stamp text={t(`ui.garage.shipday.kicker.${shipDay.step}`)} rotate={-3} size={14} />
              <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('ui.garage.shipday.cancel')} testID="garage-shipday-close" style={styles.closeBox}>
                <Text style={styles.closeText}>{t('ui.garage.shipday.cancel')}</Text>
              </Pressable>
            </View>
            {shipDay.step === 'reveal' && reveal ? (
              <View style={styles.block} testID="garage-shipday-reveal">
                <Text style={styles.headline}>{t('ui.garage.shipday.benchmark', { bench: gt(reveal.benchmarkKey) })}</Text>
                {reveal.rows.map((r, i) => (
                  <Animated.View key={r.id} entering={enter(i)} style={styles.lbRow}>
                    <Text style={[styles.lbName, r.you && styles.lbYou]} numberOfLines={1}>
                      {i + 1}. {r.you ? generationLabel(preview.nextGeneration) : gt(r.nameKey ?? '')}
                    </Text>
                    <View style={styles.lbTrack}>
                      <View style={[styles.lbFill, r.you && styles.lbFillYou, { width: `${Math.round((r.score / best) * 100)}%` }]} />
                    </View>
                    <Text style={[styles.lbScore, r.you && styles.lbYou]}>{r.score.toFixed(1)}</Text>
                  </Animated.View>
                ))}
                <Text style={styles.sub}>{reveal.rank === 1 ? t('ui.garage.shipday.top') : t('ui.garage.shipday.rank', { rank: reveal.rank })}</Text>
                <Button label={t('ui.garage.shipday.next')} variant="ink" onPress={() => useGarageStore.getState().shipDayStep('press')} style={styles.button} testID="garage-shipday-next" />
              </View>
            ) : null}
            {shipDay.step === 'press' ? (
              <View style={styles.block} testID="garage-shipday-press">
                <Text style={styles.bigHeadline}>{headline}</Text>
                <View style={styles.rule} />
                {reveal ? (
                  <Animated.View entering={reduced ? undefined : FadeInUp.delay(300).duration(260)} style={styles.reaction}>
                    <Text style={styles.reactionKicker}>{t('ui.garage.shipday.reaction')}</Text>
                    <Text style={styles.reactionText}>{gt(reveal.reactionKey, { rival: reveal.rivalKey })}</Text>
                  </Animated.View>
                ) : null}
                <Button label={t('ui.garage.shipday.decide')} variant="ink" onPress={() => useGarageStore.getState().shipDayStep('choose')} style={styles.button} testID="garage-shipday-next" />
              </View>
            ) : null}
            {shipDay.step === 'choose' ? (
              <View style={styles.block} testID="garage-shipday-choose">
                <Text style={styles.headline}>{t('ui.garage.shipday.how', { model: generationLabel(preview.nextGeneration) })}</Text>
                <View style={styles.choices}>
                  {choices.map((c) => {
                    const on = picked?.id === c.id;
                    const risk = c.def.incidentMult > 1 ? t('ui.garage.shipday.riskUp', { mult: fmtMult(c.def.incidentMult) }) : c.def.incidentMult < 1 ? t('ui.garage.shipday.riskDown', { mult: fmtMult(c.def.incidentMult) }) : '';
                    const extras = [risk, c.def.trainingRuns ? t('ui.garage.shipday.runs', { count: c.def.trainingRuns }) : '', c.def.labRep ? t('ui.garage.shipday.rep', { count: c.def.labRep }) : ''].filter(Boolean).join(' · ');
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setChoice(c.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        style={[styles.choice, on && styles.choiceOn]}
                        testID={`garage-shipday-choice-${c.id}`}
                      >
                        <Text style={[styles.choiceLabel, on && styles.choiceLabelOn]}>{gt(c.def.labelKey)}</Text>
                        <Text style={[styles.choiceHype, on && styles.choiceLabelOn]}>{t('ui.garage.ship.gain', { hype: c.gain })}</Text>
                        <Text style={[styles.choiceDesc, on && styles.choiceDescOn]} numberOfLines={3}>
                          {gt(c.def.descKey)}
                        </Text>
                        {extras ? (
                          <Text style={[styles.choiceExtra, on && styles.choiceDescOn]} numberOfLines={2}>
                            {extras}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.shipRow}>
                  <Button label={t('ui.garage.ship.button')} sublabel={picked ? t('ui.garage.ship.gain', { hype: picked.gain }) : undefined} variant="ink" onPress={() => ship(false)} testID="garage-shipday-ship" />
                  {picked ? <LaunchBonus pct={bonusPct} hype={picked.bonusGain} onRewarded={() => ship(true)} /> : null}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Overlay>
  );
}

/** The launch bonus ad, when the placement policy picks it. */
function LaunchBonus({ pct, hype, onRewarded }: { pct: number; hype: number; onRewarded: () => void }) {
  const placement = useAdPlacement();
  const { state, content } = useGarageStore.getState();
  if (placement !== 'prestigeBonus' || !state) return null;
  return (
    <AdButton
      placement="prestigeBonus"
      label={t('ui.ads.placement.prestigeBonus', { pct: `${pct}%` })}
      reward={t('ui.ads.reward.prestigeBonus', { hype })}
      status={offerStatus(state, content, 'prestigeBonus')}
      onRewarded={onRewarded}
    />
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  paper: { maxWidth: 680, width: '100%', maxHeight: '100%', backgroundColor: colors.newsPaper, ...flatShadow(6, colors.newsInk) },
  content: { padding: spacing.m, gap: spacing.s },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBox: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.s },
  closeText: { ...voice.loudKicker, fontSize: 13, color: colors.newsDim },
  block: { gap: spacing.xs },
  headline: { ...voice.loudHeadline, color: colors.newsInk, fontSize: 22, lineHeight: 24 },
  bigHeadline: { ...voice.loudHeadline, color: colors.newsInk, fontSize: 30, lineHeight: 32 },
  rule: { height: 2, backgroundColor: colors.newsInk },
  sub: { ...voice.loudBody, color: colors.newsDim, fontSize: type.s },
  lbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 22 },
  lbName: { ...voice.loudBody, color: colors.newsInk, fontSize: type.s, width: 170 },
  lbYou: { color: colors.newsRed, fontWeight: '800' },
  lbTrack: { flex: 1, height: 10, backgroundColor: colors.newsWash },
  lbFill: { height: '100%', backgroundColor: colors.newsDim },
  lbFillYou: { backgroundColor: colors.newsRed },
  lbScore: { ...voice.loudBody, ...tabular, color: colors.newsInk, fontSize: type.s, width: 48, textAlign: 'right' },
  reaction: { backgroundColor: colors.newsInk, padding: spacing.s, transform: [{ rotate: '-0.5deg' }] },
  reactionKicker: { ...voice.loudKicker, color: colors.newsRed, fontSize: 12 },
  reactionText: { ...voice.loudBody, color: colors.newsPaper, fontSize: type.m },
  choices: { flexDirection: 'row', gap: spacing.s },
  choice: { flex: 1, minWidth: 0, padding: spacing.s, borderWidth: 2, borderColor: colors.newsInk, borderRadius: radius.none, gap: 2 },
  choiceOn: { backgroundColor: colors.newsInk },
  choiceLabel: { ...voice.loudKicker, color: colors.newsInk, fontSize: 15 },
  choiceLabelOn: { color: colors.newsPaper },
  choiceHype: { ...voice.loudHeadline, ...tabular, color: colors.newsRed, fontSize: 18, lineHeight: 20 },
  choiceDesc: { ...voice.loudBody, color: colors.newsDim, fontSize: type.xs, lineHeight: 14 },
  choiceDescOn: { color: colors.newsPaper },
  choiceExtra: { ...voice.loudBody, color: colors.newsInk, fontSize: type.xs, lineHeight: 14, fontWeight: '700' },
  shipRow: { flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap', alignItems: 'center', marginTop: spacing.xs },
  button: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
