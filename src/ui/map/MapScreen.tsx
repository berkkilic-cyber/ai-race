import { useIsFocused } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { sheetPanelWidth } from '../components/Sheet';
import { usePackEntry } from '../hooks/useGame';
import { layoutModeFor } from '../hooks/useLayoutMode';
import { AmbientGate } from '../motion/ambient';
import { useGameStore } from '../store/game';
import { RegionSheet } from './RegionSheet';
import { WorldMap } from './WorldMap';

/**
 * Map tab: the world map and the region sheet.
 * Wide: the whole world fitted to the area; the region sheet is a side panel and the map
 * keeps the selected region centred in the part the panel leaves free.
 * Narrow: zoomed to the home region; the region sheet is a bottom sheet.
 */
export function MapScreen() {
  const { geometry } = usePackEntry();
  const home = useGameStore((s) => (s.state ? s.state.labs[s.state.playerLabId].homeRegion : undefined));
  const [selected, setSelected] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const { width, height } = useWindowDimensions();
  const wide = layoutModeFor(width, height) === 'wide';
  // Data-centre pulses stop while another tab is showing.
  const focused = useIsFocused();
  return (
    <AmbientGate active={focused}>
      <View style={styles.root}>
        <WorldMap
          geometry={geometry}
          selected={selected}
          onSelect={setSelected}
          onTapEmpty={close}
          focusRegion={home}
          defaultView={wide ? 'world' : 'focus'}
          insetRight={wide && selected ? sheetPanelWidth(width) : 0}
          controls={wide ? 'bottomLeft' : 'topRight'}
        />
        {/* The one sheet without an outside-tap layer: the map beside it stays live (another region switches the panel, the sea closes it). */}
        <RegionSheet regionId={selected} onClose={close} />
      </View>
    </AmbientGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
