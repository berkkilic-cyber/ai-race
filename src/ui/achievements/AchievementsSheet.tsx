import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AchievementDef } from '@/engine';

import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { t } from '../i18n';
import { upper } from '../locale/casing';
import { useGameStore } from '../store/game';
import { sortAchievements, type AchievementRowState } from './sort';
import { colors, radius, spacing, type } from '../theme';

export { sortAchievements, type AchievementRowState } from './sort';

const NO_IDS: string[] = [];


const AchievementRow = memo(function AchievementRow({ def, state }: { def: AchievementDef; state: AchievementRowState }) {
  const earned = state === 'earned';
  const hidden = state === 'hidden';
  return (
    <View style={[styles.row, earned ? styles.rowEarned : styles.rowLocked]} testID={`achievement-${def.id}`}>
      <View style={[styles.badge, earned ? (def.secret ? styles.badgeSecret : styles.badgeEarned) : styles.badgeLocked]}>
        <Text style={[styles.badgeText, earned && styles.badgeTextEarned]}>{earned ? '★' : hidden ? '?' : '☆'}</Text>
      </View>
      <View style={styles.texts}>
        <View style={styles.nameLine}>
          <Text style={[styles.name, !earned && styles.dim]} numberOfLines={1}>
            {hidden ? t('ui.achievements.hiddenName') : t(def.nameKey)}
          </Text>
          {def.secret && earned ? <Text style={styles.secretTag}>{upper(t('ui.achievements.secret'))}</Text> : null}
        </View>
        <Text style={[styles.desc, !earned && styles.dim]}>{hidden ? t('ui.achievements.hiddenDesc') : t(def.descKey)}</Text>
      </View>
    </View>
  );
});

/** Sheet listing earned achievements, visible locked ones greyed out, secret ones as "???". */
export function AchievementsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // The engine copies the earned list every tick, so subscribe to its contents as a string.
  const earnedKey = useGameStore((s) => (visible ? (s.state?.achievements.join('|') ?? '') : ''));
  const defs = useGameStore((s) => s.pack.achievements);
  const rows = useMemo(() => sortAchievements(defs, earnedKey ? earnedKey.split('|') : NO_IDS), [defs, earnedKey]);
  const count = earnedKey ? earnedKey.split('|').length : 0;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('ui.achievements.title')}
      maxHeight="85%"
      testID="achievements-sheet"
      headerRight={<Button label={t('ui.achievements.close')} variant="ghost" compact onPress={onClose} testID="achievements-close" />}
    >
      <Text style={styles.progress}>{t('ui.achievements.progress', { earned: count, total: defs.length })}</Text>
      {rows.map(({ def, state }) => (
        <AchievementRow key={def.id} def={def} state={state} />
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  progress: { color: colors.dim, fontSize: type.s },
  row: { flexDirection: 'row', gap: spacing.m, alignItems: 'center', padding: spacing.m, borderRadius: radius.s, borderWidth: 1 },
  rowEarned: { backgroundColor: colors.raised, borderColor: colors.player },
  rowLocked: { backgroundColor: colors.bg, borderColor: colors.border },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badgeEarned: { backgroundColor: colors.player, borderColor: colors.player },
  badgeSecret: { backgroundColor: colors.info, borderColor: colors.info },
  badgeLocked: { backgroundColor: colors.surface, borderColor: colors.border },
  badgeText: { color: colors.dim, fontSize: type.l, fontWeight: '800' },
  badgeTextEarned: { color: colors.onPlayer },
  texts: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  name: { flexShrink: 1, color: colors.text, fontSize: type.m, fontWeight: '700' },
  secretTag: { color: colors.info, fontSize: type.xs, fontWeight: '800', letterSpacing: 1 },
  desc: { color: colors.text, fontSize: type.s },
  dim: { color: colors.dim },
});
