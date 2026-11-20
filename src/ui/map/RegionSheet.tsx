import { StyleSheet, Text, View } from 'react-native';

import {
  canApply,
  getDataCentreCost,
  getLaunchCost,
  getUpgradeCost,
  isBanned,
  type Action,
  type ActionCheck,
  type RegionDef,
} from '@/engine';

import { Button } from '../components/Button';
import { Pips } from '../components/Pips';
import { Sheet } from '../components/Sheet';
import { useTutorialTarget } from '../tutorial/targets';
import { fmtCash, fmtPct, fmtUsers, toPips } from '../format';
import { failureText, labName, readableLabColor, t } from '../i18n';
import { useGameStore } from '../store/game';
import { colors, spacing, type, voice } from '../theme';

export interface RegionSheetProps {
  regionId: string | null;
  onClose: () => void;
}

interface ActionRow {
  key: string;
  label: string;
  action: Action;
  cost: number;
  check: ActionCheck;
}

const ATTRIBUTES: { key: keyof Pick<RegionDef, 'wealth' | 'openness' | 'strictness' | 'powerCost'>; label: string }[] = [
  { key: 'wealth', label: 'ui.region.wealth' },
  { key: 'openness', label: 'ui.region.openness' },
  { key: 'strictness', label: 'ui.region.strictness' },
  { key: 'powerCost', label: 'ui.region.powerCost' },
];

/** Bottom sheet for one region: shares, attributes, and launch / build / upgrade actions with engine costs. */
export function RegionSheet({ regionId, onClose }: RegionSheetProps) {
  // Only an open sheet subscribes to the game state (it changes every tick).
  return regionId ? <OpenRegionSheet regionId={regionId} onClose={onClose} /> : null;
}

