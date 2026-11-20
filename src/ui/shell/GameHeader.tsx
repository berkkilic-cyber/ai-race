import { StyleSheet, View } from 'react-native';

import { useLayoutMode } from '../hooks/useLayoutMode';
import { colors } from '../theme';
import { MeterRow } from './MeterRow';
import { ResourceRow } from './ResourceRow';
import { SpeedControl } from './SpeedControl';
import { TopBar } from './TopBar';
import { TopStrip } from './TopStrip';

/** Shell header: the single top strip in wide mode, TopBar + ResourceRow + MeterRow in narrow mode. */
export function GameHeader() {
  const mode = useLayoutMode();
  if (mode === 'wide') return <TopStrip right={<SpeedControl />} />;
  return (
    <View style={styles.header}>
      <TopBar />
      <ResourceRow />
      <MeterRow />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.chrome, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
