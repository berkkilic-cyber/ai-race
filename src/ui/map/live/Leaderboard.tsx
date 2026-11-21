import { memo, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { getStandings } from '@/engine';

import { fmtPct } from '../../format';
import { useKeyedSelector } from '../../hooks/useKeyedSelector';
import { labName, readableLabColor, t } from '../../i18n';
import { useGameStore, type GameStore } from '../../store/game';
import { colors, flatShadow, radius, shape, spacing, voice } from '../../theme';
import { useProjection } from './projection';

/** Below this visible map width the strip shows colour dots only. */
export const LEADERBOARD_DOTS_BELOW = 520;
const SHORT_MAX = 11;

interface Row {
  labId: string;
  share: string;
  mine: boolean;
}

/** Active and eliminated labs by world share, as a compact key (labId:share) so the strip re-renders only when a shown figure changes. */
const selectRows = (s: GameStore): string => {
  const state = s.state;
  if (!state) return '';
  return getStandings(state, s.pack)
    .filter((r) => r.status === 'active')
    .map((r) => `${r.labId}:${fmtPct(r.worldShare)}`)
    .join('|');
};
const ident = (k: string) => k;

/** A lab's short name: its first word, clipped. */
export function shortName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return first.length > SHORT_MAX ? `${first.slice(0, SHORT_MAX - 1)}…` : first;
}

/**
 * A compact, non-interactive standings strip in the map's bottom-right corner (clear of
 * the zoom buttons, the Regions button and the side panel): each lab by world share with
 * its colour, short name and share, the player highlighted. Colour dots only when the
 * visible map is narrow.
 */
export const Leaderboard = memo(function Leaderboard({ insetRight, visibleWidth }: { insetRight: number; visibleWidth: number }) {
  const key = useKeyedSelector(selectRows, ident);
  const playerId = useGameStore((s) => s.state?.playerLabId);
  // Bubbles and edge indicators keep clear of the strip.
  const p = useProjection();
  const setObstacle = p?.setObstacle;
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, y, width, height } = e.nativeEvent.layout;
      setObstacle?.('standings', { x, y, w: width, h: height });
    },
    [setObstacle],
  );
  useEffect(() => () => setObstacle?.('standings', null), [setObstacle]);
  useEffect(() => {
    if (!key) setObstacle?.('standings', null);
  }, [key, setObstacle]);
  if (!key) return null;
  const labs = useGameStore.getState().state?.labs;
  const rows: Row[] = key.split('|').map((part) => {
    const i = part.lastIndexOf(':');
    const labId = part.slice(0, i);
    return { labId, share: part.slice(i + 1), mine: labId === playerId };
  });
  const dots = visibleWidth < LEADERBOARD_DOTS_BELOW;
  return (
    <View style={[styles.wrap, { right: insetRight + spacing.m }, dots && styles.wrapDots]} pointerEvents="none" testID="map-leaderboard" accessibilityLabel={t('ui.map.leaderboard')} onLayout={onLayout}>
      {!dots ? <Text style={styles.title}>{t('ui.map.leaderboard')}</Text> : null}
      {rows.map((r, i) => {
        const lab = labs?.[r.labId];
        if (!lab) return null;
        const color = readableLabColor(lab);
        if (dots) {
          return <View key={r.labId} style={[styles.dot, { backgroundColor: color }, r.mine && styles.dotMine]} accessibilityLabel={t('ui.map.leaderboardRow', { lab: labName(lab), share: r.share })} />;
        }
        return (
          <View key={r.labId} style={[styles.row, r.mine && styles.rowMine]}>
            <Text style={[styles.rank, r.mine && styles.textMine]}>{i + 1}</Text>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Text style={[styles.name, r.mine && styles.textMine]} numberOfLines={1}>
              {shortName(labName(lab))}
            </Text>
            <Text style={[styles.share, r.mine && styles.textMine]}>{r.share}</Text>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: spacing.m,
    width: 148,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs + 2,
    gap: 1,
    backgroundColor: colors.surface,
    borderWidth: shape.hairline,
    borderColor: colors.border,
    borderRadius: radius.s,
    opacity: 0.94,
    ...flatShadow(),
  },
  wrapDots: { width: 'auto', flexDirection: 'row', gap: 5, paddingHorizontal: 6, paddingVertical: 6 },
  title: { ...voice.calmLabel, color: colors.dim, marginBottom: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 3, minHeight: 17 },
  rowMine: { backgroundColor: colors.player, marginHorizontal: -3, paddingHorizontal: 6 },
  rank: { ...voice.calmNumber, fontSize: 11, color: colors.dim, width: 9 },
  swatch: { width: 8, height: 8, borderRadius: shape.radius.s > 0 ? 4 : 0 },
  name: { ...voice.bodyStrong, flex: 1, fontSize: 12, color: colors.text },
  share: { ...voice.calmNumber, fontSize: 12, color: colors.text },
  textMine: { color: colors.onPlayer },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotMine: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.onPlayer },
});
