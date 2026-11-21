import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MockAdHost, useAdStore } from '../ads';
import { Ground } from '../components/Deco';
import { useInsets } from '../hooks/useInsets';
import { useLayoutMode } from '../hooks/useLayoutMode';
import { t } from '../i18n';
import { AmbientProvider } from '../motion/ambient';
import { colors, shape, spacing, voice } from '../theme';
import { installGarageDebug } from './debug';
import { GarageHeader, OfferButtons } from './GarageHeader';
import { GarageTicker } from './GarageTicker';
import { useGarageLoop } from './hooks';
import { LaunchCard } from './LaunchCard';
import { OfflinePanel } from './OfflinePanel';
import { SettingsSheet } from './SettingsSheet';
import { SidePanel } from './SidePanel';
import { StatsSheet } from './StatsSheet';
import { useGarageStore } from './store';
import { TapStage } from './TapStage';

/**
 * Garage: the idle clicker. Landscape: the tap stage on the left, the Build / Upgrades /
 * Ship panel on the right, the ticker along the bottom. Narrow: stacked, with the offer
 * buttons in their own row. Everything that covers the screen is an in-tree overlay.
 */
export function GarageScreen() {
  const active = useGarageLoop();
  const loaded = useGarageStore((s) => s.state !== null);
  const launch = useGarageStore((s) => s.launch !== null);
  const insets = useInsets();
  const wide = useLayoutMode() === 'wide';
  const [stats, setStats] = useState(false);
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    void useAdStore.getState().load();
    installGarageDebug();
  }, []);
  return (
    <View style={styles.root}>
      <Ground />
      <AmbientProvider running={active && loaded}>
        <View style={[styles.main, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
          <GarageHeader wide={wide} onStats={() => setStats(true)} onSettings={() => setSettings(true)} />
          {!loaded ? (
            <View style={styles.loading}>
              <Text style={styles.loadingText}>{t('ui.garage.loading')}</Text>
            </View>
          ) : wide ? (
            <View style={styles.wideBody}>
              <View style={styles.stageCol}>
                <TapStage />
              </View>
              <View style={styles.panelCol}>
                <SidePanel />
              </View>
            </View>
          ) : (
            <View style={styles.narrowBody}>
              <View style={styles.narrowOffers}>
                <OfferButtons compact />
              </View>
              <View style={styles.narrowStage}>
                <TapStage compact />
              </View>
              <View style={styles.narrowPanel}>
                <SidePanel />
              </View>
            </View>
          )}
        </View>
        <GarageTicker />
        <StatsSheet visible={stats} onClose={() => setStats(false)} />
        <SettingsSheet visible={settings} onClose={() => setSettings(false)} />
        <OfflinePanel hidden={launch} />
        <LaunchCard />
        <MockAdHost />
      </AmbientProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  main: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { ...voice.body, color: colors.dim },
  wideBody: { flex: 1, flexDirection: 'row' },
  stageCol: { flex: 1, minWidth: 0 },
  panelCol: { flex: 1.15, minWidth: 0, borderLeftWidth: shape.hairline, borderColor: colors.border, backgroundColor: colors.bg },
  narrowBody: { flex: 1 },
  narrowOffers: { flexDirection: 'row', justifyContent: 'center', paddingVertical: spacing.xs },
  narrowStage: { height: '42%' },
  narrowPanel: { flex: 1, borderTopWidth: shape.hairline, borderColor: colors.border },
});
