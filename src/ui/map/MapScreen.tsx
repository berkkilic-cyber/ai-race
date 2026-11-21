import { useIsFocused } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { sheetPanelWidth } from '../components/Sheet';
import { usePackEntry } from '../hooks/useGame';
import { layoutModeFor } from '../hooks/useLayoutMode';
import { t } from '../i18n';
import { AmbientGate } from '../motion/ambient';
import { useGameStore } from '../store/game';
import { useTutorialTarget } from '../tutorial/targets';
import { colors, radius, spacing, touch, type } from '../theme';
import { RegionSheet } from './RegionSheet';
import { RegionsSheet } from './RegionsSheet';
import { WorldMap } from './WorldMap';

/**
 * Map tab: the world map, the region panel and the Regions list.
 * Wide: the whole world fitted to the area; sheets are side panels and the map keeps the
 * selected region centred in the part the panel leaves free.
 * Narrow: zoomed to the home region; sheets are bottom sheets.
 * Two ways to open a region: tap it on the map, or pick it in the Regions list (button by
 * the zoom controls), which also brings it into view.
 */
export function MapScreen() {
  const { geometry } = usePackEntry();
  const home = useGameStore((s) => (s.state ? s.state.labs[s.state.playerLabId].homeRegion : undefined));
  const [selected, setSelected] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [centre, setCentre] = useState<{ regionId: string; nonce: number } | null>(null);
  const nonce = useRef(0);
  const { width, height } = useWindowDimensions();
  const wide = layoutModeFor(width, height) === 'wide';
  // Data-centre pulses stop while another tab is showing.
  const focused = useIsFocused();

  const select = useCallback((id: string) => {
    setSelected(id);
    setListOpen(false);
  }, []);
  const close = useCallback(() => {
    setSelected(null);
    setListOpen(false);
  }, []);
  const openList = useCallback(() => {
    setSelected(null);
    setListOpen(true);
  }, []);
  const closeList = useCallback(() => setListOpen(false), []);
  const pick = useCallback((id: string) => {
    setSelected(id);
    setListOpen(false);
    nonce.current += 1;
    setCentre({ regionId: id, nonce: nonce.current });
  }, []);

  const regionsRef = useTutorialTarget('map.regions');
  const regionsButton = (
    <View ref={regionsRef} collapsable={false}>
      <Pressable
        onPress={openList}
        accessibilityRole="button"
        accessibilityLabel={t('ui.map.regionsHint')}
        style={({ pressed }) => [styles.regions, (pressed || listOpen) && styles.regionsOn]}
        testID="map-regions"
      >
        <Text style={styles.regionsLabel}>{t('ui.map.regions')}</Text>
      </Pressable>
    </View>
  );

  return (
    <AmbientGate active={focused}>
      <View style={styles.root}>
        <WorldMap
          geometry={geometry}
          selected={selected}
          onSelect={select}
          onTapEmpty={close}
          focusRegion={home}
          defaultView={wide ? 'world' : 'focus'}
          insetRight={wide && (selected || listOpen) ? sheetPanelWidth(width) : 0}
          controls={wide ? 'bottomLeft' : 'topRight'}
          extraControl={regionsButton}
          centreRequest={centre}
        />
        {/* Neither sheet has an outside-tap layer: the map beside it stays live (another region switches the panel, the sea closes it). */}
        <RegionSheet regionId={selected} onClose={close} />
        <RegionsSheet visible={listOpen && !selected} onPick={pick} onClose={closeList} />
      </View>
    </AmbientGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  regions: {
    minHeight: 34,
    minWidth: touch,
    paddingHorizontal: spacing.m,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionsOn: { backgroundColor: colors.raised, borderColor: colors.player },
  regionsLabel: { color: colors.text, fontSize: type.s, fontWeight: '700' },
});
