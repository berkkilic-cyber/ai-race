import { StyleSheet, View } from 'react-native';

import { HOUR_MS, offerStatus, offlineRate, upgradeDef, type GarageContent, type StorageNext } from '@/idle';

import { AdButton } from '../ads';
import { Button } from '../components/Button';
import { ModalCard } from '../components/ModalCard';
import { Icon } from '../icons';
import { t } from '../i18n';
import { Text } from '../locale/Text';
import { fmtHours } from '../format';
import { colors, spacing, tabular, type, voice } from '../theme';
import { StorageBar, storageHours } from './AwayStorage';
import { useAdPlacement } from './adOffer';
import { successHaptic } from './haptics';
import { useGarage } from './hooks';
import { useGarageStore, type GarageStore } from './store';
import { fmt, fmtPct, fmtTime, gt } from './text';

const sel = (s: GarageStore) => (s.state?.offline ? `${s.state.offline.awayMs}|${s.state.offline.tokens}|${s.state.offline.doubled}` : '');
const same = (v: string) => v;

/** "While you were away": what the garage made, Collect, and the opt-in ad that doubles it. */
export function OfflinePanel({ hidden }: { hidden?: boolean }) {
  const key = useGarage(sel, same);
  const { state } = useGarageStore.getState();
  const report = state?.offline;
  if (!key || !report || !state || hidden) return null;
  const close = () => useGarageStore.getState().dismissOffline();
  return (
    <ModalCard visible title={t('ui.garage.offline.title')} tone="good" onRequestClose={close} testID="garage-offline">
      <View style={styles.body}>
        <Text style={styles.away}>{t('ui.garage.offline.away', { time: fmtTime(report.awayMs) })}</Text>
        <Text style={styles.label}>{t('ui.garage.offline.earned')}</Text>
        <View style={styles.amountRow}>
          <Icon name="speech" size={30} color={colors.text} accent={colors.player} />
          <Text style={styles.amount} testID="garage-offline-amount">
            +{fmt(report.tokens)}
          </Text>
          {report.doubled ? <Text style={styles.doubled}>{t('ui.garage.offline.doubled')}</Text> : null}
        </View>
        <StorageReport />
        <View style={styles.buttons}>
          <Button label={t('ui.garage.offline.collect')} variant={report.doubled ? 'primary' : 'secondary'} onPress={close} style={styles.collect} testID="garage-offline-collect" />
          <DoubleOffer amount={fmt(report.tokens)} />
        </View>
      </View>
    </ModalCard>
  );
}

/** Where to raise storage, said plainly (null when nothing is left to raise). */
function raiseText(next: StorageNext | null, content: GarageContent): string | null {
  if (!next) return null;
  if (next.kind === 'upgrade') {
    const def = upgradeDef(content, next.id);
    const name = def ? gt(def.nameKey) : next.id;
    return t(next.available ? 'ui.garage.offline.raise' : 'ui.garage.offline.raiseLater', { name, hours: fmtHours(next.hours) });
  }
  const perk = content.labRep.perks.find((p) => p.id === next.id);
  return t('ui.garage.offline.raisePerk', { rep: next.cost, hours: fmtHours(next.hours), name: perk?.nameKey ? gt(perk.nameKey) : next.id });
}

/**
 * The away storage on return: the bar filled to what was earned, "Storage full" in plain
 * words when it capped (the lab stopped earning), and the upgrade that raises it.
 */
function StorageReport() {
  const { state, content } = useGarageStore.getState();
  const report = state?.offline;
  if (!state || !report) return null;
  const { st, capHours, maxHours } = storageHours(state, content);
  const capMs = report.capMs && report.capMs > 0 ? report.capMs : st.capMs;
  const capped = report.capped === true;
  const fill = capped ? 1 : Math.min(1, report.creditedMs / Math.max(1, capMs));
  const raise = raiseText(st.next, content);
  return (
    <View style={styles.storage} testID={capped ? 'garage-offline-capped' : 'garage-offline-storage'}>
      <Text style={styles.label}>{t('ui.garage.storage.title')}</Text>
      <StorageBar capHours={capMs / HOUR_MS} maxHours={Math.max(maxHours, capHours)} fill={fill} height={12} testID="garage-offline-bar" />
      <Text style={[styles.storageLine, capped && styles.cappedLine]}>
        {capped ? t('ui.garage.offline.capped', { cap: fmtTime(capMs) }) : t('ui.garage.offline.notCapped', { pct: fmtPct(fill), left: fmtTime(Math.max(0, capMs - report.creditedMs)) })}
      </Text>
      {capped && raise ? <Text style={styles.note}>{raise}</Text> : null}
      <Text style={styles.note}>{t('ui.garage.offline.note', { pct: fmtPct(offlineRate(state, content)) })}</Text>
      {capped && st.next?.kind === 'upgrade' && st.next.available ? (
        <Button
          label={t('ui.garage.offline.openUpgrades')}
          variant="ghost"
          onPress={() => {
            const store = useGarageStore.getState();
            store.setTab('upgrades');
            store.dismissOffline();
          }}
          style={styles.raise}
          testID="garage-offline-raise"
        />
      ) : null}
    </View>
  );
}

/** The offline double ad, when the placement policy picks it. */
function DoubleOffer({ amount }: { amount: string }) {
  const placement = useAdPlacement();
  const { state, content } = useGarageStore.getState();
  if (placement !== 'offlineDouble' || !state) return null;
  return (
    <AdButton
      placement="offlineDouble"
      variant="primary"
      label={t('ui.ads.placement.offlineDouble')}
      reward={t('ui.ads.reward.offlineDouble', { amount })}
      status={offerStatus(state, content, 'offlineDouble')}
      onRewarded={() => {
        useGarageStore.getState().claim('offlineDouble');
        successHaptic();
      }}
    />
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
  storage: { gap: spacing.xs, marginTop: spacing.xs },
  storageLine: { ...voice.body, color: colors.text, fontSize: type.s },
  cappedLine: { ...voice.bodyStrong, color: colors.text },
  raise: { alignSelf: 'flex-start', minHeight: 36 },
  buttons: { flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap', marginTop: spacing.s },
  collect: { minWidth: 120 },
});
