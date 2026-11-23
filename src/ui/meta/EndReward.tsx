import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ContentPack, GameState } from '@/engine';
import type { RaceRewardRecord } from '@/idle';

import { Button } from '../components/Button';
import { garageContent } from '../garage/content';
import { t } from '../i18n';
import { colors, spacing, type, voice } from '../theme';
import { LabRepBadge } from './LabRepBadge';
import { useMetaStore } from './store';
import { fmtRep } from './text';

export interface EndRewardProps {
  state: GameState;
  pack: ContentPack;
  onGarage: () => void;
  /** Another button for the same row (the wide end screen puts Change lab here). */
  extra?: ReactNode;
}

/** The reward line in words. */
export function rewardLine(r: RaceRewardRecord): string {
  if (r.rep <= 0) return t('ui.meta.end.none');
  return t('ui.meta.end.reward', { rep: fmtRep(r.rep), mult: garageContent().raceReward?.boostMult ?? 1, minutes: Math.round(r.boostMs / 60000) });
}

/**
 * The end screen's line about what the Garage received for this run (granted once, when the
 * screen opens), the Lab Rep badge and a button to the Garage.
 */
export function EndReward({ state, pack, onGarage, extra }: EndRewardProps) {
  const [reward, setReward] = useState<RaceRewardRecord | null>(null);
  const labRep = useMetaStore((s) => s.labRep);
  useEffect(() => {
    let live = true;
    void useMetaStore
      .getState()
      .grantForRace(state, pack)
      .then((r) => {
        if (live) setReward(r);
      });
    return () => {
      live = false;
    };
  }, [state, pack]);
  return (
    <View style={styles.wrap} testID="end-reward">
      <View style={styles.text}>
        <Text style={[styles.line, reward && reward.rep > 0 ? styles.good : null]} numberOfLines={2} testID="end-reward-line">
          {reward ? rewardLine(reward) : ' '}
        </Text>
        {reward?.repeat && reward.rep > 0 ? <Text style={styles.note}>{t('ui.meta.end.repeat')}</Text> : null}
        <LabRepBadge total={labRep} showNext={false} />
      </View>
      <Button label={t('ui.meta.end.garage')} variant="secondary" compact onPress={onGarage} style={styles.button} testID="end-garage" />
      {extra}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingVertical: spacing.xs },
  text: { flex: 1, gap: 3, minWidth: 0 },
  line: { ...voice.bodyStrong, color: colors.text, fontSize: type.xs + 1, lineHeight: 16 },
  good: { color: colors.goodText },
  note: { ...voice.body, color: colors.dim, fontSize: type.xs },
  button: { minHeight: 40, minWidth: 88 },
});
