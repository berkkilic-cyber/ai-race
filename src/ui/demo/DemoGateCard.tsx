import { StyleSheet, View } from 'react-native';

import { ModalCard } from '../components/ModalCard';
import { Button } from '../components/Button';
import { useDemoGateSeen } from '../analytics/hooks';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { colors, spacing, type } from '../theme';
import { openWaitlist, useDemoGate } from './gate';

/** "In the full game": what is locked, the waitlist button and a way back to the demo. */
export function DemoGateCard() {
  const feature = useDemoGate((s) => s.feature);
  const params = useDemoGate((s) => s.params);
  const hide = useDemoGate((s) => s.hide);
  useDemoGateSeen(feature ?? '', feature !== null);
  return (
    <ModalCard visible={feature !== null} title={t('ui.demo.gate.title')} onRequestClose={hide} testID="demo-gate">
      {feature ? <Text style={styles.body}>{t(`ui.demo.gate.body.${feature}`, params)}</Text> : null}
      <Text style={styles.foot}>{t('ui.demo.gate.foot')}</Text>
      <View style={styles.row}>
        <Button label={t('ui.demo.gate.close')} variant="ghost" onPress={hide} style={styles.btn} testID="demo-gate-close" />
        <Button
          label={t('ui.demo.cta')}
          variant="primary"
          onPress={() => {
            openWaitlist('gate');
            hide();
          }}
          style={styles.btn}
          testID="demo-gate-cta"
        />
      </View>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.text, fontSize: type.m, lineHeight: 21 },
  foot: { color: colors.dim, fontSize: type.s, lineHeight: 18 },
  row: { flexDirection: 'row', gap: spacing.s, marginTop: spacing.s },
  btn: { flex: 1, minHeight: 48 },
});
