import { usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ToastHost } from '@/ui/achievements';
import { useComposure } from '@/ui/composure';
import { logLifecycle } from '@/ui/diagnostics/log';
import { EventModal } from '@/ui/events';
import { useAmbientShouldRun, useEndNavigation, useGameLoop } from '@/ui/hooks';
import { t } from '@/ui/i18n';
import { AmbientProvider } from '@/ui/motion/ambient';
import { ComposureStage, useTremble } from '@/ui/shell/ComposureStage';
import { GameHeader } from '@/ui/shell/GameHeader';
import { useShellStyles } from '@/ui/shell/shellStyles';
import { renderFrozenTab } from '@/ui/shell/tabSlot';
import { TabButton } from '@/ui/shell/TabButton';
import { Ticker } from '@/ui/shell/Ticker';
import { TickerDock } from '@/ui/shell/TickerDock';
import { colors } from '@/ui/theme';
import { TreesTabBadge } from '@/ui/trees';
import { TutorialHost } from '@/ui/tutorial';

// Web splits routes into chunks: load the other tabs' code and the end screen now, quietly,
// so switching tabs or finishing the run never makes the router require a chunk that is not
// there yet (see app/index.tsx). Native has one bundle; these resolve at once.
void Promise.all([import('./trees'), import('./news'), import('./race'), import('../end')]).catch(() => undefined);

/**
 * Game shell: header, tab content, ticker, tabs, event modal, game loop.
 * Wide (landscape): left tab rail, one top strip, ticker strip under the content.
 * Narrow (portrait): top bar, resources and meters, content, ticker, bottom tab bar.
 * The arrangement lives in src/ui/shell (GameHeader, TickerDock, useShellStyles); the main
 * area carries the composure overlays (ComposureStage) and the shell trembles at level 3.
 * Ambient (looping) animation runs on one shared clock (AmbientProvider) that stops while
 * paused, after the run and in the background. The event card and toasts are in-tree
 * overlays above the shell (theme `layer`), never native Modals.
 * Safe areas: no SafeAreaView here. useShellStyles places the rail and the main column from
 * the insets (useInsets), once. TabList uses asChild so expo-router does not wrap it in its
 * own SafeAreaView (which added the left inset a second time inside the rail); it stays a
 * direct child of Tabs as expo-router requires. Hidden tabs are frozen (renderFrozenTab):
 * they keep their state but skip the per-tick renders until shown again.
 */
export default function GameLayout() {
  useGameLoop();
  useEndNavigation();
  const ambient = useAmbientShouldRun();
  return (
    <AmbientProvider running={ambient}>
      <GameShell />
    </AmbientProvider>
  );
}

/** Everything inside the ambient clock (the tremble reads it). */
function GameShell() {
  useTabLog();
  const shell = useShellStyles();
  const { level } = useComposure();
  const tremble = useTremble(level);
  return (
    <View style={styles.root}>
      <Animated.View style={[styles.shell, tremble]}>
        <Tabs style={shell.tabs}>
          <View style={shell.main}>
            <GameHeader />
            <ComposureStage>
              <TabSlot style={styles.slot} renderFn={renderFrozenTab} />
            </ComposureStage>
            <TickerDock>
              <Ticker />
            </TickerDock>
          </View>
          <TabList asChild style={shell.tabBar}>
            <View>
              <TabTrigger name="index" href="/game" asChild>
                <TabButton label={t('ui.tab.map')} targetId="tab.map" icon="map" />
              </TabTrigger>
              <TabTrigger name="trees" href="/game/trees" asChild>
                <TabButton label={t('ui.tab.trees')} badge={<TreesTabBadge />} targetId="tab.trees" icon="trees" />
              </TabTrigger>
              <TabTrigger name="news" href="/game/news" asChild>
                <TabButton label={t('ui.tab.news')} targetId="tab.news" icon="news" />
              </TabTrigger>
              <TabTrigger name="race" href="/game/race" asChild>
                <TabButton label={t('ui.race.tab')} targetId="tab.race" icon="race" />
              </TabTrigger>
            </View>
          </TabList>
        </Tabs>
      </Animated.View>
      <ToastHost />
      <TutorialHost />
      <EventModal />
    </View>
  );
}

/** `[AI-RACE] tab changed` whenever the shown tab changes (development builds). */
function useTabLog() {
  const pathname = usePathname();
  useEffect(() => {
    logLifecycle('tab changed', { tab: pathname });
  }, [pathname]);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chrome },
  shell: { flex: 1 },
  slot: { flex: 1 },
});
