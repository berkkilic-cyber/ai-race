import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePackEntry } from '../hooks/useGame';
import { useGameStore } from '../store/game';
import { RegionSheet } from './RegionSheet';
import { WorldMap } from './WorldMap';

/** Map tab: the world map and the region sheet. */
export function MapScreen() {
  const { geometry } = usePackEntry();
  const home = useGameStore((s) => (s.state ? s.state.labs[s.state.playerLabId].homeRegion : undefined));
  const [selected, setSelected] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);
  return (
    <View style={styles.root}>
      <WorldMap geometry={geometry} selected={selected} onSelect={setSelected} focusRegion={home} />
      <RegionSheet regionId={selected} onClose={close} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
