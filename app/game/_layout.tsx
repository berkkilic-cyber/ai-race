import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ToastHost } from '@/ui/achievements';
import { useComposure } from '@/ui/composure';
import { EventModal } from '@/ui/events';
import { useEndNavigation, useGameLoop } from '@/ui/hooks';
import { t } from '@/ui/i18n';
import { ComposureStage, useTremble } from '@/ui/shell/ComposureStage';
import { GameHeader } from '@/ui/shell/GameHeader';
import { useShellStyles } from '@/ui/shell/shellStyles';
import { TabButton } from '@/ui/shell/TabButton';
import { Ticker } from '@/ui/shell/Ticker';
import { TickerDock } from '@/ui/shell/TickerDock';
import { colors } from '@/ui/theme';
import { TreesTabBadge } from '@/ui/trees';

/**
 * Game shell: header, tab content, ticker, tabs, event modal, game loop.
 * Wide (landscape): left tab rail, one top strip, ticker strip under the content.
 * Narrow (portrait): top bar, resources and meters, content, ticker, bottom tab bar.
 * The arrangement lives in src/ui/shell (GameHeader, TickerDock, useShellStyles); the main
 * area carries the composure overlays (ComposureStage) and the shell trembles at level 3.
 */
export default function GameLayout() {
  useGameLoop();
  useEndNavigation();
  const shell = useShellStyles();
  const { level } = useComposure();
  const tremble = useTremble(level);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <Animated.View style={[styles.shell, tremble]}>
        <Tabs style={shell.tabs}>
          <GameHeader />
          <ComposureStage>
            <TabSlot style={styles.slot} />
          </ComposureStage>
          <TickerDock>
            <Ticker />
          </TickerDock>
          <TabList style={shell.tabBar}>
            <TabTrigger name="index" href="/game" asChild>
              <TabButton label={t('ui.tab.map')} />
            </TabTrigger>
            <TabTrigger name="trees" href="/game/trees" asChild>
              <TabButton label={t('ui.tab.trees')} badge={<TreesTabBadge />} />
            </TabTrigger>
            <TabTrigger name="news" href="/game/news" asChild>
              <TabButton label={t('ui.tab.news')} />
            </TabTrigger>
          </TabList>
        </Tabs>
      </Animated.View>
      <EventModal />
      <ToastHost />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  shell: { flex: 1 },
  slot: { flex: 1 },
});
