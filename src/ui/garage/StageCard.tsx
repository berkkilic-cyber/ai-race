import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { ModalCard } from '../components/ModalCard';
import { t } from '../i18n';
import { colors, spacing, type, voice } from '../theme';
import { useGarageStore } from './store';
import { gt } from './text';

/** "The lab moved": the new place, a line about it and what it switches on. */
export function StageCard({ hidden }: { hidden?: boolean }) {
  const index = useGarageStore((s) => s.stageCard);
  const content = useGarageStore((s) => s.content);
  const def = index !== null ? content.stages?.[index] : undefined;
  if (!def || hidden) return null;
  const close = () => useGarageStore.getState().dismissStage();
  return (
    <ModalCard visible title={t('ui.garage.stage.moved', { name: gt(def.nameKey) })} tone="good" onRequestClose={close} testID="garage-stage-card">
      <View style={styles.body}>
        <Text style={styles.desc}>{gt(def.descKey)}</Text>
        <Text style={styles.label}>{t('ui.garage.stage.new')}</Text>
        <Text style={styles.unlock}>{gt(def.unlockKey)}</Text>
        <Button label={t('ui.garage.stage.continue')} variant="primary" onPress={close} style={styles.button} testID="garage-stage-continue" />
      </View>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xs },
  desc: { ...voice.body, color: colors.text, fontSize: type.s },
  label: { ...voice.calmLabel, color: colors.dim, marginTop: spacing.xs },
  unlock: { ...voice.bodyStrong, color: colors.playerText, fontSize: type.s },
  button: { alignSelf: 'flex-start', marginTop: spacing.s },
});
