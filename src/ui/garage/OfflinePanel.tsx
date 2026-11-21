import { StyleSheet, Text, View } from 'react-native';

import { multipliers, offerStatus } from '@/idle';

import { AdButton } from '../ads';
import { Button } from '../components/Button';
import { ModalCard } from '../components/ModalCard';
import { Icon } from '../icons';
import { t } from '../i18n';
import { colors, spacing, tabular, type, voice } from '../theme';
import { successHaptic } from './haptics';
import { useGarage } from './hooks';
import { useGarageStore, type GarageStore } from './store';
import { fmt, fmtPct, fmtTime } from './text';

const sel = (s: GarageStore) => (s.state?.offline ? `${s.state.offline.awayMs}|${s.state.offline.tokens}|${s.state.offline.doubled}` : '');
const same = (v: string) => v;

/** "While you were away": what the garage made, Collect, and the opt-in ad that doubles it. */
export function OfflinePanel({ hidden }: { hidden?: boolean }) {
  const key = useGarage(sel, same);
  const { state, content } = useGarageStore.getState();
  const report = state?.offline;
  if (!key || !report || !state || hidden) return null;
  const m = multipliers(state, content);
  const close = () => useGarageStore.getState().dismissOffline();
  return (
    <ModalCard visible title={t('ui.garage.offline.title')} tone="good" onRequestClose={close} testID="garage-offline">
      <View style={styles.body}>
        <Text style={styles.away}>{t('ui.garage.offline.away', { time: fmtTime(report.awayMs) })}</Text>
        <Text style={styles.label}>{t('ui.garage.offline.earned')}</Text>
        <View style={styles.amountRow}>
          <Icon name="hype" size={30} color={colors.text} accent={colors.player} />
          <Text style={styles.amount} testID="garage-offline-amount">
            +{fmt(report.tokens)}
          </Text>
          {report.doubled ? <Text style={styles.doubled}>{t('ui.garage.offline.doubled')}</Text> : null}
        </View>
        <Text style={styles.note}>{t('ui.garage.offline.note', { pct: fmtPct(m.offlineRate), cap: fmtTime(m.offlineCapMs) })}</Text>
        <View style={styles.buttons}>
          <Button label={t('ui.garage.offline.collect')} variant={report.doubled ? 'primary' : 'secondary'} onPress={close} style={styles.collect} testID="garage-offline-collect" />
          <AdButton
            placement="offlineDouble"
            variant="primary"
            label={t('ui.ads.placement.offlineDouble')}
            reward={t('ui.ads.reward.offlineDouble', { amount: fmt(report.tokens) })}
            status={offerStatus(state, content, 'offlineDouble')}
            onRewarded={() => {
              useGarageStore.getState().claim('offlineDouble');
              successHaptic();
            }}
          />
        </View>
      </View>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xs },
  away: { ...voice.body, color: colors.dim, fontSize: type.s },
  label: { ...voice.calmLabel, color: colors.dim, marginTop: spacing.xs },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
  amount: { ...voice.calmNumber, ...tabular, color: colors.text, fontSize: 36, lineHeight: 42 },
  doubled: { ...voice.bodyStrong, color: colors.goodText, fontSize: type.s },
  note: { ...voice.body, color: colors.dim, fontSize: type.xs + 1 },
  buttons: { flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap', marginTop: spacing.s },
  collect: { minWidth: 120 },
});