function OpenRegionSheet({ regionId, onClose }: { regionId: string; onClose: () => void }) {
  const state = useGameStore((s) => s.state);
  const pack = useGameStore((s) => s.pack);
  const dispatch = useGameStore((s) => s.dispatch);
  const buildRef = useTutorialTarget(`region.build:${regionId}`);
  const region = pack.regions.find((r) => r.id === regionId);
  if (!state || !region) return null;

  const playerId = state.playerLabId;
  const player = state.labs[playerId];
  const mine = player.adoption[region.id] ?? 0;
  const banned = isBanned(state, playerId, region.id);
  const shares = state.labOrder
    .map((id) => state.labs[id])
    .map((lab) => ({ lab, share: lab.adoption[region.id] ?? 0 }))
    .filter((x) => x.share > 0)
    .sort((a, b) => b.share - a.share);
  const free = Math.max(0, 1 - shares.reduce((sum, x) => sum + x.share, 0));

  const actions: ActionRow[] = [];
  if (mine <= 0) {
    const action: Action = { type: 'launchInRegion', labId: playerId, regionId: region.id };
    actions.push({ key: 'launch', label: t('ui.region.launch'), action, cost: getLaunchCost(state, pack, playerId, region.id), check: canApply(state, pack, action) });
  }
  {
    const action: Action = { type: 'buildDataCentre', labId: playerId, regionId: region.id };
    actions.push({
      key: 'build',
      label: `${t('ui.region.build')} ${t('term.dataCentre').toLowerCase()}`,
      action,
      cost: getDataCentreCost(state, pack, playerId, region.id),
      check: canApply(state, pack, action),
    });
  }
  const sites = player.dataCentres.filter((dc) => dc.regionId === region.id);
  for (const dc of sites) {
    const action: Action = { type: 'upgradeDataCentre', labId: playerId, dataCentreId: dc.id };
    actions.push({
      key: `up-${dc.id}`,
      label: t('ui.region.upgrade', { level: dc.level + 1 }),
      action,
      cost: getUpgradeCost(state, pack, playerId, dc.id),
      check: canApply(state, pack, action),
    });
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t(region.nameKey)}
      headerRight={<Button label="✕" compact variant="ghost" onPress={onClose} accessibilityLabel={t('ui.region.close')} />}
      testID="region-sheet"
    >
      <View style={styles.statsRow}>
        <Stat label={t('ui.region.population')} value={fmtUsers(region.population)} />
        <Stat label={t('ui.region.adoption')} value={fmtPct(mine)} sub={t('ui.region.users', { amount: fmtUsers(mine * region.population) })} />
      </View>
      {banned ? <Text style={styles.banned}>{t('ui.region.banned')}</Text> : null}

      <View style={styles.actions}>
        {actions.map((row) => (
          <View key={row.key} ref={row.key === 'build' ? buildRef : undefined}>
            <Button
              label={row.label}
              variant={row.check.ok ? 'primary' : 'secondary'}
              disabled={!row.check.ok}
              sublabel={row.check.ok ? fmtCash(row.cost) : `${fmtCash(row.cost)} · ${failureText(row.check.reason)}`}
              onPress={() => dispatch(row.action)}
              testID={`region-action-${row.key}`}
            />
          </View>
        ))}
      </View>

      <View>
        <Text style={styles.section}>{t('ui.region.shares')}</Text>
        <View style={styles.bar}>
          {shares.map(({ lab, share }) => (
            <View key={lab.id} style={{ flex: share, backgroundColor: readableLabColor(lab) }} />
          ))}
          {free > 0 ? <View style={{ flex: free, backgroundColor: colors.raised }} /> : null}
        </View>
        {shares.length === 0 ? <Text style={styles.dim}>{t('ui.region.nobody')}</Text> : null}
        {shares.map(({ lab, share }) => (
          <View key={lab.id} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: readableLabColor(lab) }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {labName(lab)}
            </Text>
            <Text style={styles.legendValue}>{fmtPct(share)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.attrs}>
        {ATTRIBUTES.map((a) => (
          <View key={a.key} style={styles.attr}>
            <Text style={styles.attrLabel}>{t(a.label)}</Text>
            <Pips value={toPips(region[a.key])} color={a.key === 'strictness' || a.key === 'powerCost' ? colors.alarm : colors.good} />
          </View>
        ))}
      </View>

      {sites.length > 0 ? (
        <View>
          <Text style={styles.section}>{t('ui.region.sites')}</Text>
          {sites.map((dc) => {
            const offline = dc.disabledUntilTick !== undefined && state.tick < dc.disabledUntilTick;
            return (
              <Text key={dc.id} style={styles.dim}>
                {t('term.dataCentre')} · {t('ui.region.siteLevel', { level: dc.level })}
                {offline ? ` · ${t('ui.region.offline')}` : ''}
              </Text>
            );
          })}
        </View>
      ) : null}

    </Sheet>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.dim}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: spacing.m },
  stat: { flex: 1 },
  statLabel: { ...voice.calmLabel, color: colors.dim },
  statValue: { ...voice.calmNumber, color: colors.text, fontSize: 24, lineHeight: 29 },
  banned: { ...voice.loudKicker, alignSelf: 'flex-start', color: colors.newsPaper, backgroundColor: colors.newsRed, paddingHorizontal: 6, fontSize: 13, transform: [{ rotate: '-1.5deg' }] },
  section: { ...voice.calmLabel, color: colors.dim, marginBottom: spacing.xs },
  bar: { flexDirection: 'row', height: 6, overflow: 'hidden', backgroundColor: colors.raised, marginBottom: spacing.s },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: 2 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, color: colors.text, fontSize: type.s },
  legendValue: { ...voice.calmNumber, color: colors.text, fontSize: type.s },
  dim: { color: colors.dim, fontSize: type.s },
  attrs: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.s },
  attr: { width: '50%', gap: spacing.xs },
  attrLabel: { ...voice.calmLabel, color: colors.dim },
  actions: { gap: spacing.s },
});
