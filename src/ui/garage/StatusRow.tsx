import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { incidentDef, offerDef, offerStatus } from '@/idle';

import { AdButton } from '../ads';
import { Icon } from '../icons';
import { t } from '../i18n';
import { colors, radius, shape, spacing, tabular, touch, type, voice } from '../theme';
import { successHaptic, tapHaptic } from './haptics';
import { useGarage, useNowEvery } from './hooks';
import { useGarageStore, type GarageStore } from './store';
import { fmtMult, fmtTime, gt } from './text';

/** What the row shows, as a key that changes only when a chip appears, goes or changes. */
const selKey = (s: GarageStore) => {
  const st = s.state;
  if (!st) return '';
  const f = st.frenzy && st.frenzy.until > st.now ? `f${st.frenzy.until}` : '';
  const b = st.boostUntil > st.now ? `b${st.boostUntil}` : '';
  const i = st.incident && st.incident.until > st.now ? `i${st.incident.uid}:${st.incident.taps}` : '';
  return `${f}|${b}|${i}`;
};
const same = (v: string) => v;

/**
 * Timed effects over the stage: an active frenzy (with the ad that extends it), the ad
 * boost, and an incident (tap it to fix, or the ad that fixes it at once). Keeps its height
 * when empty so the stage does not jump.
 */
export const StatusRow = memo(function StatusRow() {
  const key = useGarage(selKey, same);
  const now = useNowEvery(500, key !== '||');
  const { state, content } = useGarageStore.getState();
  if (!state || key === '||') return <View style={styles.row} />;
  const frenzy = state.frenzy && state.frenzy.until > now ? state.frenzy : null;
  const boosting = state.boostUntil > now;
  const incident = state.incident && state.incident.until > now ? state.incident : null;
  const inc = incident ? incidentDef(content, incident.id) : undefined;
  const tier = incident ? content.generators.find((g) => g.id === incident.generator) : undefined;
  const extend = offerDef(content, 'frenzyExtend');
  return (
    <View style={styles.row} testID="garage-status">
      {frenzy ? (
        <View style={[styles.chip, styles.frenzy]} testID="garage-frenzy">
          <Icon name="bolt" size={16} color={colors.onPlayer} />
          <Text style={[styles.chipText, styles.onAccent]} numberOfLines={1}>
            {frenzy.tapMult > 1 && frenzy.mult === 1
              ? t('ui.garage.tapFrenzy.chip', { mult: fmtMult(frenzy.tapMult), time: fmtTime(frenzy.until - now) })
              : t('ui.garage.frenzy.chip', { mult: fmtMult(frenzy.mult * frenzy.tapMult), time: fmtTime(frenzy.until - now) })}
          </Text>
        </View>
      ) : null}
      {frenzy && extend ? (
        <AdButton
          placement="frenzyExtend"
          compact
          label={t('ui.ads.placement.frenzyExtend', { seconds: Math.round((extend.extendMs ?? 0) / 1000) })}
          reward={t('ui.ads.reward.frenzyExtend', { seconds: Math.round((extend.extendMs ?? 0) / 1000) })}
          status={offerStatus(state, content, 'frenzyExtend', now)}
          onRewarded={() => {
            useGarageStore.getState().claim('frenzyExtend');
            successHaptic();
          }}
        />
      ) : null}
      {boosting && !frenzy ? (
        <View style={styles.chip} testID="garage-boost-chip">
          <Icon name="megaphone" size={16} color={colors.text} accent={colors.player} />
          <Text style={styles.chipText} numberOfLines={1}>
            {t('ui.garage.boost.chip', { mult: offerDef(content, 'boost')?.boostMult ?? 2, time: fmtTime(state.boostUntil - now) })}
          </Text>
        </View>
      ) : null}
      {incident && inc && tier ? (
        <>
          <Pressable
            onPress={() => {
              tapHaptic();
              useGarageStore.getState().tapIncident();
            }}
            style={({ pressed }) => [styles.chip, styles.incident, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${gt(inc.textKey, { tier: tier.nameKey })}. ${t('ui.garage.incident.fix', { taps: incident.taps, need: inc.tapsToFix })}`}
            testID="garage-incident"
          >
            <Icon name={inc.icon} size={18} color={colors.newsPaper} />
            <View style={styles.incidentTexts}>
              <Text style={styles.incidentTitle} numberOfLines={1}>
                {gt(inc.textKey, { tier: tier.nameKey })}
              </Text>
              <Text style={styles.incidentSub} numberOfLines={1}>
                {t('ui.garage.incident.fix', { taps: incident.taps, need: inc.tapsToFix })} · {fmtTime(incident.until - now)}
              </Text>
            </View>
          </Pressable>
          <AdButton
            placement="incidentFix"
            compact
            label={t('ui.ads.placement.incidentFix')}
            reward={t('ui.ads.reward.incidentFix')}
            status={offerStatus(state, content, 'incidentFix', now)}
            onRewarded={() => {
              useGarageStore.getState().claim('incidentFix');
              successHaptic();
            }}
          />
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s, marginTop: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.s,
    minHeight: 32,
    borderRadius: shape.panel === 'sticker' ? radius.pill : radius.s,
    backgroundColor: colors.surface,
    borderWidth: shape.hairline,
    borderColor: shape.panel === 'sticker' ? colors.outline : colors.border,
    flexShrink: 1,
  },
  frenzy: { backgroundColor: colors.player, borderColor: colors.player },
  onAccent: { color: colors.onPlayer },
  chipText: { ...voice.bodyStrong, ...tabular, color: colors.text, fontSize: type.s },
  incident: { backgroundColor: colors.newsRed, borderColor: colors.newsRed, minHeight: touch, flexShrink: 1, borderRadius: radius.none, transform: [{ rotate: '-1deg' }] },
  incidentTexts: { flexShrink: 1 },
  incidentTitle: { ...voice.loudKicker, fontSize: 14, lineHeight: 16, color: colors.newsPaper },
  incidentSub: { ...voice.body, ...tabular, fontSize: type.xs, color: colors.newsPaper },
  pressed: { opacity: 0.8 },
});
