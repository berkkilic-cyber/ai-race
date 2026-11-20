import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventModal } from '@/ui/events';
import { useEndNavigation, useGameLoop } from '@/ui/hooks';
import { t } from '@/ui/i18n';
import { MeterRow } from '@/ui/shell/MeterRow';
import { ResourceRow } from '@/ui/shell/ResourceRow';
import { TabButton } from '@/ui/shell/TabButton';
import { Ticker } from '@/ui/shell/Ticker';
import { TopBar } from '@/ui/shell/TopBar';
import { colors } from '@/ui/theme';

/** Game shell: top bar, resources, meters, tab content, ticker, tab bar, event modal, game loop. */
export default function GameLayout() {
  useGameLoop();
  useEndNavigation();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <Tabs style={styles.tabs}>
        <View style={styles.header}>
          <TopBar />
          <ResourceRow />
          <MeterRow />
        </View>
        <TabSlot style={styles.slot} />
        <Ticker />
        <TabList style={styles.tabBar}>
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
  tabs: { flex: 1 },
  header: { backgroundColor: colors.bg, borderBottomWidth: 1, borderColor: colors.border },
  slot: { flex: 1 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border },
});
