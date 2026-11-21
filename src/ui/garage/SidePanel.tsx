import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { availableUpgrades, prestigePreview } from '@/idle';

import { t } from '../i18n';
import { colors, shape, spacing, touch, type, voice } from '../theme';
import { BuyModeToggle, GeneratorList } from './GeneratorList';
import { useGarage } from './hooks';
import { ShipPanel } from './ShipPanel';
import { useGarageStore, type GarageStore, type GarageTab } from './store';
import { UpgradeList } from './UpgradeList';

const TABS: GarageTab[] = ['build', 'upgrades', 'ship'];

/** Badges: upgrades affordable now, and whether a model can ship. */
const selBadges = (s: GarageStore) => {
  const st = s.state;
  if (!st) return '0|0';
  const n = availableUpgrades(st, s.content).filter((u) => st.tokens >= u.cost).length;
  return `${n}|${prestigePreview(st, s.content).canShip ? 1 : 0}`;
};
const same = (v: string) => v;

/** The right-hand panel: Build, Upgrades and Ship tabs, with the buy amount on Build. */
export function SidePanel() {
  const tab = useGarageStore((s) => s.tab);
  const setTab = useGarageStore((s) => s.setTab);
  const [upgrades, ship] = useGarage(selBadges, same).split('|');
  const label = (id: GarageTab) => (id === 'build' ? t('ui.garage.tab.build') : id === 'upgrades' ? t('ui.garage.tab.upgrades') : t('ui.garage.tab.ship'));
  return (
    <View style={styles.panel}>
      <View style={styles.tabs}>
        <View style={styles.tabGroup} accessibilityRole="tablist">
          {TABS.map((id) => {
            const on = id === tab;
            const badge = id === 'upgrades' && upgrades !== '0' ? upgrades : id === 'ship' && ship === '1' ? '!' : null;
            return (
              <Pressable key={id} onPress={() => setTab(id)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && styles.tabOn]} testID={`garage-tab-${id}`}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{label(id)}</Text>
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {tab === 'build' ? <BuyModeToggle /> : null}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} testID="garage-panel-scroll">
        {tab === 'build' ? <GeneratorList /> : tab === 'upgrades' ? <UpgradeList /> : <ShipPanel />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, minWidth: 0 },
  tabs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.s, paddingHorizontal: spacing.s, paddingTop: spacing.xs },
  tabGroup: { flexDirection: 'row', gap: spacing.xs },
  tab: { minHeight: touch - 4, paddingHorizontal: spacing.m, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderBottomWidth: 3, borderColor: colors.transparent },
  tabOn: { borderColor: colors.player },
  tabText: { ...voice.calmHeading, fontSize: type.s, color: colors.dim },
  tabTextOn: { color: colors.text },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: shape.panel === 'ticks' ? 0 : 9, backgroundColor: colors.player, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...voice.bodyStrong, fontSize: 11, color: colors.onPlayer },
  scroll: { flex: 1 },
  content: { padding: spacing.s, paddingBottom: spacing.l },
});

