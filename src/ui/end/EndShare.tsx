import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ContentPack, GameState } from '@/engine';

import { Button } from '../components/Button';
import { streakOf, type DailyTag } from '../daily/logic';
import { useDailyStore } from '../daily/store';
import { FrontPage } from '../frontpage/FrontPage';
import { storyFor } from '../frontpage/recorder';
import { usePackEntry } from '../hooks/useGame';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { buildShareText, shareInputOf } from '../share/text';
import { useShare } from '../share/useShare';
import { useGameStore } from '../store/game';
import { colors, spacing, type, voice } from '../theme';

/** The daily tag of the finished run (read once: the end screen keeps its run). */
function useDailyTag(state: GameState): DailyTag | null {
  const [tag] = useState<DailyTag | null>(() => {
    const setup = useGameStore.getState().setup;
    return setup?.daily && setup.seed === state.seed ? setup.daily : null;
  });
  return tag;
}

/** The share text of a finished run: with the daily line and streak for the scored daily. */
export function useEndShareText(state: GameState): { text: string; tag: DailyTag | null } {
  const tag = useDailyTag(state);
  const record = useDailyStore((s) => s.record);
  const text = useMemo(() => {
    const daily = tag?.scored ? { number: tag.number, streak: streakOf(record, tag.key).current } : undefined;
    const input = shareInputOf(state, storyFor(state), daily);
    return input ? buildShareText(input) : '';
  }, [state, tag, record]);
  return { text, tag };
}

export interface EndShareRowProps {
  state: GameState;
  pack: ContentPack;
  onFrontPage: () => void;
}

/** End screen: the daily line (for daily runs), "Read the front page" and "Share result". */
export function EndShareRow({ state, onFrontPage }: EndShareRowProps) {
  const { text, tag } = useEndShareText(state);
  const record = useDailyStore((s) => s.record);
  const { share, notice } = useShare();
  const line = tag ? (tag.scored ? t('ui.daily.end.scored', { number: tag.number, streak: streakOf(record, tag.key).current }) : t('ui.daily.end.practice', { number: tag.number })) : null;
  return (
    <View style={styles.wrap} testID="end-share">
      {line ? (
        <Text style={styles.daily} numberOfLines={1} testID="end-daily-line">
          {line}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Button label={t('ui.front.open')} variant="ink" compact onPress={onFrontPage} style={styles.btn} testID="end-frontpage" />
        <Button label={t('ui.share.button')} variant="secondary" compact onPress={() => share(text, tag?.scored ? 'daily' : 'run', 'end')} style={styles.btn} testID="end-share-button" />
      </View>
      {notice ? (
        <Text style={styles.notice} testID="end-share-notice">
          {t(notice === 'copied' ? 'ui.share.copied' : 'ui.share.failed')}
        </Text>
      ) : null}
    </View>
  );
}

/** The front page overlay for the end screen; mount it last at the screen's root. */
export function EndFrontPage({ visible, state, onClose }: { visible: boolean; state: GameState; onClose: () => void }) {
  const { pack, geometry } = usePackEntry();
  const { text, tag } = useEndShareText(state);
  return <FrontPage visible={visible} state={state} pack={pack} geometry={geometry} story={storyFor(state)} {...(tag?.scored ? { dailyNumber: tag.number } : {})} shareText={text} onClose={onClose} />;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, paddingHorizontal: spacing.l, paddingBottom: spacing.s },
  daily: { ...voice.calmLabel, color: colors.playerText },
  row: { flexDirection: 'row', gap: spacing.s },
  btn: { flex: 1, minHeight: 44 },
  notice: { color: colors.goodText, fontSize: type.xs },
});
