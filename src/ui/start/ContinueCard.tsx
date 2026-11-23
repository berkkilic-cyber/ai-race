import { StyleSheet, View } from 'react-native';

import { getDifficulty, getRunLength, type ContentPack } from '@/engine';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { Mascot } from '../mascot';
import type { RunSave } from '../store/runSave';
import { colors, spacing, type, voice } from '../theme';

/** "Day 214 · Frontier · Sprint" for a saved run (the parts the pack has). */
export function continueLine(save: RunSave, pack: ContentPack): string {
  const state = save.state;
  const day = state.tick + 1;
  const d = getDifficulty(state, pack);
  const r = getRunLength(state, pack);
  if (!d || !r) return t('ui.sprint.continue.lineShort', { day });
  return t('ui.sprint.continue.line', { day, difficulty: t(d.nameKey), length: t(r.nameKey) });
}

export interface ContinueCardProps {
  save: RunSave;
  pack: ContentPack;
  onContinue: () => void;
  /** Start a new lab instead (the save is kept until a new run actually starts, which asks first). */
  onNew: () => void;
  wide?: boolean;
}

/** The start screen's first view when a run is saved: lab, day, difficulty, Continue; a new lab below. */
export function ContinueCard({ save, pack, onContinue, onNew, wide }: ContinueCardProps) {
  const lab = save.state.labs[save.state.playerLabId];
  return (
    <View style={[styles.wrap, wide && styles.wrapWide]} testID="continue-card">
      <Card style={[styles.card, wide && styles.cardWide]}>
        <View style={styles.row}>
          <Mascot mood="pleased" size={wide ? 56 : 48} />
          <View style={styles.text}>
            <Text style={styles.kicker} accessibilityRole="header">
              {t('ui.sprint.continue.title')}
            </Text>
            <Text style={styles.lab} numberOfLines={1} testID="continue-lab">
              {lab.name}
            </Text>
            <Text style={styles.line} numberOfLines={1} testID="continue-line">
              {continueLine(save, pack)}
            </Text>
          </View>
        </View>
        <Button label={t('ui.sprint.continue.button')} sublabel={t('ui.sprint.continue.hint')} variant="primary" onPress={onContinue} style={styles.primary} testID="continue-run" />
      </Card>
      <Button label={t('ui.sprint.continue.or')} variant="ghost" onPress={onNew} style={styles.secondary} testID="continue-new" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.m, alignSelf: 'stretch' },
  wrapWide: { alignSelf: 'center', width: '100%', maxWidth: 520, flex: 1, justifyContent: 'center' },
  card: { gap: spacing.m, borderTopWidth: 4, borderTopColor: colors.player },
  cardWide: { padding: spacing.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  text: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { ...voice.calmLabel, color: colors.playerText },
  lab: { ...voice.calmHeading, color: colors.text, fontSize: type.xl },
  line: { ...voice.body, color: colors.dim, fontSize: type.s },
  primary: { minHeight: 56 },
  secondary: { alignSelf: 'center', minWidth: 220 },
});
