import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { RemoveAdsPanel } from '../ads';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { t } from '../i18n';
import { LanguageRow } from '../locale';
import { colors, shape, spacing, type, voice } from '../theme';
import { useGarageStore } from './store';

/** Haptics, the "Remove ads" placeholder and a reset with a confirmation step. */
export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const haptics = useGarageStore((s) => s.settings.haptics);
  const setHaptics = useGarageStore((s) => s.setHaptics);
  const [confirm, setConfirm] = useState(false);
  const close = () => {
    setConfirm(false);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={close} title={t('ui.garage.settings.title')} safeArea testID="garage-settings-sheet">
      <View style={styles.row}>
        <Text style={styles.label}>{t('ui.garage.settings.haptics')}</Text>
        <Switch value={haptics} onValueChange={setHaptics} accessibilityLabel={t('ui.garage.settings.haptics')} testID="garage-haptics" />
      </View>
      <LanguageRow />
      <View style={styles.rule} />
      <RemoveAdsPanel />
      <View style={styles.rule} />
      {confirm ? (
        <View style={styles.confirm} testID="garage-reset-confirm">
          <Text style={styles.warn}>{t('ui.garage.settings.resetConfirm')}</Text>
          <View style={styles.buttons}>
            <Button label={t('ui.garage.settings.cancel')} variant="secondary" onPress={() => setConfirm(false)} testID="garage-reset-cancel" />
            <Button
              label={t('ui.garage.settings.resetYes')}
              variant="danger"
              onPress={() => {
                useGarageStore.getState().reset();
                close();
              }}
              testID="garage-reset-yes"
            />
          </View>
        </View>
      ) : (
        <Button label={t('ui.garage.settings.reset')} variant="ghost" onPress={() => setConfirm(true)} testID="garage-reset" />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  label: { ...voice.bodyStrong, color: colors.text, fontSize: type.m },
  rule: { height: shape.hairline, backgroundColor: colors.border },
  confirm: { gap: spacing.s },
  warn: { ...voice.body, color: colors.bad, fontSize: type.s, lineHeight: 19 },
  buttons: { flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap' },
});
