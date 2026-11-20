import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventModal } from '@/ui/events';
import { useEndNavigation, useGameLoop } from '@/ui/hooks';
import { t } from '@/ui/i18n';
import { GameHeader } from '@/ui/shell/GameHeader';
import { useShellStyles } from '@/ui/shell/shellStyles';
import { TabButton } from '@/ui/shell/TabButton';
import { Ticker } from '@/ui/shell/Ticker';
import { TickerDock } from '@/ui/shell/TickerDock';
import { colors } from '@/ui/theme';

/**
 * Game shell: header, tab content, ticker, tabs, event modal, game loop.
 * Wide (landscape): left tab rail, one top strip, ticker strip under the content.
 * Narrow (portrait): top bar, resources and meters, content, ticker, bottom tab bar.
 * The arrangement lives in src/ui/shell (GameHeader, TickerDock, useShellStyles).
 */
export default function GameLayout() {
  useGameLoop();
  useEndNavigation();
  const shell = useShellStyles();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <Tabs style={shell.tabs}>
        <GameHeader />
        <TabSlot style={styles.slot} />
        <TickerDock>
          <Ticker />
        </TickerDock>
        <TabList style={shell.tabBar}>
          <TabTrigger name="index" href="/game" asChild>
            <TabButton label={t('ui.tab.map')} />
          </TabTrigger>
          <TabTrigger name="trees" href="/game/trees" asChild>
            <TabButton label={t('ui.tab.trees')} />
          </TabTrigger>
          <TabTrigger name="news" href="/game/news" asChild>
            <TabButton label={t('ui.tab.news')} />
          </TabTrigger>
        </TabList>
      </Tabs>
      <EventModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  slot: { flex: 1 },
});
